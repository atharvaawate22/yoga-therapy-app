import { describe, expect, it } from "vitest";
import artifactJson from "../models/classifier.thunder.json";
import { applyPoseRules, looksLikeUpwardDog, minKneeAngle, proneLift, type ClassifierArtifact } from "./index";

const rule = (artifactJson as ClassifierArtifact).thresholds;

/** Same bodies as backend/tests/test_pose_rules.py: prone, side view, image y down. */
function sideView(elbow: [number, number], hip: [number, number], knee: [number, number]) {
  const k: Array<[number, number]> = Array.from({ length: 17 }, () => [0, 0]);
  const set = (idx: number[], v: [number, number]) => idx.forEach((i) => (k[i] = v));
  set([5, 6], [0, -2]);
  set([7, 8], elbow);
  set([9, 10], [0, 0]);
  set([11, 12], hip);
  set([13, 14], knee);
  set([15, 16], [6, 0]);
  k[0] = [-0.3, -2.6];
  return Float32Array.from(k.flat());
}

const UPWARD_DOG = sideView([0, -1], [3, -1.3], [4.5, -0.6]);
const COBRA = sideView([0.6, -1], [3, 0], [4.5, 0]);
const HIGH_COBRA = sideView([0, -1], [3, -0.2], [4.5, 0]);
const LABELS = ["cobra_pose", "tree_pose", "upward_dog"];

describe("proneLift", () => {
  // Reference values printed by utils.pose_rules.prone_lift on the same bodies.
  it.each([
    ["upward dog", UPWARD_DOG, 179.997438, 0.42199784, 0.194768249],
    ["cobra", COBRA, 118.072485, 0, 0],
    ["high cobra", HIGH_COBRA, 179.997438, 0.0571661959, 0],
  ])("matches Python for %s", (_, features, elbowDeg, hipLift, kneeLift) => {
    const lift = proneLift(features);
    expect(lift.elbowDeg).toBeCloseTo(elbowDeg, 4);
    expect(lift.hipLift).toBeCloseTo(hipLift, 5);
    expect(lift.kneeLift).toBeCloseTo(kneeLift, 5);
  });
});

describe("upward dog rule", () => {
  it("ships its thresholds in the classifier artifact", () => {
    expect(rule.upwardDogMinElbowDeg).toBe(145);
    expect(rule.upwardDogMinHipLift).toBe(0.325);
    expect(rule.upwardDogMinKneeLift).toBe(0.04);
    expect(rule.upwardDogMaxHipLift).toBe(0.6);
    expect(rule.upwardDogMinKneeDeg).toBe(120);
  });

  it("needs the hips and knees off the floor", () => {
    expect([UPWARD_DOG, COBRA, HIGH_COBRA].map((f) => looksLikeUpwardDog(f, rule))).toEqual([true, false, false]);
  });

  it("skips a lunge (bent front knee) and lunge-high hips", () => {
    const lunge = Float32Array.from(UPWARD_DOG);
    lunge.set([1, -2], 2 * 13); // left knee forward and up
    lunge.set([0.8, 0], 2 * 15); // left foot beside the hands
    const highHips = sideView([0, -1], [3, -2.6], [4.5, -1.3]);
    expect(minKneeAngle(lunge)).toBeLessThan(120);
    expect(proneLift(highHips).hipLift).toBeGreaterThan(0.6);
    expect(looksLikeUpwardDog(lunge, rule)).toBe(false);
    expect(looksLikeUpwardDog(highHips, rule)).toBe(false);
  });

  it("turns a cobra answer into upward dog only when lifted", () => {
    const cobraTop = Float32Array.from([0.8, 0.05, 0.15]);
    expect(Array.from(applyPoseRules(UPWARD_DOG, cobraTop, LABELS, rule))).toEqual(
      Array.from(Float32Array.from([0.15, 0.05, 0.8])),
    );
    expect(Array.from(applyPoseRules(HIGH_COBRA, cobraTop, LABELS, rule))).toEqual(Array.from(cobraTop));
    const treeTop = Float32Array.from([0.3, 0.6, 0.1]);
    expect(Array.from(applyPoseRules(UPWARD_DOG, treeTop, LABELS, rule))).toEqual(Array.from(treeTop));
    expect(Array.from(cobraTop)).toEqual(Array.from(Float32Array.from([0.8, 0.05, 0.15])));
  });
});
