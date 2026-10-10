/// <reference lib="webworker" />
/**
 * Runs MoveNet off the main thread. The page sends video frames as
 * ImageBitmaps (transferred, not copied); this worker letterboxes them on an
 * OffscreenCanvas, runs LiteRT and posts back the raw output. On CPU, an
 * inference took 70 ms on a desktop (a long task every frame); on a phone
 * it would delay every tap by that much if it ran on the main thread.
 */
import { createLiteRtEstimator } from "./litert";
import type { PoseEstimator } from "./types";
import type { WorkerRequest, WorkerResponse } from "./workerProtocol";

const scope = self as unknown as DedicatedWorkerGlobalScope;
let estimator: PoseEstimator | null = null;

// LiteRT's Emscripten loader locates its .wasm next to the *running script*,
// which in a worker is Turbopack's chunk (/_next/static/chunks/), not the
// /litert/ directory it was loaded from, and LiteRT exposes no locateFile
// option. Send those requests to /litert/, where the files are served.
const realFetch = scope.fetch.bind(scope);
scope.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input), scope.location.href);
  const wasm = /\/(litert_wasm\w*\.wasm)$/.exec(url.pathname);
  return realFetch(wasm ? `/litert/${wasm[1]}` : input, init);
};

const reply = (message: WorkerResponse, transfer: Transferable[] = []) => scope.postMessage(message, transfer);

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type === "init") {
    try {
      estimator = await createLiteRtEstimator(message.variant, message.accelerator, (loaded, total) =>
        reply({ type: "progress", loaded, total }),
      );
      reply({ type: "ready" });
    } catch (error) {
      reply({ type: "init-error", message: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (message.type === "estimate") {
    const { id, bitmap } = message;
    try {
      if (!estimator) throw new Error("Model not loaded");
      const { raw, timings } = await estimator.estimate(bitmap, bitmap.width, bitmap.height);
      reply({ type: "result", id, raw, timings }, [raw.buffer]);
    } catch (error) {
      reply({ type: "result-error", id, message: error instanceof Error ? error.message : String(error) });
    } finally {
      bitmap.close();
    }
    return;
  }
  if (message.type === "dispose") {
    estimator?.dispose();
    estimator = null;
  }
};
