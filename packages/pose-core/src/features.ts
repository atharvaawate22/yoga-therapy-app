/**
 * Keypoints -> classifier input, ported from backend/utils/preprocessing.py
 * (`normalize_keypoints`, `has_body`). Tests hold it to the Python output on
 * the lab fixtures.
 */
import { FEATURE_DIM, KP, NUM_KEYPOINTS, type Keypoint } from "./keypoints";

export interface BodyGate {
  coreMinScore: number;
  majorMinScore: number;
  minMajorVisible: number;
  coreKeypoints: readonly number[];
  majorKeypoints: readonly number[];
}

/**
 * Flatten keypoints into a translation- and scale-invariant 34-vector:
 * origin at the hip midpoint, unit = the wider of shoulder width and hip
 * width. A degenerate torso falls back to the keypoint bounding box.
 */
export function normalizeKeypoints(keypoints: readonly Keypoint[]): Float32Array {
  if (keypoints.length !== NUM_KEYPOINTS) {
    throw new RangeError(`Expected ${NUM_KEYPOINTS} keypoints, got ${keypoints.length}`);
  }
  const lh = keypoints[KP.left_hip]!;
  const rh = keypoints[KP.right_hip]!;
  const ls = keypoints[KP.left_shoulder]!;
  const rs = keypoints[KP.right_shoulder]!;
  const midX = (lh.x + rh.x) / 2;
  const midY = (lh.y + rh.y) / 2;

  let torso = Math.max(Math.hypot(ls.x - rs.x, ls.y - rs.y), Math.hypot(lh.x - rh.x, lh.y - rh.y));
  if (torso < 1e-6) {
    const xs = keypoints.map((k) => k.x);
    const ys = keypoints.map((k) => k.y);
    torso = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
  }

  const features = new Float32Array(FEATURE_DIM);
  keypoints.forEach((k, i) => {
    features[i * 2] = (k.x - midX) / torso;
    features[i * 2 + 1] = (k.y - midY) / torso;
  });
  return features;
}

/**
 * Whether enough of a body is visible to classify: a confident torso (both
 * shoulders and hips) plus most of the major landmarks.
 */
export function hasBody(keypoints: readonly Keypoint[], gate: BodyGate): boolean {
  const coreVisible = gate.coreKeypoints.every((i) => keypoints[i]!.score >= gate.coreMinScore);
  const majorVisible = gate.majorKeypoints.filter(
    (i) => keypoints[i]!.score >= gate.majorMinScore,
  ).length;
  return coreVisible && majorVisible >= gate.minMajorVisible;
}
