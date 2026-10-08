/**
 * Compare a browser MoveNet output with the server's for the same image.
 *
 * Both are raw (y, x, score) rows in fractions of the padded square, so the
 * coordinate error is directly in "fraction of the frame".
 */

/** Keypoints the server itself wasn't confident about are ignored. */
export const CONFIDENT_SCORE = 0.3;

export interface ParityResult {
  /** Mean |Δ| of x and y over keypoints the server was confident about. */
  meanCoordError: number;
  /** Largest |Δ| of x or y over those keypoints. */
  maxCoordError: number;
  /** Mean |Δ| of the confidence scores, over all keypoints. */
  meanScoreError: number;
  /** How many keypoints counted toward the coordinate errors. */
  confidentKeypoints: number;
}

export function compareRaw(browser: ArrayLike<number>, server: ArrayLike<number>): ParityResult {
  if (browser.length !== server.length || server.length % 3 !== 0) {
    throw new RangeError(`Output sizes differ: ${browser.length} vs ${server.length}`);
  }
  let coordSum = 0;
  let coordMax = 0;
  let coordCount = 0;
  let scoreSum = 0;
  const keypoints = server.length / 3;
  for (let k = 0; k < keypoints; k++) {
    const i = k * 3;
    scoreSum += Math.abs(browser[i + 2]! - server[i + 2]!);
    if (server[i + 2]! < CONFIDENT_SCORE) continue;
    for (const j of [i, i + 1]) {
      const d = Math.abs(browser[j]! - server[j]!);
      coordSum += d;
      coordMax = Math.max(coordMax, d);
    }
    coordCount++;
  }
  return {
    meanCoordError: coordCount ? coordSum / (coordCount * 2) : 0,
    maxCoordError: coordMax,
    meanScoreError: scoreSum / keypoints,
    confidentKeypoints: coordCount,
  };
}

/** Nearest-rank percentile of `values` (0-100). */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))]!;
}
