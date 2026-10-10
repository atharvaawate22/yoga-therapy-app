import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import generated from "./poseImages.generated.json";
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

  it("swaps RN image handles for the generated WebP versions", () => {
    const meta = { src: "/_next/static/media/tree_pose.abc123.png", width: 1024, height: 1024 };
    for (const handle of [{ default: meta }, meta]) {
      expect(toImage(handle)).toMatchObject({
        src: "/poses/tree_pose-960.webp",
        srcSet: "/poses/tree_pose-480.webp 480w, /poses/tree_pose-960.webp 960w",
        width: 1024,
      });
    }
    expect(toImage(null)).toBeNull();
  });

  it("falls back to the original for an image with no generated version", () => {
    const meta = { src: "/_next/static/media/new_pose.abc.png", width: 10, height: 10 };
    expect(toImage(meta)).toMatchObject({ src: meta.src, srcSet: "" });
  });

  it("has generated WebP files for every RN pose photo", () => {
    // Fails after adding a photo to assets/poses until
    // `node scripts/generate-images.mjs` is rerun.
    // Vitest runs from web/.
    const assets = resolve("..", "assets", "poses");
    const publicDir = resolve("public");
    const names = readdirSync(assets).filter((f) => f.endsWith(".png")).map((f) => f.replace(".png", ""));
    expect(Object.keys(generated).sort()).toEqual(names.sort());
    for (const entry of Object.values(generated)) {
      for (const src of Object.values(entry.sources)) expect(existsSync(publicDir + src)).toBe(true);
    }
  });

  it("has the 12-step Surya Namaskar sequence", () => {
    expect(SURYA_STEPS.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});
