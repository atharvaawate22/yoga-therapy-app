/**
 * Geometry rules on top of the classifier, ported from
 * backend/utils/pose_rules.py (see there for why and how the thresholds were
 * chosen). Upward dog vs cobra: when cobra is the top class, the arms and legs
 * are near-straight and the hips and knees are off the floor (but the hips not
 * lunge-high), the answer becomes upward dog.
 */

export interface UpwardDogRule {
  upwardDogMinElbowDeg: number;
  upwardDogMinHipLift: number;
  upwardDogMinKneeLift: number;
  upwardDogMaxHipLift: number;
  upwardDogMinKneeDeg: number;
}

// (shoulder, elbow, wrist, hip, knee, ankle) per side, as indices into the
// 17 keypoints; features hold (x, y) pairs, so x = 2i and y = 2i + 1.
const SIDES = [
  [5, 7, 9, 11, 13, 15],
  [6, 8, 10, 12, 14, 16],
] as const;

function angleDeg(ax: number, ay: number, vx: number, vy: number, bx: number, by: number): number {
  const ux = ax - vx, uy = ay - vy, wx = bx - vx, wy = by - vy;
  const cos = (ux * wx + uy * wy) / (Math.hypot(ux, uy) * Math.hypot(wx, wy) + 1e-9);
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

export interface ProneLift {
  elbowDeg: number;
  hipLift: number;
  kneeLift: number;
}

/**
 * Elbow angle (degrees), hip lift and knee lift averaged over both sides, from
 * one normalized feature vector. The floor is the line through the wrist and
 * ankle; lift is height above it in units of shoulder-to-hip length.
 */
export function proneLift(features: ArrayLike<number>): ProneLift {
  const p = (i: number) => [features[2 * i]!, features[2 * i + 1]!] as const;
  let elbowDeg = 0;
  let hipLift = 0;
  let kneeLift = 0;
  for (const [sh, el, wr, hip, kn, an] of SIDES) {
    const [shx, shy] = p(sh);
    const [elx, ely] = p(el);
    const [wrx, wry] = p(wr);
    const [hx, hy] = p(hip);
    const [kx, ky] = p(kn);
    const [ax, ay] = p(an);

    elbowDeg += angleDeg(shx, shy, elx, ely, wrx, wry);

    const flx = ax - wrx, fly = ay - wry;
    let nx = fly, ny = -flx;
    const norm = Math.hypot(nx, ny) + 1e-9;
    nx /= norm;
    ny /= norm;
    // Point the normal up the image (image y grows downward).
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const torso = Math.hypot(shx - hx, shy - hy) + 1e-9;
    hipLift += ((hx - wrx) * nx + (hy - wry) * ny) / torso;
    kneeLift += ((kx - wrx) * nx + (ky - wry) * ny) / torso;
  }
  return { elbowDeg: elbowDeg / 2, hipLift: hipLift / 2, kneeLift: kneeLift / 2 };
}

/** The more bent of the two knees (hip-knee-ankle angle, degrees). */
export function minKneeAngle(features: ArrayLike<number>): number {
  const f = (i: number) => features[i]!;
  return Math.min(
    ...SIDES.map(([, , , hip, kn, an]) =>
      angleDeg(f(2 * hip), f(2 * hip + 1), f(2 * kn), f(2 * kn + 1), f(2 * an), f(2 * an + 1)),
    ),
  );
}

export function looksLikeUpwardDog(features: ArrayLike<number>, rule: UpwardDogRule): boolean {
  const { elbowDeg, hipLift, kneeLift } = proneLift(features);
  return (
    elbowDeg >= rule.upwardDogMinElbowDeg &&
    hipLift >= rule.upwardDogMinHipLift &&
    hipLift <= rule.upwardDogMaxHipLift &&
    kneeLift >= rule.upwardDogMinKneeLift &&
    minKneeAngle(features) >= rule.upwardDogMinKneeDeg
  );
}

/**
 * Returns `probabilities` with the rule applied: where cobra is the top class
 * and the body is lifted, the cobra and upward-dog values swap.
 */
export function applyPoseRules(
  features: ArrayLike<number>,
  probabilities: Float32Array,
  labels: readonly string[],
  rule: UpwardDogRule,
): Float32Array {
  const out = Float32Array.from(probabilities);
  const cobra = labels.indexOf("cobra_pose");
  const updog = labels.indexOf("upward_dog");
  if (cobra < 0 || updog < 0) return out;
  let best = 0;
  for (let j = 1; j < out.length; j++) if (out[j]! > out[best]!) best = j;
  if (best === cobra && looksLikeUpwardDog(features, rule)) {
    [out[cobra], out[updog]] = [out[updog]!, out[cobra]!];
  }
  return out;
}
