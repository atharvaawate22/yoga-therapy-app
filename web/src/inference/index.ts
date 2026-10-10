import type { ProgressFn } from "./litert";
import type { MoveNetVariant, PoseEstimator, RuntimeId } from "./types";

export * from "./types";
export type { ProgressFn } from "./litert";

/** Create an estimator; runtime code is only downloaded when chosen. */
export async function createEstimator(
  runtime: RuntimeId,
  variant: MoveNetVariant,
  onProgress?: ProgressFn,
): Promise<PoseEstimator> {
  switch (runtime) {
    case "litert-wasm":
    case "litert-webgpu": {
      const { createLiteRtEstimator } = await import("./litert");
      return createLiteRtEstimator(variant, runtime === "litert-webgpu" ? "webgpu" : "wasm", onProgress);
    }
    case "tfjs-webgl":
    case "tfjs-webgpu": {
      const { createTfjsEstimator } = await import("./tfjs");
      return createTfjsEstimator(variant, runtime === "tfjs-webgpu" ? "webgpu" : "webgl");
    }
  }
}
