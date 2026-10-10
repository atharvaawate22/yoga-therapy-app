"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PoseClassifier,
  hasBody,
  keypointsFromMoveNet,
  normalizeKeypoints,
  type ClassifierArtifact,
} from "pose-core";
import lightningArtifact from "pose-core/models/classifier.lightning.json";
import thunderArtifact from "pose-core/models/classifier.thunder.json";
import { PageHeader } from "@/components/PageHeader";
import {
  RUNTIMES,
  createEstimator,
  type MoveNetVariant,
  type PoseEstimator,
  type RuntimeId,
} from "@/inference";
import { drawSkeleton } from "@/inference/drawSkeleton";
import { compareRaw, percentile, type ParityResult } from "@/inference/parity";

/** backend/export_lab_fixtures.py output. */
interface Manifest {
  inputSize: Record<MoveNetVariant, number>;
  images: Array<{
    file: string;
    label: string;
    expected: Record<MoveNetVariant, { raw: number[]; label: string; prob: number; hasBody: boolean }>;
  }>;
}

interface ParityRow extends ParityResult {
  file: string;
  raw: number[];
  label: string;
  probability: number;
  hasBody: boolean;
  /** Same top-1 label as the server pipeline on this image. */
  labelMatches: boolean;
  bodyMatches: boolean;
  /** Same result the user would see (after the body gate and confidence cutoff). */
  servedMatches: boolean;
}

// Each MoveNet variant has its own classifier head.
const classifiers: Record<MoveNetVariant, PoseClassifier> = {
  thunder: new PoseClassifier(thunderArtifact as ClassifierArtifact),
  lightning: new PoseClassifier(lightningArtifact as ClassifierArtifact),
};

/**
 * What the server's image mode would return: a pose only if a body is
 * visible and the classifier clears MIN_CLASS_PROB (yoga_pose_engine.py).
 */
function served(label: string, probability: number, body: boolean): string {
  const { minClassProb } = classifiers.thunder.artifact.thresholds;
  return body && probability >= minClassProb ? label : "nopose";
}

/** The server's post-MoveNet steps, via pose-core. */
function classify(raw: ArrayLike<number>, variant: MoveNetVariant) {
  const classifier = classifiers[variant];
  const keypoints = keypointsFromMoveNet(raw);
  const prediction = classifier.predict(normalizeKeypoints(keypoints));
  return { ...prediction, hasBody: hasBody(keypoints, classifier.artifact.thresholds) };
}

/** What the lab exposes for scripted runs (and score_web_parity.py). */
export interface LabRun {
  runtime: RuntimeId;
  variant: MoveNetVariant;
  userAgent: string;
  initMs: number;
  parity?: ParityRow[];
  benchmark?: { runs: number; preprocessP50: number; inferenceP50: number; inferenceP95: number; totalP50: number };
}

declare global {
  interface Window {
    __labRun?: LabRun;
  }
}

const FIXTURES = "/lab/fixtures";

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const blob = await (await fetch(url)).blob();
  return createImageBitmap(blob, { imageOrientation: "from-image" });
}

const fmt = (n: number, digits = 1) => (Number.isFinite(n) ? n.toFixed(digits) : "–");

