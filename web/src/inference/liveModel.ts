/**
 * The model behind the live corrector: the chosen MoveNet variant on the
 * chosen accelerator, paired with that variant's own classifier head.
 * Cached per choice for the page's lifetime.
 */
import { PoseClassifier, type ClassifierArtifact } from "pose-core";
import type { LiveModelChoice } from "@/lib/live/modelChoice";
import { requestPersistentStorage } from "@/lib/pwa/offline";
import { createEstimator, type ProgressFn } from "./index";
import { createWorkerEstimator, workerSupported } from "./workerEstimator";
import type { MoveNetVariant, PoseEstimator } from "./types";

export interface LiveModel {
  estimator: PoseEstimator;
  classifier: PoseClassifier;
}

// Classifier weights (~65 KB of JSON each) load with the model, not with
// the page: parsing both up front cost the corrector ~100 ms of main thread.
const ARTIFACTS: Record<MoveNetVariant, () => Promise<{ default: unknown }>> = {
  thunder: () => import("pose-core/models/classifier.thunder.json"),
  lightning: () => import("pose-core/models/classifier.lightning.json"),
};

const cache = new Map<string, Promise<LiveModel>>();

/**
 * Runs inference in a Web Worker where the browser supports it (keeping
 * taps responsive while every frame is analysed), else on the main thread.
 * `?worker=0` forces the main thread, for comparison.
 */
function inferInWorker(): boolean {
  return workerSupported() && new URLSearchParams(window.location.search).get("worker") !== "0";
}

export function loadLiveModel(choice: LiveModelChoice, onProgress?: ProgressFn): Promise<LiveModel> {
  const inWorker = inferInWorker();
  const key = `${choice.variant}/${choice.accelerator}/${inWorker ? "worker" : "main"}`;
  let model = cache.get(key);
  if (!model) {
    model = (async () => {
      const runtime = choice.accelerator === "webgpu" ? "litert-webgpu" : "litert-wasm";
      const createInWorker = () => createWorkerEstimator(choice.variant, choice.accelerator, onProgress);
      const createOnMain = () => createEstimator(runtime, choice.variant, onProgress);
      const create = inWorker ? () => createInWorker().catch(createOnMain) : createOnMain;
      // A worker that can't start falls back to the main thread; WebGPU that
      // fails to initialise (driver quirks are common) falls back to CPU.
      const withCpuFallback = () =>
        create().catch((error: unknown) => {
          if (choice.accelerator !== "webgpu") throw error;
          return loadLiveModel({ ...choice, accelerator: "wasm", reason: `${choice.reason}; WebGPU failed` }, onProgress).then(
            (fallback) => fallback.estimator,
          );
        });
      const [estimator, artifact] = await Promise.all([withCpuFallback(), ARTIFACTS[choice.variant]()]);
      requestPersistentStorage(); // keep the now-cached model from being evicted
      return { estimator, classifier: new PoseClassifier(artifact.default as ClassifierArtifact) };
    })();
    model.catch(() => cache.delete(key)); // allow a retry
    cache.set(key, model);
  }
  return model;
}
