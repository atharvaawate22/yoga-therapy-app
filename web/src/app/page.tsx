import { NUM_KEYPOINTS } from "pose-core";
import { APK_URL, REPO_URL } from "@/lib/links";

const FEATURES = [
  {
    title: "Routines for 11 health problems",
    body: "Back pain, posture, stress, insomnia and more, filtered to your experience level.",
  },
  {
    title: "Guided practice with voice cues",
    body: "Timed holds, prep countdowns, pause and skip. Includes 12-step Surya Namaskar rounds.",
  },
  {
    title: "Progress you can see",
    body: "Day streaks, weekly minutes and a 7-day activity chart. Everything stays on your device.",
  },
  {
    title: "AI pose corrector",
    body: "Point the camera at yourself and hear what to adjust, like “Lift your hips higher”.",
  },
];

const PIPELINE = [
  "Camera frame",
  `MoveNet finds ${NUM_KEYPOINTS} body keypoints`,
  "A small classifier names the pose",
  "Alignment rules pick a correction",
  "The correction is spoken aloud",
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-4 py-12 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-5">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">
          Yoga Therapy
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Yoga for real problems, with a coach that watches your form.
        </h1>
        <p className="text-lg text-muted">
          Pick a health problem, follow a guided routine, and let the pose corrector tell you how to
          fix your alignment.
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

      <section
        aria-labelledby="status-heading"
        className="rounded-xl border border-border bg-surface-alt p-5"
      >
        <h2 id="status-heading" className="font-semibold">
          The web app is under construction
        </h2>
        <p className="mt-1 text-muted">
          The Android app works today. The web version will run pose detection entirely in your
          browser, so camera frames never leave your device, and it will install like an app and
          work offline.
        </p>
      </section>

      <section aria-labelledby="features-heading" className="flex flex-col gap-4">
        <h2 id="features-heading" className="text-2xl font-bold">
          What&apos;s in the app
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="rounded-xl border border-border bg-surface p-5">
              <h3 className="font-semibold">{feature.title}</h3>
              <p className="mt-1 text-sm text-muted">{feature.body}</p>
            </li>
          ))}
        </ul>
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

      <footer className="border-t border-border pt-6 text-sm text-muted">
        General yoga guidance for education only. Check with a healthcare professional before
        starting a new exercise program.
      </footer>
    </main>
  );
}
