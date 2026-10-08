/**
 * Live-mode stability votes: a pose is only reported once it wins a
 * majority of the recent frames, which stops the label flickering during
 * transitions.
 */
import { NO_POSE } from "./corrections";

/** Anything that turns per-frame candidates into a reported pose. */
export interface Vote {
  /** Record this frame's candidate (at `timeMs`) and return the pose to report. */
  push(candidate: string, timeMs?: number): string;
  reset(): void;
}

/**
 * Like collections.Counter.most_common(1): the highest count, and among
 * equal counts the label seen first.
 */
function mostCommon(labels: readonly string[]): { label: string; count: number } {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  let label = NO_POSE;
  let count = 0;
  for (const [candidate, n] of counts) {
    if (n > count) {
      label = candidate;
      count = n;
    }
  }
  return { label, count };
}

/**
 * The server's vote, ported from `_apply_stability` in
 * backend/yoga_pose_engine.py: at least `minVotes` of the last `window`
 * frames. The server tuned 3-of-5 for the APK's rate of under one frame a
 * second; the parity fixtures hold this class to it exactly.
 */
export class StabilityVote implements Vote {
  private history: string[] = [];

  constructor(
    readonly window = 5,
    readonly minVotes = 3,
  ) {}

  push(candidate: string): string {
    this.history.push(candidate);
    if (this.history.length > this.window) this.history.shift();
    const { label, count } = mostCommon(this.history);
    return count >= this.minVotes ? label : NO_POSE;
  }

  reset(): void {
    this.history = [];
  }
}

/**
 * The same majority rule over a window of *time*, for in-browser inference.
 *
 * At 10+ frames a second, 5 frames is half a second, so a frame-count vote
 * would flicker far more than the APK does. This keeps the frames from the
 * last `windowMs` and reports the most common label when it holds at least
 * `minShare` of them and at least `minFrames` frames. The defaults (1.2 s,
 * 60%, 3 frames) mirror the server's 3-of-5 share over roughly the span the
 * APK's vote covered.
 *
 * It never keeps fewer than the server's 5 frames (`minHistory`), so a slow
 * device, where the time window would hold only a frame or two, gets exactly
 * the server's 3-of-5 rule instead of never reporting a pose.
 */
export class TimeWindowVote implements Vote {
  private frames: Array<{ t: number; label: string }> = [];

  constructor(
    readonly windowMs = 1200,
    readonly minShare = 0.6,
    readonly minFrames = 3,
    readonly minHistory = 5,
  ) {}

  push(candidate: string, timeMs: number = performance.now()): string {
    this.frames.push({ t: timeMs, label: candidate });
    const cutoff = timeMs - this.windowMs;
    while (this.frames.length > this.minHistory && this.frames[0]!.t < cutoff) this.frames.shift();
    const { label, count } = mostCommon(this.frames.map((f) => f.label));
    return count >= this.minFrames && count >= this.minShare * this.frames.length ? label : NO_POSE;
  }

  reset(): void {
    this.frames = [];
  }
}
