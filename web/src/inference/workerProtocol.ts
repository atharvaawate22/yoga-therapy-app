import type { MoveNetVariant, StageTimings } from "./types";

/** Page -> worker. */
export type WorkerRequest =
  | { type: "init"; variant: MoveNetVariant; accelerator: "wasm" | "webgpu" }
  | { type: "estimate"; id: number; bitmap: ImageBitmap }
  | { type: "dispose" };

/** Worker -> page. */
export type WorkerResponse =
  | { type: "progress"; loaded: number; total: number | null }
  | { type: "ready" }
  | { type: "init-error"; message: string }
  | { type: "result"; id: number; raw: Float32Array; timings: StageTimings }
  | { type: "result-error"; id: number; message: string };
