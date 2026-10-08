import type { Metadata } from "next";
import Link from "next/link";
import { NUM_KEYPOINTS } from "pose-core";
import { APK_URL, REPO_URL } from "@/lib/links";

export const metadata: Metadata = { title: "About" };

const ON_THE_WEB = [
  "Routines for 11 health problems, filtered to your experience level",
  "Guided practice with timers and voice cues",
  "12-step Surya Namaskar rounds",
  "Custom routines, favorites, streaks and a 7-day activity chart",
  "The pose corrector, live from your camera or on a photo, running entirely on your device",
];

const PIPELINE = [
  "Camera frame",
  `MoveNet finds ${NUM_KEYPOINTS} body keypoints`,
  "A small classifier names the pose",
  "Alignment rules pick a correction",
  "The correction is spoken aloud",
];

export default function AboutPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10">
      <header className="flex flex-col gap-4">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">About</p>
        <h1 className="text-4xl font-extrabold tracking-tight">
          Yoga for real problems, with a coach that watches your form.
        </h1>
        <p className="text-lg text-muted">
          Pick a health problem, follow a guided routine, and let the pose corrector tell you how to
          fix your alignment. Everything you do stays on your device: there are no accounts.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href={APK_URL}
            className="rounded-lg bg-primary px-5 py-3 text-center font-semibold text-on-primary transition-colors hover:bg-primary-strong"
          >
            Download the Android app
          </a>
          <a
            href={REPO_URL}
            className="rounded-lg border border-border bg-surface px-5 py-3 text-center font-semibold transition-colors hover:bg-surface-alt"
          >
            View the source
          </a>
        </div>
      </header>

      <section aria-labelledby="web-status" className="rounded-xl border border-border bg-surface-alt p-5">
        <h2 id="web-status" className="font-semibold">
          The web app is under construction
        </h2>
        <p className="mt-1 text-muted">Working in your browser today:</p>
        <ul className="mt-2 list-disc pl-5 text-muted">
          {ON_THE_WEB.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-3 text-muted">
          Coming next: installing like an app and working offline.{" "}
          <Link href="/corrector?demo=1" className="font-semibold text-primary hover:underline">
            Try the corrector demo
          </Link>{" "}
          (no camera needed).
        </p>
        <Link href="/" className="mt-3 inline-block font-semibold text-primary hover:underline">
          Open the web app →
        </Link>
      </section>

      <section aria-labelledby="pipeline-heading" className="flex flex-col gap-4">
        <h2 id="pipeline-heading" className="text-2xl font-bold">
          How the pose corrector works
        </h2>
        <ol className="flex flex-col gap-2">
          {PIPELINE.map((step, index) => (
            <li key={step} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary"
              >
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <p className="text-sm text-muted">
        Curious how well the browser matches the server? The{" "}
        <Link href="/lab" className="font-semibold text-primary hover:underline">
          inference lab
        </Link>{" "}
        runs MoveNet in your browser and compares it with the server&apos;s output on the same
        photos.
      </p>

      <footer className="border-t border-border pt-6 text-sm text-muted">
        General yoga guidance for education only. Check with a healthcare professional before
        starting a new exercise program.
      </footer>
    </div>
  );
}
