import { describe, expect, it } from "vitest";
import {
  PREP_SECONDS,
  initialPracticeState,
  practiceReducer,
  progressPercent,
  type PracticeAction,
  type PracticePose,
  type PracticeState,
} from "./practiceMachine";

const POSES: PracticePose[] = [
  { name: "Tree Pose", holdSec: 3 },
  { name: "Chair Pose", holdSec: 2 },
];
const fmt = (s: number) => `${s}s`;

function run(actions: PracticeAction[], state = initialPracticeState()): PracticeState {
  return actions.reduce((s, a) => practiceReducer(s, a, POSES, fmt), state);
}
const ticks = (n: number): PracticeAction[] => Array.from({ length: n }, () => ({ type: "tick" }));

describe("practiceReducer", () => {
  it("counts down the prep, then holds for the pose's duration", () => {
    const afterPrep = run(ticks(PREP_SECONDS));
    expect(afterPrep).toMatchObject({ phase: "hold", secondsLeft: 3, poseIndex: 0 });
    expect(afterPrep.cue?.text).toBe("Begin.");
  });

  it("completes a pose when its hold ends and announces the next one", () => {
    const s = run(ticks(PREP_SECONDS + 3));
    expect(s).toMatchObject({ phase: "prep", poseIndex: 1, secondsLeft: PREP_SECONDS });
    expect([...s.completed]).toEqual([0]);
    expect(s.cue?.text).toBe("Relax. Get ready. Chair Pose. 2s.");
  });

  it("finishes after the last hold and counts every active second", () => {
    const s = run(ticks(PREP_SECONDS + 3 + PREP_SECONDS + 2));
    expect(s.phase).toBe("done");
    expect([...s.completed]).toEqual([0, 1]);
    expect(s.elapsedSec).toBe(PREP_SECONDS * 2 + 5);
    expect(s.cue?.text).toBe("Session complete. Well done!");
    // Further ticks change nothing.
    expect(run(ticks(5), s)).toBe(s);
  });

  it("applies a multi-second tick (throttled background timer) like single ticks", () => {
    const one = run(ticks(PREP_SECONDS + 4));
    const batched = run([{ type: "tick", seconds: PREP_SECONDS + 4 }]);
    expect(batched).toMatchObject({
      phase: one.phase,
      poseIndex: one.poseIndex,
      secondsLeft: one.secondsLeft,
      elapsedSec: one.elapsedSec,
    });
    expect([...batched.completed]).toEqual([...one.completed]);
  });

  it("stops at the end even if a batched tick overshoots", () => {
    const s = run([{ type: "tick", seconds: 999 }]);
    expect(s.phase).toBe("done");
    expect(s.elapsedSec).toBe(PREP_SECONDS * 2 + 5);
  });

  it("doesn't tick while paused", () => {
    const paused = run([{ type: "togglePause" }, ...ticks(5)]);
    expect(paused).toMatchObject({ secondsLeft: PREP_SECONDS, elapsedSec: 0, paused: true });
  });

  it("skipping a pose doesn't count it as completed", () => {
    const s = run([{ type: "skip" }]);
    expect(s).toMatchObject({ poseIndex: 1, phase: "prep" });
    expect(s.completed.size).toBe(0);
    expect(s.cue?.text).toBe("Get ready. Chair Pose. 2s.");
  });

  it("skipping past the last pose ends silently", () => {
    const s = run([{ type: "skip" }, { type: "skip" }]);
    expect(s.phase).toBe("done");
    expect(s.cue?.text).toBe("");
  });

  it("repeating a pose with Prev can't count it twice", () => {
    const s = run([...ticks(PREP_SECONDS + 3), { type: "prev" }, ...ticks(PREP_SECONDS + 3)]);
    expect([...s.completed]).toEqual([0]);
    expect(s.poseIndex).toBe(1);
  });

  it("Prev does nothing on the first pose", () => {
    const s = initialPracticeState();
    expect(practiceReducer(s, { type: "prev" }, POSES, fmt)).toBe(s);
  });

  it("announce gives a new cue id each time, so the same text is spoken again", () => {
    const first = run([{ type: "announce" }]);
    const second = run([{ type: "announce" }], first);
    expect(second.cue?.text).toBe("Get ready. Tree Pose. 3s.");
    expect(second.cue?.id).not.toBe(first.cue?.id);
  });
});

describe("progressPercent", () => {
  it("counts a held pose as half", () => {
    expect(progressPercent(initialPracticeState(), 2)).toBe(0);
    expect(progressPercent(run(ticks(PREP_SECONDS)), 2)).toBe(25);
    expect(progressPercent(run(ticks(PREP_SECONDS + 3)), 2)).toBe(50);
    expect(progressPercent(run([{ type: "tick", seconds: 999 }]), 2)).toBe(100);
  });
});
