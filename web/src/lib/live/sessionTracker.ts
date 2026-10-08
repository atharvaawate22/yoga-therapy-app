/**
 * What a live corrector session adds to the practice history, with the
 * APK's rules (PoseCorrectorScreen.js `finalizeLiveSession`): sessions under
 * 15 seconds, or with no pose ever recognised, aren't saved.
 */
export const MIN_SAVED_SESSION_SEC = 15;

export interface LiveSummary {
  durationSec: number;
  /** Distinct poses recognised during the session. */
  poseCount: number;
  /** The pose recognised in the most frames, if any. */
  topPose: string | null;
  /** Whether the session meets the bar for the practice history. */
  worthSaving: boolean;
}

export class SessionTracker {
  private startedAt: number | null = null;
  private counts = new Map<string, number>();

  start(nowMs: number): void {
    this.startedAt = nowMs;
    this.counts.clear();
  }

  get running(): boolean {
    return this.startedAt !== null;
  }

  /** Count a frame's reported pose ("nopose" isn't a pose). */
  frame(pose: string): void {
    if (this.startedAt === null || pose === "nopose") return;
    this.counts.set(pose, (this.counts.get(pose) ?? 0) + 1);
  }

  /** End the session. Returns null if it never started. */
  finish(nowMs: number): LiveSummary | null {
    if (this.startedAt === null) return null;
    const durationSec = Math.round((nowMs - this.startedAt) / 1000);
    this.startedAt = null;
    let topPose: string | null = null;
    let top = 0;
    for (const [pose, n] of this.counts) {
      if (n > top) {
        topPose = pose;
        top = n;
      }
    }
    return {
      durationSec,
      poseCount: this.counts.size,
      topPose,
      worthSaving: durationSec >= MIN_SAVED_SESSION_SEC && this.counts.size > 0,
    };
  }
}
