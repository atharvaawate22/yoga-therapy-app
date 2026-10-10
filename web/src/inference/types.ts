export type MoveNetVariant = "lightning" | "thunder";

/** Input side length per variant (read from the .tflite files' input details). */
export const INPUT_SIZE: Record<MoveNetVariant, number> = { lightning: 192, thunder: 256 };

export type RuntimeId = "litert-wasm" | "litert-webgpu" | "tfjs-webgl" | "tfjs-webgpu";

export const RUNTIMES: ReadonlyArray<{ id: RuntimeId; label: string; note: string }> = [
  { id: "litert-wasm", label: "LiteRT.js · WASM", note: "Same .tflite as the server, CPU" },
  { id: "litert-webgpu", label: "LiteRT.js · WebGPU", note: "Same .tflite as the server, GPU" },
  { id: "tfjs-webgl", label: "TF.js · WebGL", note: "MoveNet v4 graph model (TF Hub)" },
  { id: "tfjs-webgpu", label: "TF.js · WebGPU", note: "MoveNet v4 graph model (TF Hub)" },
];

export interface StageTimings {
  /** Letterboxing and pixel conversion. */
  preprocessMs: number;
  /** Model execution, including reading the output back. */
  inferenceMs: number;
}

export interface PoseEstimator {
  readonly runtime: RuntimeId;
  readonly variant: MoveNetVariant;
  readonly inputSize: number;
  /**
   * MoveNet's raw output for one frame: 17 rows of (y, x, score), with y and
   * x as fractions of the padded square (same layout as the server's
   * `MoveNetRuntime.infer`).
   */
  estimate(
    source: CanvasImageSource,
    width: number,
    height: number,
  ): Promise<{ raw: Float32Array; timings: StageTimings }>;
  dispose(): void;
}
