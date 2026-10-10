/**
 * MoveNet on TensorFlow.js: Google's MoveNet v4 graph model from TF Hub.
 *
 * Deliberately not @tensorflow-models/pose-detection: that wrapper crops
 * around the previous frame's body and smooths keypoints over time, which
 * the classifier never saw in training. This feeds the model the same
 * padded square the server does.
 */
import { Letterboxer, rgbaToRgb } from "./letterbox";
import { INPUT_SIZE, type MoveNetVariant, type PoseEstimator } from "./types";

const MODEL_URL: Record<MoveNetVariant, string> = {
  lightning: "https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4",
  thunder: "https://tfhub.dev/google/tfjs-model/movenet/singlepose/thunder/4",
};

export async function createTfjsEstimator(
  variant: MoveNetVariant,
  backend: "webgl" | "webgpu",
): Promise<PoseEstimator> {
  const tf = await import("@tensorflow/tfjs");
  if (backend === "webgpu") await import("@tensorflow/tfjs-backend-webgpu");
  if (!(await tf.setBackend(backend))) throw new Error(`TF.js ${backend} backend unavailable`);
  await tf.ready();

  const model = await tf.loadGraphModel(MODEL_URL[variant], { fromTFHub: true });
  const size = INPUT_SIZE[variant];
  const letterbox = new Letterboxer(size);
  const pixels = new Int32Array(size * size * 3);

  return {
    runtime: backend === "webgpu" ? "tfjs-webgpu" : "tfjs-webgl",
    variant,
    inputSize: size,
    async estimate(source, width, height) {
      const t0 = performance.now();
      // The TF.js MoveNet graph takes int32 RGB in 0-255.
      rgbaToRgb(letterbox.draw(source, width, height), pixels);
      const t1 = performance.now();

      const input = tf.tensor(pixels, [1, size, size, 3], "int32");
      const output = model.execute(input) as import("@tensorflow/tfjs").Tensor;
      const raw = new Float32Array(await output.data());
      input.dispose();
      output.dispose();
      const t2 = performance.now();

      return { raw, timings: { preprocessMs: t1 - t0, inferenceMs: t2 - t1 } };
    },
    dispose() {
      model.dispose();
    },
  };
}
