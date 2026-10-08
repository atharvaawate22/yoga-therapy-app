/**
 * MoveNet on LiteRT.js: the exact .tflite files the server runs
 * (backend/models), executed in the browser on WebGPU or WASM (XNNPack).
 */
import type { CompiledModel } from "@litertjs/core";
import { Letterboxer, rgbaToRgb } from "./letterbox";
import { INPUT_SIZE, type MoveNetVariant, type PoseEstimator } from "./types";

const WASM_DIR = "/litert/";

let loaded: { jspi: boolean; litert: Promise<typeof import("@litertjs/core")> } | null = null;

/**
 * Load LiteRT's WASM module, choosing the build per accelerator:
 * - WebGPU needs the JSPI build (the plain one fails with "Asyncify is not
 *   defined").
 * - On CPU the plain build is faster: in the lab, Thunder took 71 ms vs 96 ms
 *   and Lightning 12 ms vs 20 ms with the JSPI build.
 * Only one build can be loaded at a time, so switching reloads the module
 * (models compiled on the previous one become invalid).
 */
function loadRuntime(jspi: boolean) {
  if (loaded?.jspi !== jspi) {
    const previous = loaded?.litert;
    loaded = {
      jspi,
      litert: (async () => {
        const litert = await import("@litertjs/core");
        if (previous) {
          await previous.catch(() => undefined);
          litert.unloadLiteRt();
        }
        await litert.loadLiteRt(WASM_DIR, { jspi });
        return litert;
      })(),
    };
  }
  return loaded.litert;
}

/** Download progress: bytes so far, and the total when the server reports it. */
export type ProgressFn = (loaded: number, total: number | null) => void;

/** Fetch a model file, reporting progress (LiteRT accepts the bytes directly). */
async function fetchModel(url: string, onProgress?: ProgressFn): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Couldn't download ${url} (${response.status})`);
  const total = Number(response.headers.get("Content-Length")) || null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.(loaded, total);
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

export async function createLiteRtEstimator(
  variant: MoveNetVariant,
  accelerator: "wasm" | "webgpu",
  onProgress?: ProgressFn,
): Promise<PoseEstimator> {
  const { supportsFeature, isWebGPUSupported } = await import("@litertjs/core");
  if (accelerator === "webgpu") {
    if (!(await isWebGPUSupported())) throw new Error("WebGPU isn't available in this browser");
    if (!(await supportsFeature("jspi"))) {
      throw new Error("LiteRT's WebGPU path needs JSPI, which this browser lacks");
    }
  }
  const litert = await loadRuntime(accelerator === "webgpu");
  const bytes = await fetchModel(`/models/movenet_${variant}.tflite`, onProgress);
  const model: CompiledModel = await litert.loadAndCompile(bytes, { accelerator });
  const size = INPUT_SIZE[variant];
  const [input] = model.getInputDetails();
  if (input && (input.shape[1] !== size || input.dtype !== "float32")) {
    throw new Error(`Unexpected model input: ${input.dtype} ${Array.from(input.shape).join("x")}`);
  }
  const letterbox = new Letterboxer(size);
  const pixels = new Float32Array(size * size * 3);

  return {
    runtime: accelerator === "webgpu" ? "litert-webgpu" : "litert-wasm",
    variant,
    inputSize: size,
    async estimate(source, width, height) {
      const t0 = performance.now();
      // Float32 RGB in 0-255, unnormalized: what the server feeds MoveNet.
      rgbaToRgb(letterbox.draw(source, width, height), pixels);
      const t1 = performance.now();

      const cpuInput = new litert.Tensor(pixels, [1, size, size, 3]);
      const input = accelerator === "webgpu" ? await cpuInput.moveTo("webgpu") : cpuInput;
      const outputs = await model.run(input);
      input.delete();
      const output = outputs[0]!;
      const onCpu = output.accelerator === "wasm" ? output : await output.moveTo("wasm");
      const raw = new Float32Array(onCpu.toTypedArray() as Float32Array);
      onCpu.delete();
      for (const t of outputs) if (!t.deleted) t.delete();
      const t2 = performance.now();

      return { raw, timings: { preprocessMs: t1 - t0, inferenceMs: t2 - t1 } };
    },
    dispose() {
      model.delete();
    },
  };
}