export function InferenceLab() {
  const [runtime, setRuntime] = useState<RuntimeId>("litert-wasm");
  const [variant, setVariant] = useState<MoveNetVariant>("thunder");
  const [estimator, setEstimator] = useState<PoseEstimator | null>(null);
  const [status, setStatus] = useState("Pick a runtime and model, then load it.");
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<LabRun | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);

  useEffect(() => {
    fetch(`${FIXTURES}/manifest.json`)
      .then((r) => r.json())
      .then(setManifest)
      .catch(() => setStatus("Couldn't load the fixture manifest."));
  }, []);

  useEffect(() => () => estimator?.dispose(), [estimator]);

  const publish = (next: LabRun) => {
    setRun(next);
    window.__labRun = next;
  };

  const load = async () => {
    setBusy(true);
    setEstimator(null);
    setStatus(`Loading ${variant} on ${runtime}…`);
    try {
      const t0 = performance.now();
      const created = await createEstimator(runtime, variant);
      // First inference compiles shaders / warms caches; count it as setup.
      const warm = manifest ? await loadBitmap(`${FIXTURES}/${manifest.images[0]!.file}`) : null;
      if (warm) await created.estimate(warm, warm.width, warm.height);
      const initMs = performance.now() - t0;
      setEstimator(created);
      publish({ runtime, variant, userAgent: navigator.userAgent, initMs });
      setStatus(`Ready: ${runtime} · ${variant} (load + first inference ${fmt(initMs, 0)} ms)`);
    } catch (error) {
      setStatus(`Failed to load: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const runParity = async () => {
    if (!estimator || !manifest || !run) return;
    setBusy(true);
    const rows: ParityRow[] = [];
    for (const [index, image] of manifest.images.entries()) {
      setStatus(`Parity: image ${index + 1}/${manifest.images.length}`);
      const bitmap = await loadBitmap(`${FIXTURES}/${image.file}`);
      const { raw } = await estimator.estimate(bitmap, bitmap.width, bitmap.height);
      bitmap.close();
      const expected = image.expected[estimator.variant];
      const result = classify(raw, estimator.variant);
      rows.push({
        file: image.file,
        raw: Array.from(raw),
        label: result.label,
        probability: result.probability,
        hasBody: result.hasBody,
        labelMatches: result.label === expected.label,
        bodyMatches: result.hasBody === expected.hasBody,
        servedMatches:
          served(result.label, result.probability, result.hasBody) ===
          served(expected.label, expected.prob, expected.hasBody),
        ...compareRaw(raw, expected.raw),
      });
    }
    publish({ ...run, parity: rows });
    setStatus(`Parity done on ${rows.length} images.`);
    setBusy(false);
  };

  const runBenchmark = async () => {
    if (!estimator || !manifest || !run) return;
    setBusy(true);
    setStatus("Benchmarking 50 frames…");
    const bitmap = await loadBitmap(`${FIXTURES}/${manifest.images[0]!.file}`);
    const pre: number[] = [];
    const inf: number[] = [];
    for (let i = 0; i < 55; i++) {
      const { timings } = await estimator.estimate(bitmap, bitmap.width, bitmap.height);
      if (i >= 5) {
        pre.push(timings.preprocessMs);
        inf.push(timings.inferenceMs);
      }
    }
    bitmap.close();
    const totals = pre.map((p, i) => p + inf[i]!);
    publish({
      ...run,
      benchmark: {
        runs: pre.length,
        preprocessP50: percentile(pre, 50),
        inferenceP50: percentile(inf, 50),
        inferenceP95: percentile(inf, 95),
        totalP50: percentile(totals, 50),
      },
    });
    setStatus("Benchmark done.");
    setBusy(false);
  };

  const parity = run?.parity;
  const summary = parity && {
    mean: parity.reduce((s, r) => s + r.meanCoordError, 0) / parity.length,
    p95: percentile(
      parity.map((r) => r.meanCoordError),
      95,
    ),
    max: Math.max(...parity.map((r) => r.maxCoordError)),
    score: parity.reduce((s, r) => s + r.meanScoreError, 0) / parity.length,
    labels: parity.filter((r) => r.labelMatches).length,
    bodies: parity.filter((r) => r.bodyMatches).length,
    served: parity.filter((r) => r.servedMatches).length,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inference lab"
        subtitle="Developer page for milestone M2: MoveNet running in this browser, checked against the server's output on the same images."
        backHref="/about"
        backLabel="About"
      />

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Runtime
            <select
              value={runtime}
              onChange={(e) => setRuntime(e.target.value as RuntimeId)}
              className="rounded-lg border border-border bg-surface px-3 py-2 font-normal"
            >
              {RUNTIMES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} ({r.note})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Model
            <select
              value={variant}
              onChange={(e) => setVariant(e.target.value as MoveNetVariant)}
              className="rounded-lg border border-border bg-surface px-3 py-2 font-normal"
            >
              <option value="lightning">MoveNet Lightning (192 px, 9.4 MB)</option>
              <option value="thunder">MoveNet Thunder (256 px, 25 MB)</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            disabled={busy || !manifest}
            className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary disabled:opacity-50"
          >
            Load model
          </button>
          <button
            type="button"
            onClick={runParity}
            disabled={busy || !estimator}
            className="rounded-lg border border-border px-4 py-2 font-semibold disabled:opacity-50"
          >
            Run parity ({manifest?.images.length ?? "…"} images)
          </button>
          <button
            type="button"
            onClick={runBenchmark}
            disabled={busy || !estimator}
            className="rounded-lg border border-border px-4 py-2 font-semibold disabled:opacity-50"
          >
            Benchmark
          </button>
        </div>
        <p role="status" className="text-sm text-muted">
          {status}
        </p>
      </section>

      {run?.benchmark && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="font-semibold">Benchmark ({run.benchmark.runs} frames)</h2>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted">Inference p50</dt>
              <dd className="text-lg font-bold tabular-nums">{fmt(run.benchmark.inferenceP50)} ms</dd>
            </div>
            <div>
              <dt className="text-muted">Inference p95</dt>
              <dd className="text-lg font-bold tabular-nums">{fmt(run.benchmark.inferenceP95)} ms</dd>
            </div>
            <div>
              <dt className="text-muted">Pre-process p50</dt>
              <dd className="text-lg font-bold tabular-nums">{fmt(run.benchmark.preprocessP50)} ms</dd>
            </div>
            <div>
              <dt className="text-muted">Max FPS (p50)</dt>
              <dd className="text-lg font-bold tabular-nums">{fmt(1000 / run.benchmark.totalP50)}</dd>
            </div>
          </dl>
        </section>
      )}

      {summary && parity && (
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <h2 className="font-semibold">Parity with the server ({parity.length} images)</h2>
          <p className="text-sm text-muted">
            Keypoint error in fractions of the frame, over keypoints the server scored ≥ 0.3.
            Labels come from the server&apos;s classifier, run in the browser by pose-core.
          </p>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted">Same served result</dt>
              <dd className="text-lg font-bold tabular-nums">
                {summary.served}/{parity.length}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Same label as server</dt>
              <dd className="text-lg font-bold tabular-nums">
                {summary.labels}/{parity.length}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Same body-gate result</dt>
              <dd className="text-lg font-bold tabular-nums">
                {summary.bodies}/{parity.length}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Mean |Δ|</dt>
              <dd className="text-lg font-bold tabular-nums">{fmt(summary.mean, 4)}</dd>
            </div>
            <div>
              <dt className="text-muted">p95 image mean</dt>
              <dd className="text-lg font-bold tabular-nums">{fmt(summary.p95, 4)}</dd>
            </div>
            <div>
              <dt className="text-muted">Worst keypoint</dt>
              <dd className="text-lg font-bold tabular-nums">{fmt(summary.max, 4)}</dd>
            </div>
            <div>
              <dt className="text-muted">Mean score |Δ|</dt>
              <dd className="text-lg font-bold tabular-nums">{fmt(summary.score, 4)}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(JSON.stringify(run))}
            className="w-fit rounded-lg border border-border px-3 py-1.5 text-sm font-semibold"
          >
            Copy results JSON
          </button>
          <details>
            <summary className="cursor-pointer text-sm font-semibold">Per image</summary>
            <table className="mt-2 w-full text-left text-sm tabular-nums">
              <thead>
                <tr className="text-muted">
                  <th className="py-1">Image</th>
                  <th>Mean |Δ|</th>
                  <th>Max |Δ|</th>
                  <th>Points</th>
                  <th>Label</th>
                </tr>
              </thead>
              <tbody>
                {parity.map((row) => (
                  <tr key={row.file} className="border-t border-border">
                    <td className="py-1">{row.file}</td>
                    <td>{fmt(row.meanCoordError, 4)}</td>
                    <td>{fmt(row.maxCoordError, 4)}</td>
                    <td>{row.confidentKeypoints}</td>
                    <td className={row.labelMatches ? "" : "font-semibold text-danger"}>
                      {row.label}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
      )}

      {estimator && manifest && <LiveView estimator={estimator} manifest={manifest} />}
    </div>
  );
}

type Source = { kind: "fixture"; index: number } | { kind: "camera" } | { kind: "video"; url: string };

/** Continuous inference on a source with a skeleton overlay and FPS. */
function LiveView({ estimator, manifest }: { estimator: PoseEstimator; manifest: Manifest }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [source, setSource] = useState<Source>({ kind: "fixture", index: 0 });
  const [running, setRunning] = useState(false);
  const [hud, setHud] = useState({ fps: 0, inferenceMs: 0 });
  const [error, setError] = useState<string | null>(null);

  const draw = useCallback(
    (frame: CanvasImageSource, width: number, height: number, raw: Float32Array) => {
      if (canvasRef.current) drawSkeleton(canvasRef.current, frame, width, height, raw);
    },
    [],
  );

  useEffect(() => {
    if (!running) return;
    let stopped = false;
    let video: HTMLVideoElement | null = null;
    let stream: MediaStream | null = null;
    let bitmap: ImageBitmap | null = null;

    const start = async () => {
      setError(null);
      try {
        if (source.kind === "fixture") {
          bitmap = await loadBitmap(`${FIXTURES}/${manifest.images[source.index]!.file}`);
        } else {
          video = document.createElement("video");
          video.muted = true;
          video.playsInline = true;
          video.loop = true;
          if (source.kind === "camera") {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
              audio: false,
            });
            video.srcObject = stream;
          } else {
            video.src = source.url;
          }
          await video.play();
        }
      } catch (e) {
        setError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
        setRunning(false);
        return;
      }

      const frameTimes: number[] = [];
      while (!stopped) {
        const frame: CanvasImageSource = bitmap ?? video!;
        const width = bitmap?.width ?? video!.videoWidth;
        const height = bitmap?.height ?? video!.videoHeight;
        if (!width || !height) {
          await new Promise((r) => setTimeout(r, 50));
          continue;
        }
        const { raw, timings } = await estimator.estimate(frame, width, height);
        if (stopped) break;
        draw(frame, width, height, raw);
        const now = performance.now();
        frameTimes.push(now);
        while (frameTimes.length && now - frameTimes[0]! > 1000) frameTimes.shift();
        setHud({ fps: frameTimes.length, inferenceMs: timings.inferenceMs });
        // Yield so the page stays responsive.
        await new Promise((r) => requestAnimationFrame(r));
      }
    };
    void start();

    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
      video?.pause();
      bitmap?.close();
    };
  }, [running, source, estimator, manifest, draw]);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="font-semibold">Live</h2>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Source"
          value={source.kind === "fixture" ? `fixture-${source.index}` : source.kind}
          onChange={(e) => {
            setRunning(false);
            const v = e.target.value;
            if (v === "camera") setSource({ kind: "camera" });
            else if (v.startsWith("fixture-")) setSource({ kind: "fixture", index: Number(v.slice(8)) });
          }}
          className="rounded-lg border border-border bg-surface px-3 py-2"
        >
          <option value="camera">Camera</option>
          {source.kind === "video" && <option value="video">Video file</option>}
          {manifest.images.map((image, index) => (
            <option key={image.file} value={`fixture-${index}`}>
              Image: {image.file}
            </option>
          ))}
        </select>
        <label className="cursor-pointer rounded-lg border border-border px-3 py-2 text-sm font-semibold">
          Video file…
          <input
            type="file"
            accept="video/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setRunning(false);
              setSource({ kind: "video", url: URL.createObjectURL(file) });
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary"
        >
          {running ? "Stop" : "Start"}
        </button>
        <span className="text-sm tabular-nums text-muted" aria-live="off">
          {running ? `${hud.fps} fps · inference ${fmt(hud.inferenceMs)} ms` : "Stopped"}
        </span>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <p className="text-xs text-muted">
        Camera frames are processed in this browser and never uploaded.
      </p>
      <canvas ref={canvasRef} className="w-full max-w-xl rounded-lg bg-black" />
    </section>
  );
}
