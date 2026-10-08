/**
 * Golden parity with the Python server (backend/export_parity_fixtures.py).
 * Every case below was produced by running the server's own functions; the
 * TypeScript port must reproduce each output exactly.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import lightningArtifact from "../models/classifier.lightning.json";
import thunderArtifact from "../models/classifier.thunder.json";
import {
  NO_POSE,
  PoseClassifier,
  StabilityVote,
  analyzeFrame,
  distanceMetrics,
  generateCorrections,
  type ClassifierArtifact,
  type Keypoint,
} from "./index";

const repo = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));

interface PipelineCase {
  raw: number[];
  real: boolean;
  body: boolean;
  best?: string;
  prob?: number;
  imagePose?: string;
  liveCandidate?: string;
  corrections: number[][];
}

interface Fixture {
  sources: Record<string, string>;
  levels: string[];
  poses: string[];
  strings: string[];
  thresholds: { stabilityWindow: number; stabilityMinVotes: number };
  correctionCases: Array<{
    kp: number[];
    corrections: number[][][];
    /** Absent where float32 rounding made the value fragile. */
    distances?: Record<string, number>;
    exact?: boolean;
  }>;
  pipelineCases: Record<"thunder" | "lightning", PipelineCase[]>;
  voteCases: Array<{ sequence: string[]; outputs: string[] }>;
}

const fixture = JSON.parse(
  gunzipSync(readFileSync(new URL("../fixtures/parity.json.gz", import.meta.url))).toString("utf8"),
) as Fixture;
const text = (ids: number[]) => ids.map((id) => fixture.strings[id]!);

const classifiers = {
  thunder: new PoseClassifier(thunderArtifact as ClassifierArtifact),
  lightning: new PoseClassifier(lightningArtifact as ClassifierArtifact),
};

function toKeypoints(flat: number[]): Keypoint[] {
  return Array.from({ length: 17 }, (_, i) => ({ x: flat[i * 3]!, y: flat[i * 3 + 1]!, score: flat[i * 3 + 2]! }));
}

/** Collect mismatches and fail once with a readable sample. */
function expectNoMismatches(mismatches: string[], total: number) {
  expect(
    mismatches.length,
    `${mismatches.length}/${total} mismatches, e.g.\n${mismatches.slice(0, 5).join("\n")}`,
  ).toBe(0);
}

describe("fixtures are current", () => {
  it.each(Object.keys(fixture.sources))("%s unchanged since the fixtures were generated", (path) => {
    let data = readFileSync(repo(path));
    if (!path.endsWith(".keras")) data = Buffer.from(data.toString("binary").replace(/\r\n/g, "\n"), "binary");
    const hash = createHash("sha256").update(data).digest("hex");
    // If this fails, run `python export_parity_fixtures.py` in backend/.
    expect(hash).toBe(fixture.sources[path]);
  });
});

describe("correction rules", () => {
  it(`match the server on ${fixture.correctionCases.length} skeletons × ${fixture.poses.length} poses × 3 levels`, () => {
    const mismatches: string[] = [];
    let total = 0;
    fixture.correctionCases.forEach((c, caseIndex) => {
      const keypoints = toKeypoints(c.kp);
      fixture.poses.forEach((pose, p) => {
        fixture.levels.forEach((level, l) => {
          total++;
          const got = generateCorrections(pose, keypoints, level);
          const want = text(c.corrections[p]![l]!);
          if (JSON.stringify(got) !== JSON.stringify(want)) {
            mismatches.push(`case ${caseIndex} ${pose}/${level}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
          }
        });
      });
    });
    expectNoMismatches(mismatches, total);
  });

  it("include collapsed-torso skeletons (fallback scale)", () => {
    expect(fixture.correctionCases.filter((c) => c.exact).length).toBeGreaterThan(0);
  });

  it("produce the server's Warrior II distance metrics", () => {
    const mismatches: string[] = [];
    fixture.correctionCases.forEach((c, i) => {
      if (!c.distances) return;
      const got = distanceMetrics(toKeypoints(c.kp), "warrior_pose");
      if (JSON.stringify(got) !== JSON.stringify(c.distances)) {
        mismatches.push(`case ${i}: got ${JSON.stringify(got)} want ${JSON.stringify(c.distances)}`);
      }
    });
    expectNoMismatches(mismatches, fixture.correctionCases.length);
  });
});

describe.each(["thunder", "lightning"] as const)("full frame analysis (%s)", (variant) => {
  const cases = fixture.pipelineCases[variant];
  const classifier = classifiers[variant];

  it(`matches the server's image mode on ${cases.length} frames`, () => {
    const mismatches: string[] = [];
    cases.forEach((c, i) => {
      fixture.levels.forEach((level, l) => {
        const result = analyzeFrame(c.raw, { classifier, level });
        const problems: string[] = [];
        if (result.body !== c.body) problems.push(`body ${result.body} vs ${c.body}`);
        if (c.body && result.pose !== c.imagePose) problems.push(`pose ${result.pose} vs ${c.imagePose}`);
        if (c.body && Math.abs((result.pose === NO_POSE ? 0 : result.confidence) - (c.imagePose === NO_POSE ? 0 : c.prob!)) > 1e-5) {
          problems.push(`confidence ${result.confidence} vs ${c.prob}`);
        }
        if (JSON.stringify(result.corrections) !== JSON.stringify(text(c.corrections[l]!))) {
          problems.push(`corrections ${JSON.stringify(result.corrections)}`);
        }
        if (problems.length) mismatches.push(`frame ${i} (${level}): ${problems.join("; ")}`);
      });
    });
    expectNoMismatches(mismatches, cases.length * fixture.levels.length);
  });

  it("matches the server's live-mode cutoff", () => {
    const mismatches: string[] = [];
    cases.filter((c) => c.body).forEach((c, i) => {
      // A one-frame vote returns the frame's own candidate.
      const result = analyzeFrame(c.raw, { classifier, vote: new StabilityVote(1, 1) });
      if (result.pose !== c.liveCandidate) mismatches.push(`frame ${i}: ${result.pose} vs ${c.liveCandidate}`);
    });
    expectNoMismatches(mismatches, cases.length);
  });

  it("includes real photos and frames with no body", () => {
    expect(cases.some((c) => c.real)).toBe(true);
    expect(cases.some((c) => !c.body)).toBe(true);
    expect(cases.some((c) => c.imagePose && c.imagePose !== NO_POSE)).toBe(true);
  });
});

describe("stability vote", () => {
  it(`matches the server on ${fixture.voteCases.length} label sequences`, () => {
    const { stabilityWindow, stabilityMinVotes } = fixture.thresholds;
    const mismatches: string[] = [];
    fixture.voteCases.forEach((c, i) => {
      const vote = new StabilityVote(stabilityWindow, stabilityMinVotes);
      const got = c.sequence.map((pose) => vote.push(pose));
      if (JSON.stringify(got) !== JSON.stringify(c.outputs)) {
        mismatches.push(`sequence ${i}: ${JSON.stringify(c.sequence)} -> ${JSON.stringify(got)} want ${JSON.stringify(c.outputs)}`);
      }
    });
    expectNoMismatches(mismatches, fixture.voteCases.length);
  });
});
