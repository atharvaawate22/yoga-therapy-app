import { describe, expect, it } from "vitest";
import {
  clampRounds,
  estimateMinutes,
  initialSuryaState,
  isLastStep,
  suryaProgressPercent,
  suryaReducer,
  type SuryaState,
} from "./suryaMachine";

const STEPS = 3;
const next = (s: SuryaState) => suryaReducer(s, { type: "next" }, STEPS);
const prev = (s: SuryaState) => suryaReducer(s, { type: "prev" }, STEPS);
const times = (n: number, f: (s: SuryaState) => SuryaState, s: SuryaState) =>
  Array.from({ length: n }).reduce<SuryaState>((acc) => f(acc), s);

describe("suryaReducer", () => {
  it("moves through steps, then rounds, then finishes", () => {
    let s = initialSuryaState(2);
    s = times(STEPS, next, s);
    expect(s).toMatchObject({ round: 2, step: 0, finished: false });
    expect(isLastStep(times(STEPS - 1, next, s), STEPS)).toBe(true);
    s = times(STEPS, next, s);
    expect(s.finished).toBe(true);
    expect(s.completed.size).toBe(2 * STEPS);
  });

  it("Prev crosses back into the previous round but not before the start", () => {
    const s = times(STEPS, next, initialSuryaState(2));
    expect(prev(s)).toMatchObject({ round: 1, step: STEPS - 1 });
    const start = initialSuryaState(2);
    expect(prev(start)).toBe(start);
  });

  it("counts a step once even when revisited", () => {
    const s = next(prev(next(initialSuryaState(1))));
    expect([...s.completed]).toEqual(["1-0"]);
  });

  it("ignores input after finishing", () => {
    const done = times(STEPS, next, initialSuryaState(1));
    expect(next(done)).toBe(done);
  });
});

describe("helpers", () => {
  it("clamps rounds to 1-12", () => {
    expect([clampRounds(0), clampRounds(5), clampRounds(40)]).toEqual([1, 5, 12]);
  });

  it("estimates minutes from holds plus transitions", () => {
    // (5 + 3) * 12 = 96 s per round
    expect(estimateMinutes(3, Array(12).fill(5))).toBe(5);
    expect(estimateMinutes(1, [1])).toBe(1);
  });

  it("reports progress", () => {
    const s = initialSuryaState(2);
    expect(suryaProgressPercent(s, STEPS)).toBe(0);
    expect(suryaProgressPercent(times(STEPS, next, s), STEPS)).toBe(50);
    expect(suryaProgressPercent(times(2 * STEPS, next, s), STEPS)).toBe(100);
  });
});
