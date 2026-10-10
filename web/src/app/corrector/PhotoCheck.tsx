"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CircleCheck, CircleDashed, ImageUp, Loader2, ShieldCheck } from "lucide-react";
import { NO_POSE, analyzeFrame, type Analysis } from "pose-core";
import { ExperienceBadge } from "@/components/ExperienceBadge";
import { poseDisplayName, poseSanskritName } from "@/content";
import { drawSkeleton } from "@/inference/drawSkeleton";
import { decodePhoto, loadPhotoModel } from "@/inference/photoModel";
import { useStored } from "@/lib/hooks/useStored";
import { getProfile } from "@/lib/storage";

/** Freely licensed sample photos (credits in /lab/fixtures/ATTRIBUTION.md). */
const SAMPLES = [
  { file: "30-warrior_pose.jpg", label: "Warrior II" },
  { file: "25-tree_pose.jpg", label: "Tree Pose" },
  { file: "10-downward_dog.jpg", label: "Downward Dog" },
];

type Status =
  | { kind: "idle" }
  | { kind: "loading"; loaded: number; total: number | null }
  | { kind: "analyzing" }
  | { kind: "done"; result: Analysis }
  | { kind: "error"; message: string };

const MB = (bytes: number) => (bytes / 1e6).toFixed(1);

/**
 * Photo analysis, entirely in the browser: MoveNet runs on this device and
 * pose-core applies the server's gate, classifier and correction rules.
 */
export function PhotoCheck({ targetLabel }: { targetLabel: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [hasImage, setHasImage] = useState(false);
  const { value: profile } = useStored(getProfile);
  const level = profile?.experience ?? "beginner";

  const analyze = async (blob: Blob) => {
    try {
      setStatus({ kind: "loading", loaded: 0, total: null });
      const model = await loadPhotoModel((loaded, total) => setStatus({ kind: "loading", loaded, total }));
      setStatus({ kind: "analyzing" });
      const photo = await decodePhoto(blob);
      const { raw } = await model.estimator.estimate(photo, photo.width, photo.height);
      if (canvasRef.current) drawSkeleton(canvasRef.current, photo, photo.width, photo.height, raw);
      setHasImage(true);
      photo.close();
      setStatus({ kind: "done", result: analyzeFrame(raw, { classifier: model.classifier, level }) });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong analysing the photo.",
      });
    }
  };

  const analyzeSample = async (file: string) => {
    const response = await fetch(`/lab/fixtures/${file}`);
    await analyze(await response.blob());
  };

  const busy = status.kind === "loading" || status.kind === "analyzing";

  return (
    <section aria-labelledby="photo-check" className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 id="photo-check" className="text-xl font-bold">
          Check a photo
        </h2>
        <p className="text-muted">
          Pick a full-body photo of yourself holding a pose to see what the coach recognises and how
          to adjust.
        </p>
        <p className="flex items-start gap-2 text-sm text-muted">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          The photo is analysed on this device and never uploaded.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-on-primary hover:bg-primary-strong disabled:opacity-60"
        >
          <ImageUp aria-hidden="true" className="size-5" />
          Choose a photo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          aria-label="Photo to analyse"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void analyze(file);
          }}
        />
        <span className="text-sm text-muted">or try a sample:</span>
        {SAMPLES.map((sample) => (
          <button
            key={sample.file}
            type="button"
            disabled={busy}
            onClick={() => void analyzeSample(sample.file)}
            className="rounded-full border border-border px-3 py-1.5 text-sm font-semibold hover:bg-surface-alt disabled:opacity-60"
          >
            {sample.label}
          </button>
        ))}
      </div>

      <div aria-live="polite">
        {status.kind === "loading" && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm text-muted">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              {status.loaded === 0
                ? "Starting the on-device pose model…"
                : `Downloading the pose model: ${MB(status.loaded)}${status.total ? ` of ${MB(status.total)}` : ""} MB (first time only)`}
            </p>
            {status.total && (
              <div className="h-2 overflow-hidden rounded-full bg-surface-alt">
                <div
                  className="h-full bg-primary transition-[width]"
                  style={{ width: `${(status.loaded / status.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}
        {status.kind === "analyzing" && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            Analysing…
          </p>
        )}
        {status.kind === "error" && (
          <p role="alert" className="text-sm font-medium text-danger">
            {status.message}
          </p>
        )}
      </div>

      <div className={`grid gap-4 ${hasImage ? "md:grid-cols-2" : ""}`}>
        <canvas
          ref={canvasRef}
          aria-label="Your photo with the detected skeleton"
          role="img"
          className={hasImage ? "h-auto w-full rounded-xl bg-black" : "hidden"}
        />
        {status.kind === "done" && <ResultCard result={status.result} level={level} targetLabel={targetLabel} />}
      </div>

      <p className="text-xs text-muted">
        Sample photos from Wikimedia Commons;{" "}
        <a href="/lab/fixtures/ATTRIBUTION.md" className="underline">
          credits and licences
        </a>
        .
      </p>
    </section>
  );
}

function ResultCard({
  result,
  level,
  targetLabel,
}: {
  result: Analysis;
  level: string;
  targetLabel: string | null;
}) {
  const recognised = result.pose !== NO_POSE;
  const matched = targetLabel ? result.pose === targetLabel : null;
  const sanskrit = recognised ? poseSanskritName(result.pose) : undefined;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-alt p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            {recognised ? "Recognised pose" : result.body ? "Not sure which pose this is" : "No full body found"}
          </p>
          {recognised && (
            <>
              <p className="text-2xl font-bold">{poseDisplayName(result.pose)}</p>
              {sanskrit && <p className="italic text-muted">{sanskrit}</p>}
              <p className="text-sm text-muted">Confidence {Math.round(result.confidence * 100)}%</p>
            </>
          )}
        </div>
        <ExperienceBadge level={level} small />
      </div>

      {targetLabel && (
        <p
          className={`flex items-center gap-2 text-sm font-semibold ${matched ? "text-primary" : "text-muted"}`}
        >
          {matched ? (
            <CircleCheck aria-hidden="true" className="size-4" />
          ) : (
            <CircleDashed aria-hidden="true" className="size-4" />
          )}
          Target: {poseDisplayName(targetLabel)} · {matched ? "matched" : "not matched yet"}
        </p>
      )}

      <div>
        <h3 className="text-sm font-bold">Corrections</h3>
        <ol className="mt-2 flex flex-col gap-2">
          {result.corrections.slice(0, 3).map((correction, index) => (
            <li key={correction} className="flex gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-on-primary">
                {index + 1}
              </span>
              <span>{correction}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="text-xs text-muted">
        Feedback strictness follows your level.{" "}
        <Link href="/profile" className="underline">
          Change level
        </Link>
      </p>
    </div>
  );
}
