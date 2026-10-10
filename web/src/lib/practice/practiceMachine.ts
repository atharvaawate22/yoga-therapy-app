/**
 * Guided practice as a pure state machine (ported from
 * src/screens/PracticeSessionScreen.js).
 *
 * Per pose: GET READY (prep countdown) -> HOLD (pose duration) -> next pose.
 * Keeping the timing rules out of React makes them unit-testable and lets
 * the page drive ticks from the wall clock: browsers throttle background
 * timers, so the page applies however many whole seconds really passed.
 */

export const PREP_SECONDS = 8;

export type Phase = "prep" | "hold" | "done";

export interface PracticeState {
  poseIndex: number;
  phase: Phase;
  secondsLeft: number;
  paused: boolean;
  /** Active (unpaused) seconds. */
  elapsedSec: number;
  /**
   * Indices of poses held to the end. A set, so going back with Prev and
   * repeating a pose can't count it twice.
   */
  completed: ReadonlySet<number>;
  /** Latest spoken cue; `id` changes every time a cue should be (re)spoken. */
  cue: { id: number; text: string } | null;
}

export interface PracticePose {
  name: string;
  /** Hold length in seconds. */
  holdSec: number;
}

export type PracticeAction =
  | { type: "tick"; seconds?: number }
  | { type: "skip" }
  | { type: "prev" }
  | { type: "togglePause" }
  | { type: "announce" };

export function initialPracticeState(): PracticeState {
  return {
    poseIndex: 0,
    phase: "prep",
    secondsLeft: PREP_SECONDS,
    paused: false,
    elapsedSec: 0,
    completed: new Set(),
    cue: null,
  };
}

function withCue(state: PracticeState, text: string): PracticeState {
  return { ...state, cue: { id: (state.cue?.id ?? 0) + 1, text } };
}

export function prepCue(pose: PracticePose, formatDuration: (s: number) => string): string {
  return `Get ready. ${pose.name}. ${formatDuration(pose.holdSec)}.`;
}

function goToPose(state: PracticeState, index: number): PracticeState {
  return { ...state, poseIndex: index, phase: "prep", secondsLeft: PREP_SECONDS };
}

function tickOnce(state: PracticeState, poses: readonly PracticePose[]): PracticeState {
  const next = { ...state, elapsedSec: state.elapsedSec + 1, secondsLeft: state.secondsLeft - 1 };
  if (next.secondsLeft > 0) return next;

  if (next.phase === "prep") {
    const pose = poses[next.poseIndex];
    return withCue({ ...next, phase: "hold", secondsLeft: pose?.holdSec ?? 30 }, "Begin.");
  }

  // Hold finished: the pose counts as completed.
  const completed = new Set(next.completed).add(next.poseIndex);
  if (next.poseIndex < poses.length - 1) {
    return withCue({ ...goToPose(next, next.poseIndex + 1), completed }, "Relax.");
  }
  return withCue(
    { ...next, completed, phase: "done", secondsLeft: 0 },
    "Session complete. Well done!",
  );
}

export function practiceReducer(
  state: PracticeState,
  action: PracticeAction,
  poses: readonly PracticePose[],
  formatDuration: (s: number) => string,
): PracticeState {
  switch (action.type) {
    case "tick": {
      if (state.phase === "done" || state.paused) return state;
      const before = state.poseIndex;
      let next = state;
      for (let i = 0; i < (action.seconds ?? 1) && next.phase !== "done"; i++) {
        next = tickOnce(next, poses);
      }
      // Moving on to a new pose announces it, after the "Relax." cue.
      if (next.phase === "prep" && next.poseIndex !== before) {
        const pose = poses[next.poseIndex];
        if (pose) next = withCue(next, `Relax. ${prepCue(pose, formatDuration)}`);
      }
      return next;
    }
    case "skip": {
      if (state.phase === "done") return state;
      if (state.poseIndex < poses.length - 1) {
        const next = goToPose(state, state.poseIndex + 1);
        const pose = poses[next.poseIndex];
        return pose ? withCue(next, prepCue(pose, formatDuration)) : next;
      }
      // Skipping past the last pose ends the session silently: an empty cue
      // stops whatever is being spoken.
      return withCue({ ...state, phase: "done", secondsLeft: 0 }, "");
    }
    case "prev": {
      if (state.phase === "done" || state.poseIndex === 0) return state;
      const next = goToPose(state, state.poseIndex - 1);
      const pose = poses[next.poseIndex];
      return pose ? withCue(next, prepCue(pose, formatDuration)) : next;
    }
    case "togglePause":
      return state.phase === "done" ? state : { ...state, paused: !state.paused };
    case "announce": {
      const pose = poses[state.poseIndex];
      return pose && state.phase === "prep" ? withCue(state, prepCue(pose, formatDuration)) : state;
    }
  }
}

/** Progress through the routine, 0-100 (a held pose counts half). */
export function progressPercent(state: PracticeState, poseCount: number): number {
  if (poseCount === 0) return 0;
  if (state.phase === "done") return 100;
  return ((state.poseIndex + (state.phase === "hold" ? 0.5 : 0)) / poseCount) * 100;
}
