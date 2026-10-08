/** Camera access for the live corrector, with plain-language failures. */

export type Facing = "user" | "environment";

export interface CameraProblem {
  title: string;
  body: string;
  /** Offer the no-camera demo instead. */
  suggestDemo: boolean;
}

/** Phones default to the rear camera (as the APK does); laptops have only a front one. */
export function defaultFacing(isPhone: boolean): Facing {
  return isPhone ? "environment" : "user";
}

export async function startCamera(facing: Facing): Promise<MediaStream> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error("insecure"), { name: "SecurityError" });
  }
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
  });
}

export async function cameraCount(): Promise<number> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "videoinput").length;
  } catch {
    return 0;
  }
}

/** Turn a getUserMedia failure into something a user can act on. */
export function describeCameraError(error: unknown): CameraProblem {
  const name = error instanceof Error || error instanceof DOMException ? error.name : "";
  switch (name) {
    case "NotAllowedError":
      return {
        title: "Camera access is blocked",
        body: "Allow camera access for this site in your browser: tap the camera or lock icon next to the address, then reload. On iPhone, check Settings → Safari → Camera.",
        suggestDemo: true,
      };
    case "NotFoundError":
    case "OverconstrainedError":
      return {
        title: "No camera found",
        body: "This device doesn't seem to have a camera available.",
        suggestDemo: true,
      };
    case "NotReadableError":
    case "AbortError":
      return {
        title: "The camera is busy",
        body: "Another app or browser tab is using the camera. Close it and try again.",
        suggestDemo: true,
      };
    case "SecurityError":
      return {
        title: "Camera needs a secure connection",
        body: "Browsers only allow the camera on https:// pages (or localhost).",
        suggestDemo: true,
      };
    default:
      return {
        title: "Couldn't start the camera",
        body: error instanceof Error && error.message ? error.message : "Something went wrong.",
        suggestDemo: true,
      };
  }
}

/** Turn a video playback failure into something a user can act on. */
export function describeVideoError(error: unknown, pageHidden = false): CameraProblem {
  const name = error instanceof Error || error instanceof DOMException ? error.name : "";
  if (name === "NotSupportedError") {
    return {
      title: "That video can't be played",
      body: "Your browser doesn't support this video's format. Try an MP4 (H.264) or WebM file.",
      suggestDemo: true,
    };
  }
  if (name === "AbortError" && pageHidden) {
    return {
      title: "The video was paused",
      body: "Browsers pause videos in tabs that aren't visible. Keep this tab in front and try again.",
      suggestDemo: true,
    };
  }
  return {
    title: "Couldn't play the video",
    body: error instanceof Error && error.message ? error.message : "Something went wrong.",
    suggestDemo: true,
  };
}
