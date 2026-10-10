import { describe, expect, it } from "vitest";
import { defaultFacing, describeCameraError, describeVideoError } from "./camera";
import { DOWNGRADE_SAMPLE, WARMUP_FRAMES, chooseLiveModel, shouldDowngrade } from "./modelChoice";
import { SessionTracker } from "./sessionTracker";
import { SpeechCoach } from "./speechCoach";

describe("SpeechCoach", () => {
  const coach = () => new SpeechCoach({ poseName: (l) => (l === "tree_pose" ? "Tree Pose" : l) });

  it("waits for a cue to hold steady before speaking", () => {
    const c = coach();
    expect(c.update("tree_pose", "Level your shoulders", 0)).toBeNull();
    expect(c.update("tree_pose", "Level your shoulders", 1900)).toBeNull();
    expect(c.update("tree_pose", "Level your shoulders", 2000)).toBe("Tree Pose. Level your shoulders");
  });

  it("restarts the clock when the cue changes (no chatter at high frame rates)", () => {
    const c = coach();
    for (let t = 0; t < 3000; t += 100) {
      expect(c.update("tree_pose", t % 200 ? "Cue A" : "Cue B", t)).toBeNull();
    }
  });

  it("never repeats the same message back to back", () => {
    const c = coach();
    c.update("tree_pose", "Cue A", 0);
    expect(c.update("tree_pose", "Cue A", 2000)).not.toBeNull();
    expect(c.update("tree_pose", "Cue A", 9000)).toBeNull();
  });

  it("keeps a gap between utterances", () => {
    const c = coach();
    c.update("tree_pose", "Cue A", 0);
    c.update("tree_pose", "Cue A", 2000); // spoken at 2.0 s
    c.update("tree_pose", "Cue B", 2100);
    expect(c.update("tree_pose", "Cue B", 4500)).toBeNull(); // held, but only 2.5 s since
    expect(c.update("tree_pose", "Cue B", 6000)).toBe("Tree Pose. Cue B");
  });

  it("speaks no-pose guidance without a pose name", () => {
    const c = coach();
    c.update("nopose", "Step back", 0);
    expect(c.update("nopose", "Step back", 2000)).toBe("Step back");
  });
});

describe("SessionTracker", () => {
  it("summarises a session like the APK and saves it after 15 s", () => {
    const t = new SessionTracker();
    t.start(0);
    ["nopose", "tree_pose", "tree_pose", "chair_pose"].forEach((p) => t.frame(p));
    expect(t.finish(20_000)).toEqual({ durationSec: 20, poseCount: 2, topPose: "tree_pose", worthSaving: true });
    expect(t.running).toBe(false);
  });

  it("doesn't save short sessions or ones with no pose", () => {
    const short = new SessionTracker();
    short.start(0);
    short.frame("tree_pose");
    expect(short.finish(10_000)?.worthSaving).toBe(false);

    const empty = new SessionTracker();
    empty.start(0);
    empty.frame("nopose");
    expect(empty.finish(60_000)).toMatchObject({ poseCount: 0, topPose: null, worthSaving: false });
  });

  it("ignores frames outside a session", () => {
    const t = new SessionTracker();
    t.frame("tree_pose");
    expect(t.finish(1000)).toBeNull();
  });
});

describe("chooseLiveModel", () => {
  const desktop = { isPhone: false, webgpu: true, jspi: true };
  const phone = { isPhone: true, webgpu: true, jspi: true };

  it("runs Thunder on desktop WebGPU and Lightning on phones", () => {
    expect(chooseLiveModel(desktop)).toMatchObject({ variant: "thunder", accelerator: "webgpu" });
    expect(chooseLiveModel(phone)).toMatchObject({ variant: "lightning", accelerator: "wasm" });
  });

  it("falls back to CPU where LiteRT can't use WebGPU", () => {
    expect(chooseLiveModel({ ...desktop, jspi: false })).toMatchObject({ accelerator: "wasm" });
    expect(chooseLiveModel({ ...desktop, webgpu: false })).toMatchObject({ accelerator: "wasm" });
  });

  it("honours overrides for benchmarking, but not an unusable accelerator", () => {
    const params = new URLSearchParams("model=thunder&accel=webgpu");
    expect(chooseLiveModel(phone, params)).toMatchObject({ variant: "thunder", accelerator: "webgpu" });
    expect(chooseLiveModel({ ...phone, webgpu: false }, params)).toMatchObject({ accelerator: "wasm" });
    expect(chooseLiveModel(desktop, new URLSearchParams("model=bogus")).variant).toBe("thunder");
  });
});

describe("describeCameraError", () => {
  it.each([
    ["NotAllowedError", "Camera access is blocked"],
    ["NotFoundError", "No camera found"],
    ["NotReadableError", "The camera is busy"],
    ["SecurityError", "Camera needs a secure connection"],
  ])("explains %s", (name, title) => {
    const problem = describeCameraError(new DOMException("x", name));
    expect(problem.title).toBe(title);
    expect(problem.suggestDemo).toBe(true);
  });

  it("falls back to the error message", () => {
    expect(describeCameraError(new Error("weird")).body).toBe("weird");
  });

  it("uses the rear camera on phones and the front one elsewhere", () => {
    expect(defaultFacing(true)).toBe("environment");
    expect(defaultFacing(false)).toBe("user");
  });
});

describe("describeVideoError", () => {
  it("explains unsupported formats and background pausing", () => {
    expect(describeVideoError(new DOMException("x", "NotSupportedError")).title).toBe("That video can't be played");
    expect(describeVideoError(new DOMException("x", "AbortError"), true).title).toBe("The video was paused");
    expect(describeVideoError(new DOMException("x", "AbortError"), false).title).toBe("Couldn't play the video");
  });
});

describe("shouldDowngrade", () => {
  const thunder = { variant: "thunder" as const, accelerator: "wasm" as const, reason: "" };
  const frames = (ms: number) => Array(WARMUP_FRAMES + DOWNGRADE_SAMPLE).fill(ms);

  it("switches Thunder to Lightning when the device is too slow", () => {
    expect(shouldDowngrade(thunder, frames(220))).toBe(true);
    expect(shouldDowngrade(thunder, frames(70))).toBe(false);
  });

  it("ignores slow warm-up frames and waits for a full sample", () => {
    const warmSlowThenFast = [...Array(WARMUP_FRAMES).fill(900), ...Array(DOWNGRADE_SAMPLE).fill(60)];
    expect(shouldDowngrade(thunder, warmSlowThenFast)).toBe(false);
    expect(shouldDowngrade(thunder, frames(300).slice(0, 10))).toBe(false);
  });

  it("respects an explicit model choice and leaves Lightning alone", () => {
    expect(shouldDowngrade(thunder, frames(300), new URLSearchParams("model=thunder"))).toBe(false);
    expect(shouldDowngrade({ ...thunder, variant: "lightning" }, frames(300))).toBe(false);
  });
});
