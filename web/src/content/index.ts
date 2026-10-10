/**
 * Typed access to the RN app's content (src/data, via the @app-data alias).
 *
 * The web app reads the same files the APK bundles, so poses, conditions,
 * tips and the Surya Namaskar sequence can't drift between clients. This
 * module is the boundary: it gives the untyped JS data explicit types and
 * turns the RN image handles into web image metadata.
 */
import type { StaticImageData } from "next/image";
import rawYogaData, { getAllPoses, posesForExperience } from "@app-data/yogaData";
import rawSuryaSteps from "@app-data/suryaNamaskarData";
import rawProTips from "@app-data/proTips";
import { getPoseIcon as rawGetPoseIcon } from "@app-data/poseImages";
import { POSE_COMMON_NAMES, POSE_SANSKRIT_NAMES } from "@app-data/poseNames";
import optimizedImages from "./poseImages.generated.json";

export type Level = "beginner" | "intermediate" | "expert";

/** A pose photo as the web serves it (see scripts/generate-images.mjs). */
export interface WebImage {
  src: string;
  /** Responsive candidates, e.g. "/poses/x-480.webp 480w, /poses/x-960.webp 960w". */
  srcSet: string;
  width: number;
  height: number;
  blurDataURL?: string;
}

const OPTIMIZED = optimizedImages as Record<
  string,
  { width: number; height: number; sources: Record<string, string>; blurDataURL: string }
>;
export const LEVELS: readonly Level[] = ["beginner", "intermediate", "expert"];

export interface Pose {
  id: string;
  name: string;
  sanskritName: string;
  description: string;
  /** Free text as written in the data, e.g. "30 sec each" (see parseDurationSec). */
  duration: string;
  difficulty: string;
  image: WebImage | null;
  benefits: string[];
  precautions: string[];
  steps: string[];
}

export interface Condition {
  name: string;
  slug: string;
  /** Every pose for the condition; filter with `posesForLevel`. */
  poses: Pose[];
}

export interface SuryaStep {
  step: number;
  name: string;
  sanskritName: string;
  description: string;
  /** Suggested hold in seconds. */
  duration: number;
  image: WebImage | null;
  imageId: string;
  /** Classifier label for "Test this pose", or null when the model can't detect it. */
  expectedPoseId: string | null;
  breathing: string;
  steps: string[];
}

type RawImage = { default?: StaticImageData } | StaticImageData | null | undefined;
type RawPose = Omit<Pose, "image"> & { image: RawImage };

/**
 * RN `require()` image handles arrive as `{ default: StaticImageData }`
 * under Turbopack (and as the metadata itself under some loaders). They are
 * swapped for the WebP versions generated from the same file, matched by
 * name (Turbopack keeps it: /_next/static/media/<name>.<hash>.png). An image
 * without a generated version falls back to the original.
 */
export function toImage(raw: RawImage): WebImage | null {
  if (!raw) return null;
  const meta = "src" in raw ? raw : raw.default;
  if (!meta) return null;
  const name = meta.src.split("/").pop()!.split(".")[0]!;
  const optimized = OPTIMIZED[name];
  if (!optimized) {
    return { src: meta.src, srcSet: "", width: meta.width, height: meta.height, blurDataURL: meta.blurDataURL };
  }
  const widths = Object.keys(optimized.sources).map(Number).sort((a, b) => a - b);
  return {
    src: optimized.sources[widths.at(-1)!]!,
    srcSet: widths.map((w) => `${optimized.sources[w]} ${w}w`).join(", "),
    width: optimized.width,
    height: optimized.height,
    blurDataURL: optimized.blurDataURL,
  };
}

export function toPose(raw: RawPose): Pose {
  return { ...raw, image: toImage(raw.image) };
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const yogaData = rawYogaData as unknown as Record<string, RawPose[]>;

export const CONDITIONS: readonly Condition[] = Object.entries(yogaData).map(
  ([name, poses]) => ({ name, slug: slugify(name), poses: poses.map(toPose) }),
);

export function conditionBySlug(slug: string): Condition | undefined {
  return CONDITIONS.find((condition) => condition.slug === slug);
}

/** Health Scanner groupings (from HealthScanScreen.js). */
export const CONDITION_GROUPS: ReadonlyArray<{ label: string; names: readonly string[] }> = [
  {
    label: "Physical",
    names: ["Back Pain", "Hip Alignment Issue", "Scapula Winging", "Knee Pain", "Poor Posture"],
  },
  { label: "Mental", names: ["Stress", "Anxiety", "Insomnia", "Headache"] },
  { label: "Lifestyle", names: ["Digestion Issues", "Weight Loss"] },
];

/** Unique poses across all conditions, in first-seen order. */
export const ALL_POSES: readonly Pose[] = (getAllPoses() as unknown as RawPose[]).map(toPose);

export function poseById(id: string): Pose | undefined {
  return ALL_POSES.find((pose) => pose.id === id);
}

/** Poses at or below the user's level (beginners see beginner poses only). */
export function posesForLevel(poses: readonly Pose[], level: string | undefined): Pose[] {
  return posesForExperience(poses as Pose[], level) as Pose[];
}

export const SURYA_STEPS: readonly SuryaStep[] = (
  rawSuryaSteps as unknown as Array<Omit<SuryaStep, "image"> & { image: RawImage }>
).map((step) => ({ ...step, image: toImage(step.image) }));

const proTips = rawProTips as unknown as Record<string, string[]> & { default: string[] };

export function tipsFor(name: string): string[] {
  return proTips[name] ?? proTips.default;
}

/** RN icon hint for a pose without a photo: { family, name }. */
export function poseIconHint(poseId: string): { family: string; name: string } {
  return rawGetPoseIcon(poseId) as { family: string; name: string };
}

/** Display name for a classifier label, e.g. "tree_pose" -> "Tree Pose". */
export function poseDisplayName(label: string): string {
  return (POSE_COMMON_NAMES as Record<string, string>)[label] ?? label.replace(/_/g, " ");
}

/** Sanskrit name for a classifier label, if known. */
export function poseSanskritName(label: string): string | undefined {
  return (POSE_SANSKRIT_NAMES as Record<string, string>)[label];
}
