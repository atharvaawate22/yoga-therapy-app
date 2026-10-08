/**
 * Surya Namaskar stepping as a pure state machine (ported from
 * src/screens/SuryaNamaskarScreen.js). The user moves through the 12 steps
 * with Next/Prev, for 1-12 rounds.
 */

export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 12;
/** Seconds to move into a step, for the round picker's time estimate. */
export const TRANSITION_SEC = 3;

export interface SuryaState {
  rounds: number;
  round: number;
  /** 0-based index into the step list. */
  step: number;
  /**
   * "round-step" keys the user moved past with Next. Saved counts come from
   * this rather than assuming every planned step was done.
   */
  completed: ReadonlySet<string>;
  finished: boolean;
}

export type SuryaAction = { type: "next" } | { type: "prev" };

export function initialSuryaState(rounds: number): SuryaState {
  return { rounds: clampRounds(rounds), round: 1, step: 0, completed: new Set(), finished: false };
}

export function clampRounds(rounds: number): number {
  return Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, Math.round(rounds)));
}

export function suryaReducer(
  state: SuryaState,
  action: SuryaAction,
  stepsPerRound: number,
): SuryaState {
  if (state.finished) return state;
  switch (action.type) {
    case "next": {
      const completed = new Set(state.completed).add(`${state.round}-${state.step}`);
      if (state.step < stepsPerRound - 1) return { ...state, completed, step: state.step + 1 };
      if (state.round < state.rounds) return { ...state, completed, round: state.round + 1, step: 0 };
      return { ...state, completed, finished: true };
    }
    case "prev": {
      if (state.step > 0) return { ...state, step: state.step - 1 };
      if (state.round > 1) return { ...state, round: state.round - 1, step: stepsPerRound - 1 };
      return state;
    }
  }
}

export function isLastStep(state: SuryaState, stepsPerRound: number): boolean {
  return state.round === state.rounds && state.step === stepsPerRound - 1;
}

export function suryaProgressPercent(state: SuryaState, stepsPerRound: number): number {
  if (state.finished) return 100;
  const done = (state.round - 1) * stepsPerRound + state.step;
  return (done / (state.rounds * stepsPerRound)) * 100;
}

/** Rough minutes for the round picker: each step's hold plus a transition. */
export function estimateMinutes(rounds: number, stepDurations: readonly number[]): number {
  const perRound = stepDurations.reduce((sum, d) => sum + d + TRANSITION_SEC, 0);
  return Math.max(1, Math.round((rounds * perRound) / 60));
}
