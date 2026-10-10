"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Camera, Check, ChevronLeft, ChevronRight, Minus, Plus, Sun } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { PoseImage } from "@/components/PoseImage";
import { SURYA_STEPS } from "@/content";
import { useWakeLock } from "@/lib/hooks/useWakeLock";
import {
  MAX_ROUNDS,
  MIN_ROUNDS,
  clampRounds,
  estimateMinutes,
  initialSuryaState,
  isLastStep,
  suryaProgressPercent,
  suryaReducer,
  type SuryaAction,
  type SuryaState,
} from "@/lib/practice/suryaMachine";
import { formatDuration, savePracticeSession } from "@/lib/storage";

const STEPS_PER_ROUND = SURYA_STEPS.length;
const STEP_DURATIONS = SURYA_STEPS.map((s) => s.duration);

type Mode = "setup" | "practice";

export function SuryaPractice() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("setup");
  const [rounds, setRounds] = useState(3);
  const [state, dispatch] = useReducer(
    (s: SuryaState, action: SuryaAction | { type: "reset"; rounds: number }) =>
      action.type === "reset" ? initialSuryaState(action.rounds) : suryaReducer(s, action, STEPS_PER_ROUND),
    3,
    initialSuryaState,
  );
  const [dialog, setDialog] = useState<null | "stop" | "complete">(null);
  const [savedDuration, setSavedDuration] = useState(0);
  useWakeLock(mode === "practice");

  // Saved at most once per practice, and only if a step was completed.
  const startedAtRef = useRef<number | null>(null);
  const savedRef = useRef(false);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const save = useCallback((): number | null => {
    const current = stateRef.current;
    if (savedRef.current || startedAtRef.current === null || current.completed.size === 0) {
      return null;
    }
    savedRef.current = true;
    const durationSec = Math.round((Date.now() - startedAtRef.current) / 1000);
    void savePracticeSession({
      type: "surya",
      title: "Surya Namaskar",
      posesCompleted: current.completed.size,
      poseCount: current.rounds * STEPS_PER_ROUND,
      durationSec,
    });
    return durationSec;
  }, []);

  // Leaving mid-practice keeps the steps done so far.
  useEffect(() => {
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [save]);

  const next = () => {
    const after = suryaReducer(state, { type: "next" }, STEPS_PER_ROUND);
    dispatch({ type: "next" });
    if (after.finished) {
      // Finishing the last step completes (and saves) the practice.
      stateRef.current = after;
      setSavedDuration(save() ?? 0);
      setDialog("complete");
    }
  };

  const begin = () => {
    startedAtRef.current = Date.now();
    savedRef.current = false;
    dispatch({ type: "reset", rounds });
    setMode("practice");
    window.scrollTo({ top: 0 });
  };

  const backToSetup = () => {
    startedAtRef.current = null;
    setMode("setup");
    window.scrollTo({ top: 0 });
  };

  if (mode === "setup") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Surya Namaskar"
          subtitle="Sun Salutation: the 12-step sequence"
          backHref="/"
          backLabel="Home"
        />

        <section
          aria-labelledby="rounds-label"
          className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-5"
        >
          <h2 id="rounds-label" className="text-sm font-bold uppercase tracking-wider text-muted">
            Number of rounds
          </h2>
          <div className="flex items-center gap-6">
            <button
              type="button"
              aria-label="Fewer rounds"
              disabled={rounds <= MIN_ROUNDS}
              onClick={() => setRounds((r) => clampRounds(r - 1))}
              className="flex size-12 items-center justify-center rounded-full border border-border hover:bg-surface-alt disabled:opacity-40"
            >
              <Minus aria-hidden="true" className="size-5" />
            </button>
            <p className="flex flex-col items-center" aria-live="polite">
              <span className="text-4xl font-extrabold tabular-nums">{rounds}</span>
              <span className="text-sm text-muted">{rounds === 1 ? "round" : "rounds"}</span>
            </p>
            <button
              type="button"
              aria-label="More rounds"
              disabled={rounds >= MAX_ROUNDS}
              onClick={() => setRounds((r) => clampRounds(r + 1))}
              className="flex size-12 items-center justify-center rounded-full border border-border hover:bg-surface-alt disabled:opacity-40"
            >
              <Plus aria-hidden="true" className="size-5" />
            </button>
          </div>
          <p className="text-sm text-muted">
            ≈ {estimateMinutes(rounds, STEP_DURATIONS)} min · {rounds * STEPS_PER_ROUND} poses total
          </p>
        </section>

        <section aria-labelledby="sequence" className="flex flex-col gap-2">
          <h2 id="sequence" className="text-sm font-bold uppercase tracking-wider text-muted">
            12-step sequence
          </h2>
          <ol className="flex flex-col gap-2">
            {SURYA_STEPS.map((s) => (
              <li
                key={s.step}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-alt text-sm font-bold text-primary">
                  {s.step}
                </span>
                <PoseImage
                  poseId={s.imageId}
                  image={s.image}
                  alt=""
                  className="size-12 shrink-0 rounded-lg"
                  sizes="48px"
                />
                <span className="flex-1">
                  <span className="block font-medium">{s.name}</span>
                  <span className="block text-sm italic text-muted">{s.sanskritName}</span>
                </span>
                <span className="rounded-full bg-surface-alt px-2 py-1 text-xs font-semibold text-accent">
                  {s.breathing}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <button
          type="button"
          onClick={begin}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-4 text-lg font-semibold text-on-primary hover:bg-primary-strong"
        >
          <Sun aria-hidden="true" className="size-5" />
          Begin practice
        </button>
      </div>
    );
  }

  const step = SURYA_STEPS[state.step]!;
  const progress = suryaProgressPercent(state, STEPS_PER_ROUND);
  const last = isLastStep(state, STEPS_PER_ROUND);
  const completedCount = state.completed.size;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <div
        role="progressbar"
        aria-label="Practice progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        className="h-2 overflow-hidden rounded-full bg-surface-alt"
      >
        <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        Round {state.round}/{state.rounds} · Step {state.step + 1}/{STEPS_PER_ROUND}
      </p>

      <PoseImage
        poseId={step.imageId}
        image={step.image}
        alt={step.name}
        className="aspect-[4/3] h-auto w-full rounded-2xl"
        sizes="(min-width: 512px) 512px, 100vw"
      />

      <div className="flex flex-col gap-2">
        <span className="w-fit rounded-full bg-surface-alt px-3 py-1 text-sm font-semibold text-accent">
          {step.breathing}
        </span>
        <h1 className="text-2xl font-bold">{step.name}</h1>
        <p className="italic text-muted">{step.sanskritName}</p>
        <p>{step.description}</p>
        <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-muted">
          {step.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>

      {step.expectedPoseId && (
        <Link
          href={`/corrector?label=${step.expectedPoseId}`}
          className="flex w-fit items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-primary hover:bg-surface-alt"
        >
          <Camera aria-hidden="true" className="size-4" />
          Test this pose
        </Link>
      )}

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => dispatch({ type: "prev" })}
          disabled={state.round === 1 && state.step === 0}
          className="flex items-center justify-center gap-1 rounded-xl border border-border bg-surface py-3 font-semibold hover:bg-surface-alt disabled:opacity-40"
        >
          <ChevronLeft aria-hidden="true" className="size-4" /> Prev
        </button>
        <button
          type="button"
          onClick={() => setDialog("stop")}
          className="rounded-xl border border-border bg-surface py-3 font-semibold text-danger hover:bg-surface-alt"
        >
          Stop
        </button>
        <button
          type="button"
          onClick={next}
          className="flex items-center justify-center gap-1 rounded-xl bg-primary py-3 font-semibold text-on-primary hover:bg-primary-strong"
        >
          {last ? (
            <>
              Done <Check aria-hidden="true" className="size-4" />
            </>
          ) : (
            <>
              Next <ChevronRight aria-hidden="true" className="size-4" />
            </>
          )}
        </button>
      </div>

      <ConfirmDialog
        open={dialog === "stop"}
        title="Stop practice?"
        confirmLabel="Stop"
        cancelLabel="Keep going"
        destructive
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          save();
          setDialog(null);
          backToSetup();
        }}
      >
        {completedCount > 0
          ? `You've completed ${completedCount} step${completedCount === 1 ? "" : "s"}. They'll be saved to your progress.`
          : "No steps completed yet, so nothing will be saved."}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "complete"}
        title="Practice complete! 🎉"
        confirmLabel="View progress"
        cancelLabel="Done"
        onCancel={() => {
          setDialog(null);
          backToSetup();
        }}
        onConfirm={() => {
          setDialog(null);
          router.push("/progress");
        }}
      >
        {state.rounds} round{state.rounds === 1 ? "" : "s"} of Surya Namaskar in{" "}
        {formatDuration(savedDuration)}. Saved to your progress.
      </ConfirmDialog>
    </div>
  );
}
