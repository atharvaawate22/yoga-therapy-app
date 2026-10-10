import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import lightningJson from "../models/classifier.lightning.json";
import thunderJson from "../models/classifier.thunder.json";
import {
  PoseClassifier,
  hasBody,
  keypointsFromMoveNet,
  normalizeKeypoints,
  type ClassifierArtifact,
} from "./index";

const repo = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));

/** Python reference outputs (backend/export_lab_fixtures.py). */
interface Expected {
  raw: number[];
  hasBody: boolean;
  features: number[];
  label: string;
  prob: number;
}
const manifest = JSON.parse(readFileSync(repo("web/public/lab/fixtures/manifest.json"), "utf8")) as {
  images: Array<{ file: string; expected: Record<"thunder" | "lightning", Expected> }>;
};
const cases = manifest.images.flatMap((image) =>
  (["thunder", "lightning"] as const).map((variant) => ({
    name: `${image.file} (${variant})`,
    variant,
    expected: image.expected[variant],
  })),
);

// Each MoveNet variant has its own classifier head.
const artifacts = {
  thunder: thunderJson as ClassifierArtifact & { sourceFile: string },
  lightning: lightningJson as ClassifierArtifact & { sourceFile: string },
};
const classifiers = {
  thunder: new PoseClassifier(artifacts.thunder),
  lightning: new PoseClassifier(artifacts.lightning),
};
const artifact = artifacts.thunder;

describe.each(["thunder", "lightning"] as const)("%s classifier artifact", (variant) => {
  it("was exported from the current backend model", () => {
    const sha = createHash("sha256")
      .update(readFileSync(repo(`backend/models/${artifacts[variant].sourceFile}`)))
      .digest("hex");
    // If this fails, run `python export_web_artifacts.py` in backend/.
    expect(artifacts[variant].sourceSha256).toBe(sha);
    expect(artifacts[variant].movenetVariant).toBe(variant);
  });

  it("has the server's labels in softmax order", () => {
    const labels = JSON.parse(readFileSync(repo("backend/models/pose_labels.json"), "utf8"));
    expect(artifacts[variant].labels).toEqual(labels);
  });
});

describe("matches the Python pipeline on the lab fixtures", () => {
  it.each(cases)("$name", ({ variant, expected }) => {
    const keypoints = keypointsFromMoveNet(expected.raw);

    const features = normalizeKeypoints(keypoints);
    expect(features).toHaveLength(34);
    // Python computes in float32, TypeScript in float64: allow ~1e-5 relative.
    features.forEach((value, i) => {
      const want = expected.features[i]!;
      expect(Math.abs(value - want)).toBeLessThanOrEqual(1e-5 * Math.max(1, Math.abs(want)));
    });

    expect(hasBody(keypoints, artifact.thresholds)).toBe(expected.hasBody);

    const prediction = classifiers[variant].predict(features);
    expect(prediction.label).toBe(expected.label);
    expect(prediction.probability).toBeCloseTo(expected.prob, 5);
  });
});

describe("normalizeKeypoints", () => {
  const base = keypointsFromMoveNet(manifest.images[0]!.expected.thunder.raw);

  it("is translation and scale invariant", () => {
    const moved = base.map((k) => ({ ...k, x: k.x * 3 + 0.4, y: k.y * 3 - 0.2 }));
    const a = normalizeKeypoints(base);
    const b = normalizeKeypoints(moved);
    a.forEach((v, i) => expect(b[i]).toBeCloseTo(v, 5));
  });

  it("falls back to the bounding box for a degenerate torso", () => {
    const flat = base.map((k, i) => ({ ...k, x: [5, 6, 11, 12].includes(i) ? 0.5 : k.x, y: [5, 6, 11, 12].includes(i) ? 0.5 : k.y }));
    expect(normalizeKeypoints(flat).every(Number.isFinite)).toBe(true);
  });
});

describe("PoseClassifier", () => {
  it("outputs a probability distribution", () => {
    const { probabilities } = classifiers.thunder.predict(new Float32Array(34));
    const total = probabilities.reduce((s, p) => s + p, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it("rejects the wrong input width", () => {
    expect(() => classifiers.thunder.predict(new Float32Array(10))).toThrow(RangeError);
  });
});
