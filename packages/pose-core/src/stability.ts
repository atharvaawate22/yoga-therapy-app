/**
 * Live-mode stability vote, ported from `_apply_stability` in
 * backend/yoga_pose_engine.py: a pose is only reported once it wins a
 * majority of the recent window, which stops the label flickering during
 * transitions. On the server the history lives in memory per session id;
 * here each live session owns an instance.
 */
import { NO_POSE } from "./corrections";

export class StabilityVote {
  private history: string[] = [];

  constructor(
    readonly window = 5,
    readonly minVotes = 3,
  ) {}

  /** Record this frame's candidate and return the pose to report. */
  push(candidate: string): string {
    this.history.push(candidate);
    if (this.history.length > this.window) this.history.shift();

    // Like collections.Counter.most_common(1): highest count, and among
    // equal counts the label seen first in the window.
    const counts = new Map<string, number>();
    for (const pose of this.history) counts.set(pose, (counts.get(pose) ?? 0) + 1);
    let best = NO_POSE;
    let bestCount = 0;
    for (const [pose, count] of counts) {
      if (count > bestCount) {
        best = pose;
        bestCount = count;
      }
    }
    return bestCount >= this.minVotes ? best : NO_POSE;
  }

  reset(): void {
    this.history = [];
  }
}
