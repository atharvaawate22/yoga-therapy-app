"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CircleCheck,
  CircleDashed,
  Film,
  Images,
  Loader2,
  ShieldCheck,
  Square,
  SwitchCamera,
  Volume2,
  VolumeX,
} from "lucide-react";
import { NO_POSE, TimeWindowVote, analyzeFrame, type Analysis } from "pose-core";
import { ExperienceBadge } from "@/components/ExperienceBadge";
import { poseDisplayName, poseSanskritName } from "@/content";
import demoPhotos from "@/content/demoPhotos.json";
import { drawSkeleton } from "@/inference/drawSkeleton";
import { loadLiveModel, type LiveModel } from "@/inference/liveModel";
import { useSpeech } from "@/lib/hooks/useSpeech";
import { useStored } from "@/lib/hooks/useStored";
import { useWakeLock } from "@/lib/hooks/useWakeLock";
import {
  cameraCount,
  defaultFacing,
  describeCameraError,
  describeVideoError,
  startCamera,
  type CameraProblem,
  type Facing,
} from "@/lib/live/camera";
import { chooseLiveModel, detectDevice, type LiveModelChoice } from "@/lib/live/modelChoice";
import { SessionTracker, type LiveSummary } from "@/lib/live/sessionTracker";
import { SpeechCoach } from "@/lib/live/speechCoach";
import { formatDuration, getProfile, getVoiceEnabled, savePracticeSession } from "@/lib/storage";

/** Credited sample photos (/lab/fixtures/ATTRIBUTION.md) for the no-camera demo. */
const DEMO_PHOTOS = demoPhotos.photos.map((photo) => photo.file);
const DEMO_PHOTO_MS = 4000;

type SourceKind = "camera" | "video" | "demo";

/** An entry in public/demo/videos.json. */
interface SampleVideo {
  file: string;
  label: string;
}

type Phase =
  | { kind: "idle" }
  | { kind: "loading"; loaded: number; total: number | null }
  | { kind: "running" }
  | { kind: "stopped"; summary: LiveSummary | null; saved: boolean }
  | { kind: "error"; problem: CameraProblem };

interface Hud {
  fps: number;
  inferenceMs: number;
}

const MB = (bytes: number) => (bytes / 1e6).toFixed(1);

/**
 * Real-time pose corrections from the camera, a video file, or a photo
 * slideshow demo. MoveNet and the server's pose logic run on this device;
 * nothing is uploaded.
 */
