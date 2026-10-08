/**
 * When to say a correction out loud during live practice.
 *
 * The APK analysed under one frame a second and spoke whenever the top cue
 * changed. At 10+ frames a second that would chatter, cutting itself off
 * mid-sentence. So a cue must hold steady for `stableMs` before it is
 * spoken, utterances are at least `minGapMs` apart, and (like the APK) the
 * same message is never repeated back to back.
 */
export interface SpeechCoachOptions {
  stableMs?: number;
  minGapMs?: number;
  /** Spoken name for a pose label (e.g. "Tree Pose"). */
  poseName?: (label: string) => string;
}

const NO_POSE = "nopose";

export class SpeechCoach {
  private readonly stableMs: number;
  private readonly minGapMs: number;
  private readonly poseName: (label: string) => string;
  private candidate: { key: string; since: number } | null = null;
  private lastSpokenKey: string | null = null;
  private lastSpokenAt = -Infinity;

  constructor({ stableMs = 2000, minGapMs = 4000, poseName = (l) => l }: SpeechCoachOptions = {}) {
    this.stableMs = stableMs;
    this.minGapMs = minGapMs;
    this.poseName = poseName;
  }

  /**
   * Feed one analysed frame. Returns the sentence to speak now, or null.
   * The sentence is the pose name and its top cue, as in the APK.
   */
  update(pose: string, cue: string | undefined, nowMs: number): string | null {
    if (!cue) return null;
    const key = `${pose}\u0000${cue}`;
    if (this.candidate?.key !== key) {
      this.candidate = { key, since: nowMs };
      return null;
    }
    const held = nowMs - this.candidate.since >= this.stableMs;
    const rested = nowMs - this.lastSpokenAt >= this.minGapMs;
    if (!held || !rested || key === this.lastSpokenKey) return null;

    this.lastSpokenKey = key;
    this.lastSpokenAt = nowMs;
    return pose !== NO_POSE ? `${this.poseName(pose)}. ${cue}` : cue;
  }

  reset(): void {
    this.candidate = null;
    this.lastSpokenKey = null;
    this.lastSpokenAt = -Infinity;
  }
}
