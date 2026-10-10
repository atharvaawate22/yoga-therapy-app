import { describe, expect, it } from "vitest";
import { letterboxRect, rgbaToRgb, toFramePoint } from "./letterbox";
import { compareRaw, percentile } from "./parity";

describe("letterboxRect", () => {
  it("centres a portrait frame with side padding, never cropping", () => {
    // 300x600 -> 600x600 square, 150 px of padding each side, scaled to 256.
    expect(letterboxRect(300, 600, 256)).toEqual({ dx: 64, dy: 0, dw: 128, dh: 256 });
  });

  it("centres a landscape frame vertically", () => {
    expect(letterboxRect(1280, 720, 256)).toEqual({ dx: 0, dy: 56, dw: 256, dh: 144 });
  });

  it("splits odd padding like pad_to_square (smaller half first)", () => {
    // 3 px of padding: 1 before, 2 after, at full resolution.
    const rect = letterboxRect(10, 13, 13);
    expect(rect.dx).toBe(1);
    expect(rect.dw).toBe(10);
  });

  it("leaves a square frame untouched", () => {
    expect(letterboxRect(500, 500, 192)).toEqual({ dx: 0, dy: 0, dw: 192, dh: 192 });
  });
});

describe("toFramePoint", () => {
  it("inverts the letterbox: square fractions back to frame pixels", () => {
    // Portrait 300x600: the frame spans x fractions 0.25-0.75 of the square.
    expect(toFramePoint(0.25, 0, 300, 600)).toEqual({ x: 0, y: 0 });
    expect(toFramePoint(0.75, 1, 300, 600)).toEqual({ x: 300, y: 600 });
    expect(toFramePoint(0.5, 0.5, 300, 600)).toEqual({ x: 150, y: 300 });
  });
});

describe("rgbaToRgb", () => {
  it("drops alpha and keeps channel order", () => {
    const out = rgbaToRgb(new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 0]), new Float32Array(6));
    expect(Array.from(out)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("compareRaw", () => {
  const server = [
    0.5, 0.5, 0.9, // confident
    0.2, 0.3, 0.1, // not confident: ignored for coordinates
  ];

  it("measures coordinate error on confident keypoints only", () => {
    const browser = [0.52, 0.47, 0.8, 0.9, 0.9, 0.2];
    const result = compareRaw(browser, server);
    expect(result.confidentKeypoints).toBe(1);
    expect(result.meanCoordError).toBeCloseTo(0.025);
    expect(result.maxCoordError).toBeCloseTo(0.03);
    expect(result.meanScoreError).toBeCloseTo(0.1);
  });

  it("is zero for identical outputs", () => {
    expect(compareRaw(server, server)).toMatchObject({ meanCoordError: 0, maxCoordError: 0, meanScoreError: 0 });
  });

  it("rejects mismatched sizes", () => {
    expect(() => compareRaw([1, 2, 3], server)).toThrow(RangeError);
  });
});

describe("percentile", () => {
  it("uses nearest rank", () => {
    const values = [5, 1, 4, 2, 3];
    expect(percentile(values, 50)).toBe(3);
    expect(percentile(values, 95)).toBe(5);
    expect(percentile(values, 0)).toBe(1);
    expect(percentile([], 50)).toBeNaN();
  });
});
