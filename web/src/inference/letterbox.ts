/**
 * Pre-processing that mirrors the server (backend/utils/preprocessing.py
 * `pad_to_square` + movenet.py `infer`): pad the frame to a centred square
 * with grey (114) borders, never cropping, then resize to the model input.
 *
 * Padding first and resizing second is the same geometry as resizing into a
 * square canvas at an offset, which is what the browser does. Coordinates
 * MoveNet returns are fractions of that padded square on both sides.
 */

export const PAD_VALUE = 114;

export interface LetterboxRect {
  /** Where the frame lands inside the `size` x `size` model input. */
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/**
 * Mirrors pad_to_square's integer split: the extra rows/columns go
 * floor(pad / 2) before the image and the rest after, at full resolution,
 * then everything scales by size / side.
 */
export function letterboxRect(width: number, height: number, size: number): LetterboxRect {
  const side = Math.max(width, height);
  const scale = size / side;
  const left = Math.floor((side - width) / 2);
  const top = Math.floor((side - height) / 2);
  return { dx: left * scale, dy: top * scale, dw: width * scale, dh: height * scale };
}

/** RGBA pixels -> interleaved RGB, as the model wants. */
export function rgbaToRgb<T extends Float32Array | Int32Array>(rgba: Uint8ClampedArray, out: T): T {
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    out[j] = rgba[i]!;
    out[j + 1] = rgba[i + 1]!;
    out[j + 2] = rgba[i + 2]!;
  }
  return out;
}

/** Reusable canvas that letterboxes any image or video frame. */
export class Letterboxer {
  private readonly canvas: OffscreenCanvas | HTMLCanvasElement;
  private readonly ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

  constructor(readonly size: number) {
    this.canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(size, size)
        : Object.assign(document.createElement("canvas"), { width: size, height: size });
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("2D canvas unavailable");
    this.ctx = ctx as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  }

  /** Draw `source` padded into the square and return its RGBA pixels. */
  draw(source: CanvasImageSource, width: number, height: number): Uint8ClampedArray {
    const { ctx, size } = this;
    ctx.fillStyle = `rgb(${PAD_VALUE},${PAD_VALUE},${PAD_VALUE})`;
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    // Closest canvas equivalent of OpenCV's INTER_AREA when downscaling.
    ctx.imageSmoothingQuality = "high";
    const { dx, dy, dw, dh } = letterboxRect(width, height, size);
    ctx.drawImage(source, dx, dy, dw, dh);
    return ctx.getImageData(0, 0, size, size).data;
  }
}

/**
 * Map a MoveNet coordinate (fraction of the padded square) back to pixels of
 * the original frame, e.g. to draw the skeleton over the video.
 */
export function toFramePoint(
  xFraction: number,
  yFraction: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const side = Math.max(width, height);
  const left = Math.floor((side - width) / 2);
  const top = Math.floor((side - height) / 2);
  return { x: xFraction * side - left, y: yFraction * side - top };
}
