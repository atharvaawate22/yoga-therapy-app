/**
 * The pose classifier's forward pass, ported from the server's
 * NumpyClassifier (backend/utils/model.py): Dense layers with ReLU and a
 * softmax output. Weights come from backend/export_web_artifacts.py.
 */
import type { BodyGate } from "./features";

export type Activation = "linear" | "relu" | "softmax";

export interface DenseLayer {
  inputs: number;
  units: number;
  activation: Activation;
  /** Row-major [inputs][units], flattened. */
  kernel: number[];
  bias: number[];
}

export interface ClassifierArtifact {
  sourceSha256: string;
  movenetVariant: string;
  labels: string[];
  thresholds: BodyGate & {
    minClassProb: number;
    minClassProbLive: number;
    stabilityWindow: number;
    stabilityMinVotes: number;
    ruleMinKeypointScore: number;
  };
  layers: DenseLayer[];
}

export interface Prediction {
  label: string;
  probability: number;
  /** Softmax output, index-aligned with the artifact's labels. */
  probabilities: Float32Array;
}

function dense(input: Float32Array, layer: DenseLayer, kernel: Float32Array, bias: Float32Array) {
  const out = new Float32Array(layer.units);
  for (let j = 0; j < layer.units; j++) {
    let sum = bias[j]!;
    for (let i = 0; i < layer.inputs; i++) sum += input[i]! * kernel[i * layer.units + j]!;
    out[j] = sum;
  }
  switch (layer.activation) {
    case "relu":
      for (let j = 0; j < out.length; j++) out[j] = Math.max(out[j]!, 0);
      break;
    case "softmax": {
      let max = -Infinity;
      for (const v of out) max = Math.max(max, v);
      let total = 0;
      for (let j = 0; j < out.length; j++) {
        out[j] = Math.exp(out[j]! - max);
        total += out[j]!;
      }
      for (let j = 0; j < out.length; j++) out[j] = out[j]! / total;
      break;
    }
    case "linear":
      break;
  }
  return out;
}

export class PoseClassifier {
  private readonly weights: Array<{ layer: DenseLayer; kernel: Float32Array; bias: Float32Array }>;

  constructor(readonly artifact: ClassifierArtifact) {
    const layers = artifact.layers;
    if (layers.length === 0) throw new Error("Classifier has no layers");
    if (layers.at(-1)!.units !== artifact.labels.length) {
      throw new Error("Output layer size doesn't match the labels");
    }
    this.weights = layers.map((layer) => {
      if (layer.kernel.length !== layer.inputs * layer.units || layer.bias.length !== layer.units) {
        throw new Error("Malformed layer weights");
      }
      return { layer, kernel: Float32Array.from(layer.kernel), bias: Float32Array.from(layer.bias) };
    });
  }

  get inputSize(): number {
    return this.weights[0]!.layer.inputs;
  }

  predict(features: Float32Array): Prediction {
    if (features.length !== this.inputSize) {
      throw new RangeError(`Expected ${this.inputSize} features, got ${features.length}`);
    }
    let activations = features;
    for (const { layer, kernel, bias } of this.weights) activations = dense(activations, layer, kernel, bias);
    let best = 0;
    for (let j = 1; j < activations.length; j++) if (activations[j]! > activations[best]!) best = j;
    return {
      label: this.artifact.labels[best]!,
      probability: activations[best]!,
      probabilities: activations,
    };
  }
}
