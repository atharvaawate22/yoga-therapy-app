import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FEATURE_DIM,
  KEYPOINT_NAMES,
  KP,
  MIRROR_PAIRS,
  NUM_KEYPOINTS,
  SKELETON_EDGES,
  keypointsFromMoveNet,
} from "./index";

// The Python module the classifier was trained with. Reading the constants
// straight from it means a change on either side fails here, until the
// golden parity fixtures (M3) take over.
const PREPROCESSING_PY = readFileSync(
  fileURLToPath(new URL("../../../backend/utils/preprocessing.py", import.meta.url)),
  "utf8",
);

/** Body of a top-level `NAME = ( ... )` tuple assignment. */
function pythonTupleBody(name: string): string {
  const match = new RegExp(`^${name} = \\(([\\s\\S]*?)^\\)`, "m").exec(
    PREPROCESSING_PY,
  );
  if (!match?.[1]) throw new Error(`${name} not found in preprocessing.py`);
  return match[1];
}

function pythonIntPairs(name: string): number[][] {
  return [...pythonTupleBody(name).matchAll(/\((\d+),\s*(\d+)\)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);
}

describe("keypoint contract matches backend/utils/preprocessing.py", () => {
  it("keypoint names and order", () => {
    const pythonNames = [...pythonTupleBody("KEYPOINT_NAMES").matchAll(/"(\w+)"/g)].map(
      (m) => m[1],
    );
    expect(KEYPOINT_NAMES).toEqual(pythonNames);
  });

  it("feature width", () => {
    expect(NUM_KEYPOINTS).toBe(17);
    expect(FEATURE_DIM).toBe(34);
    expect(PREPROCESSING_PY).toMatch(/^FEATURE_DIM = NUM_KEYPOINTS \* 2/m);
  });

  it("skeleton edges", () => {
    expect(SKELETON_EDGES).toEqual(pythonIntPairs("SKELETON_EDGES"));
  });

  it("mirror pairs", () => {
    // MIRROR_PAIRS is a one-line tuple of tuples in Python.
    const line = /^MIRROR_PAIRS = \((.*)\)$/m.exec(PREPROCESSING_PY)?.[1] ?? "";
    const pairs = [...line.matchAll(/\((\d+),\s*(\d+)\)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    expect(pairs.length).toBeGreaterThan(0);
    expect(MIRROR_PAIRS).toEqual(pairs);
  });

  it("named indices used by the rules", () => {
    expect([KP.left_shoulder, KP.right_shoulder, KP.left_hip, KP.right_hip]).toEqual([
      5, 6, 11, 12,
    ]);
  });
});

describe("keypointsFromMoveNet", () => {
  const raw = Array.from({ length: 51 }, (_, i) => i / 100);

  it("swaps MoveNet's (y, x) to (x, y)", () => {
    const [first, second] = keypointsFromMoveNet(raw);
    expect(first).toEqual({ x: 0.01, y: 0, score: 0.02 });
    expect(second).toEqual({ x: 0.04, y: 0.03, score: 0.05 });
  });

  it("scales coordinates but not scores", () => {
    const [, second] = keypointsFromMoveNet(raw, 256);
    expect(second?.x).toBeCloseTo(0.04 * 256);
    expect(second?.y).toBeCloseTo(0.03 * 256);
    expect(second?.score).toBe(0.05);
  });

  it("rejects output of the wrong size", () => {
    expect(() => keypointsFromMoveNet([1, 2, 3])).toThrow(RangeError);
  });
});
