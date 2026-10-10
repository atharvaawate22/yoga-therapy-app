/**
 * The model behind photo analysis: MoveNet Thunder (the most accurate
 * variant; speed doesn't matter for a single photo) on LiteRT's CPU
 * runtime, plus Thunder's own classifier head. Loaded once per page, on
 * first use.
 */
import { PoseClassifier, type ClassifierArtifact } from "pose-core";
import thunderArtifact from "pose-core/models/classifier.thunder.json";
import { requestPersistentStorage } from "@/lib/pwa/offline";
import { createEstimator, type ProgressFn } from "./index";
import type { PoseEstimator } from "./types";

export interface PhotoModel {
  estimator: PoseEstimator;
  classifier: PoseClassifier;
}

/** The server decodes photos to at most this longest side (MAX_DECODE_SIDE). */
export const MAX_PHOTO_SIDE = 1280;

let loading: Promise<PhotoModel> | null = null;

export function loadPhotoModel(onProgress?: ProgressFn): Promise<PhotoModel> {
  loading ??= (async () => {
    const estimator = await createEstimator("litert-wasm", "thunder", onProgress);
    requestPersistentStorage(); // keep the now-cached model from being evicted
    return { estimator, classifier: new PoseClassifier(thunderArtifact as ClassifierArtifact) };
  })().catch((error: unknown) => {
    loading = null; // allow a retry
    throw error;
  });
  return loading;
}

/**
 * Decode a photo upright (EXIF orientation applied) and scale it down like
 * the server does, so the browser analyses the same pixels.
 */
export async function decodePhoto(blob: Blob): Promise<ImageBitmap> {
  const probe = await createImageBitmap(blob, { imageOrientation: "from-image" });
  const { width, height } = probe;
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(width, height));
  if (scale === 1) return probe;
  probe.close();
  return createImageBitmap(blob, {
    imageOrientation: "from-image",
    resizeWidth: Math.round(width * scale),
    resizeHeight: Math.round(height * scale),
    resizeQuality: "high",
  });
}
