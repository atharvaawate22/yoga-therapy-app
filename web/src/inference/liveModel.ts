/**
 * The model behind the live corrector: the chosen MoveNet variant on the
 * chosen accelerator, paired with that variant's own classifier head.
 * Cached per choice for the page's lifetime.
 */
import { PoseClassifier, type ClassifierArtifact } from "pose-core";
import lightningArtifact from "pose-core/models/classifier.lightning.json";
import thunderArtifact from "pose-core/models/classifier.thunder.json";
import type { LiveModelChoice } from "@/lib/live/modelChoice";
import { requestPersistentStorage } from "@/lib/pwa/offline";
import { createEstimator, type ProgressFn } from "./index";
import type { MoveNetVariant, PoseEstimator } from "./types";

export interface LiveModel {
  estimator: PoseEstimator;
  classifier: PoseClassifier;
}

const ARTIFACTS: Record<MoveNetVariant, ClassifierArtifact> = {
  thunder: thunderArtifact as ClassifierArtifact,
  lightning: lightningArtifact as ClassifierArtifact,
};

const cache = new Map<string, Promise<LiveModel>>();

export function loadLiveModel(choice: LiveModelChoice, onProgress?: ProgressFn): Promise<LiveModel> {
  const key = `${choice.variant}/${choice.accelerator}`;
  let model = cache.get(key);
  if (!model) {
    model = (async () => {
      const runtime = choice.accelerator === "webgpu" ? "litert-webgpu" : "litert-wasm";
      const estimator = await createEstimator(runtime, choice.variant, onProgress);
      requestPersistentStorage(); // keep the now-cached model from being evicted
      return { estimator, classifier: new PoseClassifier(ARTIFACTS[choice.variant]) };
    })();
    model.catch(() => cache.delete(key)); // allow a retry
    cache.set(key, model);
  }
  return model;
}
