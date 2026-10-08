/**
 * Everything `/analyze-pose` does after MoveNet, in one call: body gate,
 * features, classifier, confidence cutoff, live stability vote, corrections.
 * Mirrors `analyze_pose` in backend/yoga_pose_engine.py.
 */
import type { PoseClassifier } from "./classifier";
import { NO_POSE, UNKNOWN, distanceMetrics, generateCorrections, type Level } from "./corrections";
import { hasBody, normalizeKeypoints } from "./features";
import { keypointsFromMoveNet, type Keypoint } from "./keypoints";
import type { Vote } from "./stability";

/** Visualization threshold; a frame with no joint above it has no skeleton. */
export const SKELETON_DRAW_MIN_SCORE = 0.25;

export const NO_BODY_MESSAGE =
  "No full-body skeleton detected. Step back so your whole body is in frame.";

const LEVELS: readonly string[] = ["beginner", "intermediate", "expert"];

export interface AnalyzeOptions {
  classifier: PoseClassifier;
  /** Experience level; anything unknown falls back to beginner, like the API. */
  level?: string;
  /**
   * Live frames pass a vote and use the lower live cutoff. Without one the
   * frame is treated as a single image (stricter cutoff, no smoothing).
   */
  vote?: Vote;
  /** Frame time for time-based votes (defaults to now). */
  timeMs?: number;
}

export interface Analysis {
  /** Reported pose label, or "nopose". */
  pose: string;
  /** This frame's top probability when a pose is reported, else 0. */
  confidence: number;
  corrections: string[];
  distances: Record<string, number>;
  /** Softmax per label; empty when no body was found. */
  probabilities: Record<string, number>;
  /** Whether the body-presence gate passed. */
  body: boolean;
  keypoints: Keypoint[];
}

/** Analyze one frame from MoveNet's raw [17 x (y, x, score)] output. */
export function analyzeFrame(raw: ArrayLike<number>, options: AnalyzeOptions): Analysis {
  const { classifier, vote } = options;
  const level = (LEVELS.includes(options.level ?? "") ? options.level : "beginner") as Level;
  const keypoints = keypointsFromMoveNet(raw);
  const thresholds = classifier.artifact.thresholds;

  const drawable = keypoints.some((k) => k.score >= SKELETON_DRAW_MIN_SCORE);
  if (!drawable || !hasBody(keypoints, thresholds)) {
    // The server returns before voting, so a missing body doesn't count
    // against the vote.
    return {
      pose: NO_POSE,
      confidence: 0,
      corrections: [NO_BODY_MESSAGE],
      distances: {},
      probabilities: {},
      body: false,
      keypoints,
    };
  }

  const prediction = classifier.predict(normalizeKeypoints(keypoints));
  const minProb = vote ? thresholds.minClassProbLive : thresholds.minClassProb;
  let candidate = prediction.probability >= minProb ? prediction.label : NO_POSE;
  if (prediction.label === UNKNOWN || prediction.label === NO_POSE) candidate = NO_POSE;

  const pose = vote ? vote.push(candidate, options.timeMs) : candidate;
  const probabilities: Record<string, number> = {};
  classifier.artifact.labels.forEach((label, i) => {
    probabilities[label] = prediction.probabilities[i]!;
  });

  return {
    pose,
    confidence: pose !== NO_POSE ? prediction.probability : 0,
    corrections: generateCorrections(pose, keypoints, level),
    distances: distanceMetrics(keypoints, pose),
    probabilities,
    body: true,
    keypoints,
  };
}
