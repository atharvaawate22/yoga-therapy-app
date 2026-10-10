import { describe, expect, it } from "vitest";
import modelLabels from "../../../backend/models/pose_labels.json";
import {
  ALL_POSES,
  CONDITION_GROUPS,
  CONDITIONS,
  SURYA_STEPS,
  conditionBySlug,
  posesForLevel,
  slugify,
  tipsFor,
  toImage,
} from "./index";

describe("content from the RN app's src/data", () => {
  it("has the 11 conditions, each with poses and a unique slug", () => {
    expect(CONDITIONS).toHaveLength(11);
    const slugs = CONDITIONS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const condition of CONDITIONS) {
      expect(condition.poses.length).toBeGreaterThan(0);
      expect(conditionBySlug(condition.slug)).toBe(condition);
    }
  });

  it("groups every condition exactly once in the Health Scanner", () => {
    const grouped = CONDITION_GROUPS.flatMap((g) => g.names).sort();
    expect(grouped).toEqual(CONDITIONS.map((c) => c.name).sort());
  });

  it("makes URL-safe slugs", () => {
    expect(slugify("Hip Alignment Issue")).toBe("hip-alignment-issue");
    expect(conditionBySlug("hip-alignment-issue")?.name).toBe("Hip Alignment Issue");
  });

  it("only links poses the classifier can recognise", () => {
    // Same contract as src/data/__tests__/poseContract.test.js in the RN app.
    for (const pose of ALL_POSES) expect(modelLabels).toContain(pose.id);
    for (const step of SURYA_STEPS) {
      if (step.expectedPoseId) expect(modelLabels).toContain(step.expectedPoseId);
    }
  });

  it("filters poses by level like the APK", () => {
    const beginner = posesForLevel(ALL_POSES, "beginner");
    expect(beginner.every((p) => p.difficulty === "beginner")).toBe(true);
    expect(posesForLevel(ALL_POSES, "expert")).toHaveLength(ALL_POSES.length);
  });

  it("falls back to general tips", () => {
    expect(tipsFor("Back Pain").length).toBeGreaterThan(0);
    expect(tipsFor("Unknown")).toEqual(tipsFor("default"));
  });

  it("unwraps RN image handles", () => {
    const meta = { src: "/a.png", width: 1, height: 1 };
    expect(toImage({ default: meta })).toBe(meta);
    expect(toImage(meta)).toBe(meta);
    expect(toImage(null)).toBeNull();
  });

  it("has the 12-step Surya Namaskar sequence", () => {
    expect(SURYA_STEPS.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});
