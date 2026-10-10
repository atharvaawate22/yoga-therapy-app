/**
 * A PoseEstimator whose inference runs in a Web Worker (pose.worker.ts).
 * The page only grabs each frame as an ImageBitmap (a millisecond or two)
 * and hands it over; the main thread stays free for taps and drawing.
 */
import type { ProgressFn } from "./litert";
import { INPUT_SIZE, type MoveNetVariant, type PoseEstimator, type StageTimings } from "./types";
import type { WorkerRequest, WorkerResponse } from "./workerProtocol";

/** Whether this browser can run the worker path (else stay on the main thread). */
export function workerSupported(): boolean {
  return typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap === "function";
}

export async function createWorkerEstimator(
  variant: MoveNetVariant,
  accelerator: "wasm" | "webgpu",
  onProgress?: ProgressFn,
): Promise<PoseEstimator> {
  const worker = new Worker(new URL("./pose.worker.ts", import.meta.url), { type: "module" });
  const send = (message: WorkerRequest, transfer: Transferable[] = []) => worker.postMessage(message, transfer);
  const pending = new Map<number, { resolve: (r: { raw: Float32Array; timings: StageTimings }) => void; reject: (e: Error) => void }>();
  let nextId = 0;

  await new Promise<void>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      switch (message.type) {
        case "progress":
          onProgress?.(message.loaded, message.total);
          break;
        case "ready":
          resolve();
          break;
        case "init-error":
          worker.terminate();
          reject(new Error(message.message));
          break;
        case "result":
          pending.get(message.id)?.resolve({ raw: message.raw, timings: message.timings });
          pending.delete(message.id);
          break;
        case "result-error":
          pending.get(message.id)?.reject(new Error(message.message));
          pending.delete(message.id);
          break;
      }
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "The pose worker failed to start"));
    };
    send({ type: "init", variant, accelerator });
  });

  return {
    runtime: accelerator === "webgpu" ? "litert-webgpu" : "litert-wasm",
    variant,
    inputSize: INPUT_SIZE[variant],
    async estimate(source) {
      const t0 = performance.now();
      const bitmap = await createImageBitmap(source);
      const capture = performance.now() - t0;
      const id = nextId++;
      const result = await new Promise<{ raw: Float32Array; timings: StageTimings }>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        send({ type: "estimate", id, bitmap }, [bitmap]);
      });
      // Frame capture counts as pre-processing.
      return { raw: result.raw, timings: { ...result.timings, preprocessMs: result.timings.preprocessMs + capture } };
    },
    dispose() {
      send({ type: "dispose" });
      worker.terminate();
      for (const { reject } of pending.values()) reject(new Error("Estimator disposed"));
      pending.clear();
    },
  };
}
