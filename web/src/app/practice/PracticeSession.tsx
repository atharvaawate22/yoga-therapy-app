"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  SkipForward,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PoseImage } from "@/components/PoseImage";
import { useSpeech } from "@/lib/hooks/useSpeech";
import { useWakeLock } from "@/lib/hooks/useWakeLock";
import {
  PREP_SECONDS,
  initialPracticeState,
  practiceReducer,
  progressPercent,
  type PracticeAction,
  type PracticePose,
  type PracticeState,
} from "@/lib/practice/practiceMachine";
import {
  formatDuration,
  getVoiceEnabled,
  parseDurationSec,
  savePracticeSession,
} from "@/lib/storage";
import type { Routine } from "./PracticeLoader";

/** How often the wall clock is checked; whole seconds are applied as ticks. */
const CLOCK_POLL_MS = 250;

export function PracticeSession({ routine }: { routine: Routine }) {
  const { title, poses, type, backHref } = routine;
  const router = useRouter();

  const timedPoses = useMemo<PracticePose[]>(
    () => poses.map((pose) => ({ name: pose.name, holdSec: parseDurationSec(pose.duration) })),
    [poses],
  );
  const [state, dispatch] = useReducer(
    (s: PracticeState, action: PracticeAction) =>
      practiceReducer(s, action, timedPoses, formatDuration),
    undefined,
    initialPracticeState,
  );

  const [started, setStarted] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const { speak, unlock } = useSpeech(voiceOn);
  const running = started && state.phase !== "done";
  const { supported: wakeLockSupported } = useWakeLock(running);

  useEffect(() => {
    getVoiceEnabled().then(setVoiceOn);
  }, []);

  // Speak each new cue (an empty cue stops speech).
  useEffect(() => {
    if (state.cue) speak(state.cue.text);
  }, [state.cue, speak]);

  // Wall-clock ticks: background tabs throttle timers, so apply however many
  // whole seconds actually passed instead of counting interval callbacks.
  useEffect(() => {
    if (!running || state.paused) return;
    let last = Date.now();
    const id = setInterval(() => {
      const seconds = Math.floor((Date.now() - last) / 1000);
      if (seconds > 0) {
        last += seconds * 1000;
        dispatch({ type: "tick", seconds });
      }
    }, CLOCK_POLL_MS);
    return () => clearInterval(id);
  }, [running, state.paused]);

  // Saving: once when the routine ends, or with whatever was completed if
  // the user leaves mid-way (navigation away or closing the tab). Poses that
  // were only skipped don't count, and an empty session isn't saved.
  const stateRef = useRef(state);
  const savedRef = useRef(false);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const save = useCallback(() => {
    const current = stateRef.current;
    if (savedRef.current || current.completed.size === 0) return;
    savedRef.current = true;
    void savePracticeSession({
      type,
      title,
      posesCompleted: current.completed.size,
      poseCount: poses.length,
      durationSec: current.elapsedSec,
    });
  }, [type, title, poses.length]);

  useEffect(() => {
    if (state.phase === "done") save();
  }, [state.phase, save]);

  useEffect(() => {
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [save]);

  const start = () => {
    unlock(); // iOS: speech must start from a tap
    setStarted(true);
    dispatch({ type: "announce" });
    window.scrollTo({ top: 0 });
  };

  const pose = poses[state.poseIndex]!;

  if (!started) {
    const totalSec = timedPoses.reduce((sum, p) => sum + p.holdSec, 0);
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <Link href={backHref} className="text-sm font-semibold text-primary hover:underline">
          ← Back
        </Link>
        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            Guided practice
          </p>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted">
            {poses.length} {poses.length === 1 ? "pose" : "poses"} · about{" "}
            {formatDuration(totalSec + poses.length * PREP_SECONDS)} including get-ready time
          </p>
        </header>
        <ol className="flex flex-col gap-2">
          {poses.map((p, index) => (
            <li
              key={`${p.id}-${index}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-surface-alt text-sm font-bold text-primary">
                {index + 1}
              </span>
              <span className="flex-1 font-medium">{p.name}</span>
              <span className="text-sm text-muted">{p.duration}</span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={start}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-4 text-lg font-semibold text-on-primary hover:bg-primary-strong"
        >
          <Play aria-hidden="true" className="size-5" fill="currentColor" />
          Start
        </button>
        <p className="text-center text-sm text-muted">
          Voice cues are {voiceOn ? "on" : "off"}.{" "}
          {wakeLockSupported
            ? "The screen stays on while you practice."
            : "Your browser can't keep the screen on, so you may want a longer screen timeout."}
        </p>
      </div>
    );
  }

  if (state.phase === "done") {
    const nothingCompleted = state.completed.size === 0;
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-8 text-center">
        <span className="bg-streak flex size-16 items-center justify-center rounded-full">
          {nothingCompleted ? (
            <SkipForward aria-hidden="true" className="size-8" />
          ) : (
            <Trophy aria-hidden="true" className="size-8" />
          )}
        </span>
        <h1 className="text-3xl font-bold">
          {nothingCompleted ? "Session ended" : "Session complete!"}
        </h1>
        <p className="text-muted">
          {nothingCompleted
            ? `${title} · no poses were held to the end, so nothing was saved`
            : title}
        </p>
        <dl className="grid w-full grid-cols-2 divide-x divide-border rounded-xl border border-border bg-surface">
          <div className="p-4">
            <dd className="text-2xl font-bold">
              {state.completed.size}/{poses.length}
            </dd>
            <dt className="text-sm text-muted">Poses</dt>
          </div>
          <div className="p-4">
            <dd className="text-2xl font-bold">{formatDuration(state.elapsedSec)}</dd>
            <dt className="text-sm text-muted">Duration</dt>
          </div>
        </dl>
        <Link
          href="/progress"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary hover:bg-primary-strong"
        >
          <ChartColumn aria-hidden="true" className="size-5" />
          View my progress
        </Link>
        <Link href={backHref} className="font-semibold text-muted hover:underline">
          Done
        </Link>
      </div>
    );
  }

  const isPrep = state.phase === "prep";
  const progress = progressPercent(state, poses.length);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <div
        role="progressbar"
        aria-label="Routine progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        className="h-2 overflow-hidden rounded-full bg-surface-alt"
      >
        <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Pose {state.poseIndex + 1}/{poses.length} · {title}
        </span>
        <button
          type="button"
          onClick={() => setVoiceOn((on) => !on)}
          aria-pressed={voiceOn}
          aria-label="Voice cues"
          className="rounded-full p-2 hover:bg-surface-alt"
        >
          {voiceOn ? (
            <Volume2 aria-hidden="true" className="size-5" />
          ) : (
            <VolumeX aria-hidden="true" className="size-5" />
          )}
        </button>
      </div>

      <PoseImage
        poseId={pose.id}
        image={pose.image}
        alt={pose.name}
        className="aspect-[4/3] h-auto w-full rounded-2xl"
        sizes="(min-width: 512px) 512px, 100vw"
      />

      <div
        className={`flex flex-col items-center rounded-2xl p-5 ${
          isPrep ? "bg-[#fff3e0] text-[#7a3e00] dark:bg-[#3d2c12] dark:text-[#ffcc80]" : "bg-surface-alt text-primary"
        }`}
      >
        <p className="text-sm font-bold uppercase tracking-widest">
          {isPrep ? "Get ready" : "Hold the pose"}
        </p>
        <p className="text-6xl font-extrabold tabular-nums" aria-hidden="true">
          {state.secondsLeft}
        </p>
        <p className="text-sm">seconds{state.paused ? " · paused" : ""}</p>
        {/* Announce phase changes, not every second. */}
        <p className="sr-only" aria-live="polite">
          {isPrep ? `Get ready: ${pose.name}` : `Hold ${pose.name}`}
        </p>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{pose.name}</h1>
        {pose.sanskritName && <p className="italic text-muted">{pose.sanskritName}</p>}
      </div>

      {pose.steps.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 rounded-xl border border-border bg-surface p-4 pl-8 text-muted">
          {pose.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => dispatch({ type: "prev" })}
          disabled={state.poseIndex === 0}
          className="flex items-center justify-center gap-1 rounded-xl border border-border bg-surface py-3 font-semibold hover:bg-surface-alt disabled:opacity-40"
        >
          <ChevronLeft aria-hidden="true" className="size-4" /> Prev
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "togglePause" })}
          className="flex items-center justify-center gap-1 rounded-xl bg-primary py-3 font-semibold text-on-primary hover:bg-primary-strong"
        >
          {state.paused ? (
            <>
              <Play aria-hidden="true" className="size-4" /> Resume
            </>
          ) : (
            <>
              <Pause aria-hidden="true" className="size-4" /> Pause
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "skip" })}
          className="flex items-center justify-center gap-1 rounded-xl border border-border bg-surface py-3 font-semibold hover:bg-surface-alt"
        >
          Skip <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => setConfirmEnd(true)}
        className="rounded-xl py-2 font-semibold text-danger hover:bg-surface-alt"
      >
        End session
      </button>

      <ConfirmDialog
        open={confirmEnd}
        title="End session?"
        confirmLabel="End session"
        cancelLabel="Keep going"
        destructive
        onCancel={() => setConfirmEnd(false)}
        onConfirm={() => {
          setConfirmEnd(false);
          router.push(backHref);
        }}
      >
        Poses you&apos;ve held to the end will be saved to your progress.
      </ConfirmDialog>
    </div>
  );
}