export function LiveCorrector({ targetLabel }: { targetLabel: string | null }) {
  const params = useSearchParams();
  const debug = params.get("debug") === "1";
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [source, setSource] = useState<SourceKind>("camera");
  const [facing, setFacing] = useState<Facing>("user");
  const [canFlip, setCanFlip] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [hud, setHud] = useState<Hud>({ fps: 0, inferenceMs: 0 });
  const [choice, setChoice] = useState<LiveModelChoice | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [sampleVideos, setSampleVideos] = useState<SampleVideo[]>([]);
  const autostarted = useRef(false);

  const { value: profile } = useStored(getProfile);
  const level = profile?.experience ?? "beginner";
  const { speak, unlock, stop: stopSpeech } = useSpeech(voiceOn);
  const running = phase.kind === "running";
  useWakeLock(running);

  // Mutable session state the frame loop reads without re-rendering.
  const session = useRef({
    loopId: 0,
    stream: null as MediaStream | null,
    videoUrl: null as string | null,
    tracker: new SessionTracker(),
    vote: new TimeWindowVote(),
    coach: new SpeechCoach({ poseName: poseDisplayName }),
    source: "camera" as SourceKind,
    level: "beginner",
  });
  useEffect(() => {
    session.current.level = level;
  }, [level]);

  useEffect(() => {
    // Recorded demo clips, listed in public/demo/videos.json (may be absent).
    fetch("/demo/videos.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: SampleVideo[]) => setSampleVideos(Array.isArray(list) ? list : []))
      .catch(() => setSampleVideos([]));
    getVoiceEnabled().then(setVoiceOn);
    detectDevice().then((device) => {
      setFacing(defaultFacing(device.isPhone));
      setChoice(chooseLiveModel(device, new URLSearchParams(window.location.search)));
    });
  }, []);

  /** Stop the loop and media, and save the session if it counts. */
  const stop = useCallback(
    (showSummary = true) => {
      const s = session.current;
      s.loopId++;
      s.stream?.getTracks().forEach((t) => t.stop());
      s.stream = null;
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.srcObject = null;
        video.removeAttribute("src");
      }
      if (s.videoUrl) URL.revokeObjectURL(s.videoUrl);
      s.videoUrl = null;
      stopSpeech();

      const summary = s.tracker.finish(Date.now());
      // Only camera sessions are practice; the demo and video files aren't.
      const saved = Boolean(summary?.worthSaving && s.source === "camera");
      if (saved && summary) {
        void savePracticeSession({
          type: "corrector",
          title: "Pose Corrector",
          posesCompleted: summary.poseCount,
          poseCount: summary.poseCount,
          durationSec: summary.durationSec,
        });
      }
      if (showSummary) setPhase({ kind: "stopped", summary, saved });
    },
    [stopSpeech],
  );

  // Leaving the page ends (and saves) the session.
  useEffect(() => () => stop(false), [stop]);

  const runLoop = useCallback(
    async (model: LiveModel, kind: SourceKind, loopId: number) => {
      const s = session.current;
      const video = videoRef.current!;
      const canvas = canvasRef.current!;
      const demo = kind === "demo" ? await Promise.all(DEMO_PHOTOS.map(loadPhoto)) : [];
      const demoStart = performance.now();
      const frameTimes: number[] = [];

      while (s.loopId === loopId) {
        let frame: CanvasImageSource;
        let width: number;
        let height: number;
        if (kind === "demo") {
          const photo = demo[Math.floor((performance.now() - demoStart) / DEMO_PHOTO_MS) % demo.length]!;
          [frame, width, height] = [photo, photo.width, photo.height];
        } else {
          [frame, width, height] = [video, video.videoWidth, video.videoHeight];
        }
        if (!width || !height) {
          await nextFrame(null);
          continue;
        }

        const { raw, timings } = await model.estimator.estimate(frame, width, height);
        if (s.loopId !== loopId) break;
        const now = performance.now();
        const result = analyzeFrame(raw, {
          classifier: model.classifier,
          level: s.level,
          vote: s.vote,
          timeMs: now,
        });
        // The demo draws the photo too; video plays underneath the overlay.
        drawSkeleton(canvas, kind === "demo" ? frame : null, width, height, raw);
        s.tracker.frame(result.pose);
        const utterance = s.coach.update(result.pose, result.corrections[0], now);
        if (utterance) speak(utterance);

        frameTimes.push(now);
        while (frameTimes.length && now - frameTimes[0]! > 1000) frameTimes.shift();
        setAnalysis(result);
        setHud({ fps: frameTimes.length, inferenceMs: timings.inferenceMs });
        await nextFrame(kind === "demo" ? null : video);
      }
    },
    [speak],
  );

  const start = async (kind: SourceKind, video?: File | string, cameraFacing: Facing = facing) => {
    if (!choice) return;
    unlock(); // iOS: speech must begin from a tap
    stop(false);
    const s = session.current;
    const loopId = ++s.loopId;
    s.source = kind;
    s.vote.reset();
    s.coach.reset();
    setSource(kind);
    setAnalysis(null);
    try {
      setPhase({ kind: "loading", loaded: 0, total: null });
      const model = await loadLiveModel(choice, (loaded, total) =>
        setPhase({ kind: "loading", loaded, total }),
      );
      const videoEl = videoRef.current!;
      const clip = video;
      if (kind === "camera") {
        s.stream = await startCamera(cameraFacing);
        videoEl.srcObject = s.stream;
        setCanFlip((await cameraCount()) > 1);
      } else if (kind === "video" && clip) {
        if (typeof clip === "string") {
          videoEl.src = clip;
        } else {
          s.videoUrl = URL.createObjectURL(clip);
          videoEl.src = s.videoUrl;
        }
        videoEl.loop = true;
      }
      if (kind !== "demo") await videoEl.play();
      if (s.loopId !== loopId) return;
      s.tracker.start(Date.now());
      setPhase({ kind: "running" });
      window.scrollTo({ top: 0 });
      void runLoop(model, kind, loopId);
    } catch (error) {
      stop(false);
      setPhase({
        kind: "error",
        problem:
          kind === "camera" ? describeCameraError(error) : describeVideoError(error, document.hidden),
      });
    }
  };

  // ?demo=1 (for links from the README/portfolio) starts the demo right away.
  // Speech needs a tap on iOS, so it may stay silent until the user taps.
  useEffect(() => {
    if (choice && params.get("demo") === "1" && !autostarted.current) {
      autostarted.current = true;
      void start("demo");
    }
  });

  const flip = () => {
    const next: Facing = facing === "user" ? "environment" : "user";
    setFacing(next);
    if (running && source === "camera") void start("camera", undefined, next);
  };

  const mirrored = source === "camera" && facing === "user";
  const showStage = running || phase.kind === "loading";
  const matched = targetLabel && analysis ? analysis.pose === targetLabel : null;

  return (
    <section aria-labelledby="live-heading" className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 id="live-heading" className="text-xl font-bold">
          Live corrections
        </h2>
        <p className="text-muted">
          Prop your phone or laptop up so your whole body is in view, then hold a pose. Corrections
          are spoken aloud.
        </p>
        <p className="flex items-start gap-2 text-sm text-muted">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          Video is analysed on this device and never uploaded or recorded.
        </p>
      </div>

      {!running && phase.kind !== "loading" && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void start("camera")}
            disabled={!choice}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-on-primary hover:bg-primary-strong disabled:opacity-60"
          >
            <Camera aria-hidden="true" className="size-5" />
            Start camera
          </button>
          <button
            type="button"
            onClick={() => void start("demo")}
            disabled={!choice}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold hover:bg-surface-alt disabled:opacity-60"
          >
            <Images aria-hidden="true" className="size-5" />
            Try the demo (no camera)
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!choice}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold hover:bg-surface-alt disabled:opacity-60"
          >
            <Film aria-hidden="true" className="size-5" />
            Use a video
          </button>
          {sampleVideos.map((clip) => (
            <button
              key={clip.file}
              type="button"
              onClick={() => void start("video", `/demo/${clip.file}`)}
              disabled={!choice}
              className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold hover:bg-surface-alt disabled:opacity-60"
            >
              <Film aria-hidden="true" className="size-5" />
              Sample: {clip.label}
            </button>
          ))}
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            aria-label="Video to analyse"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void start("video", file);
            }}
          />
        </div>
      )}

      {phase.kind === "error" && (
        <div role="alert" className="rounded-xl border border-[#ffcdd2] bg-[#ffebee] p-4 text-[#7f1d1d] dark:border-[#5c2b2b] dark:bg-[#2b1414] dark:text-[#fecaca]">
          <p className="font-semibold">{phase.problem.title}</p>
          <p className="mt-1 text-sm">{phase.problem.body}</p>
          {phase.problem.suggestDemo && (
            <p className="mt-2 text-sm">You can still try the demo, which needs no camera.</p>
          )}
        </div>
      )}

      {phase.kind === "stopped" && phase.summary && (
        <div role="status" className="rounded-xl bg-surface-alt p-4">
          <p className="font-semibold text-primary">
            {phase.saved ? "Session saved to your progress" : "Session ended"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {formatDuration(phase.summary.durationSec)} ·{" "}
            {phase.summary.poseCount} pose{phase.summary.poseCount === 1 ? "" : "s"} recognised
            {phase.summary.topPose ? ` · most held: ${poseDisplayName(phase.summary.topPose)}` : ""}
            {!phase.saved && source === "camera" ? " · camera sessions under 15 s with no pose aren't saved" : ""}
          </p>
        </div>
      )}

      {phase.kind === "loading" && (
        <div aria-live="polite" className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            {phase.loaded === 0
              ? "Starting the on-device pose model…"
              : `Downloading the pose model: ${MB(phase.loaded)}${phase.total ? ` of ${MB(phase.total)}` : ""} MB (first time only)`}
          </p>
          {phase.total && (
            <div className="h-2 overflow-hidden rounded-full bg-surface-alt">
              <div className="h-full bg-primary" style={{ width: `${(phase.loaded / phase.total) * 100}%` }} />
            </div>
          )}
        </div>
      )}

      <div className={showStage ? "flex flex-col gap-3" : "hidden"}>
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            className={`block h-auto w-full ${source === "demo" ? "hidden" : ""}`}
            style={mirrored ? { transform: "scaleX(-1)" } : undefined}
          />
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className={source === "demo" ? "block h-auto w-full" : "absolute inset-0 h-full w-full"}
            style={mirrored ? { transform: "scaleX(-1)" } : undefined}
          />
          {running && (
            <div className="absolute inset-x-2 top-2 flex flex-col gap-1 rounded-lg bg-black/60 p-3 text-white">
              <p className="text-xs font-bold uppercase tracking-wider text-[#b4ffb0]">
                {source === "demo" ? "Demo · sample photos" : source === "video" ? "Video" : "Live"}
              </p>
              <p className="text-lg font-bold" aria-live="polite">
                {analysis && analysis.pose !== NO_POSE ? poseDisplayName(analysis.pose) : "Looking for a pose…"}
              </p>
              {analysis && analysis.pose !== NO_POSE && (
                <p className="text-sm text-white/80">
                  {poseSanskritName(analysis.pose)} · {Math.round(analysis.confidence * 100)}%
                </p>
              )}
              <p className="text-sm text-[#d6edff]">{analysis?.corrections[0] ?? "Hold still…"}</p>
            </div>
          )}
          {debug && running && choice && (
            <p className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 font-mono text-xs text-white">
              {hud.fps} fps · {hud.inferenceMs.toFixed(0)} ms · {choice.variant}/{choice.accelerator} ({choice.reason})
              {analysis && ` · body ${analysis.body ? "yes" : "no"}`}
              {analysis && topGuess(analysis)}
            </p>
          )}
        </div>

        {running && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => stop()}
              className="flex items-center gap-2 rounded-xl bg-[#c62828] px-4 py-3 font-semibold text-white hover:bg-[#a31f1f]"
            >
              <Square aria-hidden="true" className="size-4" fill="currentColor" />
              Stop
            </button>
            {source === "camera" && canFlip && (
              <button
                type="button"
                onClick={flip}
                className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold hover:bg-surface-alt"
              >
                <SwitchCamera aria-hidden="true" className="size-5" />
                Flip
              </button>
            )}
            <button
              type="button"
              onClick={() => setVoiceOn((on) => !on)}
              aria-pressed={voiceOn}
              aria-label="Voice corrections"
              className="flex items-center gap-2 rounded-xl border border-border px-4 py-3 font-semibold hover:bg-surface-alt"
            >
              {voiceOn ? <Volume2 aria-hidden="true" className="size-5" /> : <VolumeX aria-hidden="true" className="size-5" />}
              {voiceOn ? "Voice on" : "Voice off"}
            </button>
            <ExperienceBadge level={level} small />
          </div>
        )}

        {running && analysis && (
          <div className="flex flex-col gap-3 rounded-xl bg-surface-alt p-4">
            {targetLabel && (
              <p className={`flex items-center gap-2 font-semibold ${matched ? "text-primary" : "text-muted"}`}>
                {matched ? <CircleCheck aria-hidden="true" className="size-5" /> : <CircleDashed aria-hidden="true" className="size-5" />}
                Target: {poseDisplayName(targetLabel)} · {matched ? "matched" : "not matched yet"}
              </p>
            )}
            <div>
              <h3 className="text-sm font-bold">Corrections</h3>
              <ol className="mt-2 flex flex-col gap-2">
                {analysis.corrections.slice(0, 3).map((correction, index) => (
                  <li key={correction} className="flex gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-on-primary">
                      {index + 1}
                    </span>
                    <span>{correction}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted">
        Demo photos from Wikimedia Commons;{" "}
        <a href="/lab/fixtures/ATTRIBUTION.md" className="underline">
          credits and licences
        </a>
        .
      </p>
    </section>
  );
}

/** Debug overlay: the classifier's top label this frame, before the vote. */
function topGuess(analysis: Analysis): string {
  const [label, p] = Object.entries(analysis.probabilities).sort((a, b) => b[1] - a[1])[0] ?? [];
  return label ? ` · top ${label} ${(p! * 100).toFixed(0)}%` : "";
}

async function loadPhoto(file: string): Promise<ImageBitmap> {
  const blob = await (await fetch(`/lab/fixtures/${file}`)).blob();
  return createImageBitmap(blob);
}

/**
 * Wait for the next video frame when the browser can tell us (so the same
 * frame isn't analysed twice), otherwise the next animation frame.
 */
function nextFrame(video: HTMLVideoElement | null): Promise<void> {
  return new Promise((resolve) => {
    if (video && "requestVideoFrameCallback" in video) video.requestVideoFrameCallback(() => resolve());
    else requestAnimationFrame(() => resolve());
  });
}
