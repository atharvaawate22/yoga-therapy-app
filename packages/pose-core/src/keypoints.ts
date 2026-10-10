/**
 * The MoveNet keypoint contract, mirrored from backend/utils/preprocessing.py.
 *
 * Python is the source of truth: the classifier was trained on features built
 * from this exact ordering. Golden parity fixtures (M3) check the port; until
 * then, keypoints.test.ts pins the values copied from the Python module.
 */

/** COCO-17 order, as MoveNet emits it. Index = position in the model output. */
export const KEYPOINT_NAMES = [
  "nose",
  "left_eye",
  "right_eye",
  "left_ear",
  "right_ear",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
] as const;

export type KeypointName = (typeof KEYPOINT_NAMES)[number];

export const NUM_KEYPOINTS = KEYPOINT_NAMES.length; // 17
/** (x, y) per keypoint, flattened: the classifier's input width. */
export const FEATURE_DIM = NUM_KEYPOINTS * 2; // 34

/** Named indices, so geometry reads as anatomy rather than magic numbers. */
export const KP = Object.fromEntries(
  KEYPOINT_NAMES.map((name, index) => [name, index]),
) as { readonly [K in KeypointName]: number };

/** Limb pairs for drawing the skeleton overlay. */
export const SKELETON_EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [0, 2], [1, 3], [2, 4], [0, 5], [0, 6],
  [5, 7], [7, 9], [6, 8], [8, 10], [5, 6], [5, 11],
  [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
];

/** Left/right index pairs that swap when a person is mirrored. */
export const MIRROR_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16],
];

/**
 * One detected keypoint in image space: origin top-left, y grows downward.
 * x and y must share one scale (a square model input), or the
 * scale-invariant features downstream are distorted.
 */
export interface Keypoint {
  readonly x: number;
  readonly y: number;
  readonly score: number;
}

/**
 * Convert MoveNet's raw output to keypoints.
 *
 * MoveNet emits (y, x, score) rows normalized to [0, 1] of its square input.
 * The axis swap is a classic silent bug, so like the Python side
 * (`extract_keypoints_pixels`) it happens in exactly one place.
 *
 * @param raw   flat `[17 * 3]` output, row-major (y, x, score)
 * @param side  pixel side of the padded square the model saw (1 = keep normalized)
 */
export function keypointsFromMoveNet(
  raw: ArrayLike<number>,
  side = 1,
): Keypoint[] {
  if (raw.length !== NUM_KEYPOINTS * 3) {
    throw new RangeError(
      `MoveNet output must have ${NUM_KEYPOINTS * 3} values, got ${raw.length}`,
    );
  }
  const keypoints: Keypoint[] = [];
  for (let i = 0; i < NUM_KEYPOINTS; i++) {
    const y = raw[i * 3]!;
    const x = raw[i * 3 + 1]!;
    const score = raw[i * 3 + 2]!;
    keypoints.push({ x: x * side, y: y * side, score });
  }
  return keypoints;
}
