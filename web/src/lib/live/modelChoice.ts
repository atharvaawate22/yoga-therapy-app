import type { MoveNetVariant } from "@/inference/types";

export interface LiveModelChoice {
  variant: MoveNetVariant;
  accelerator: "wasm" | "webgpu";
  /** Why this was picked, for the debug overlay. */
  reason: string;
}

export interface DeviceInfo {
  /** Touch-first, phone-sized screen. */
  isPhone: boolean;
  webgpu: boolean;
  /** WebGPU in LiteRT also needs JSPI. */
  jspi: boolean;
}

/**
 * Which MoveNet to run live (plan decision #1, measured in M2/M3):
 *
 * - Desktop: Thunder, the more accurate model (served-result parity 32/32).
 *   WebGPU where LiteRT can use it (39-43 ms vs 66-112 ms on WASM), else WASM.
 * - Phone: Lightning with its own classifier head (31/32), on WASM, which
 *   beat WebGPU for this small model on desktop (12-20 ms vs 24-36 ms).
 *
 * Phone numbers are still to be measured on real devices. `?model=` and
 * `?accel=` override the choice so that benchmark can compare options.
 */
export function chooseLiveModel(device: DeviceInfo, params?: URLSearchParams): LiveModelChoice {
  const gpuOk = device.webgpu && device.jspi;
  let choice: LiveModelChoice = device.isPhone
    ? { variant: "lightning", accelerator: "wasm", reason: "phone: Lightning on CPU" }
    : gpuOk
      ? { variant: "thunder", accelerator: "webgpu", reason: "desktop: Thunder on WebGPU" }
      : { variant: "thunder", accelerator: "wasm", reason: "desktop: Thunder on CPU (no WebGPU)" };

  const model = params?.get("model");
  if (model === "thunder" || model === "lightning") {
    choice = { ...choice, variant: model, reason: `${choice.reason}; model overridden` };
  }
  const accel = params?.get("accel");
  if (accel === "wasm" || (accel === "webgpu" && gpuOk)) {
    choice = { ...choice, accelerator: accel, reason: `${choice.reason}; accelerator overridden` };
  }
  return choice;
}

/** Best-effort device detection in the browser. */
export async function detectDevice(): Promise<DeviceInfo> {
  const isPhone =
    window.matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 900;
  const webgpu = "gpu" in navigator && Boolean(await navigator.gpu?.requestAdapter().catch(() => null));
  const jspi = typeof (WebAssembly as unknown as { Suspending?: unknown }).Suspending === "function";
  return { isPhone, webgpu, jspi };
}
