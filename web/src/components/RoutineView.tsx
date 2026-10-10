import Link from "next/link";
import { ChevronRight, Lightbulb, Play, Sparkles, Stethoscope } from "lucide-react";
import type { Pose } from "@/content";
import { PoseCard } from "./PoseCard";

interface Props {
  badge: string;
  title: string;
  poses: readonly Pose[];
  practiceHref: string;
  tips?: readonly string[];
  tipsTitle?: string;
  /** Shown above the pose list, e.g. the level filter note. */
  note?: React.ReactNode;
}

/** A list of poses with a "start guided practice" action (RN PoseScreen). */
export function RoutineView({ badge, title, poses, practiceHref, tips, tipsTitle, note }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="w-fit rounded-full bg-surface-alt px-3 py-1 text-sm font-semibold text-primary">
          {badge}
        </span>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted">
          {poses.length} {poses.length === 1 ? "pose" : "poses"}
        </p>
      </header>

      {poses.length > 0 && (
        <Link href={practiceHref} className="bg-hero flex items-center gap-4 rounded-2xl p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Play aria-hidden="true" className="size-5" fill="currentColor" />
          </span>
          <span className="flex-1">
            <span className="block text-lg font-bold">Start guided practice</span>
            <span className="block text-sm text-white/85">
              Timed play-through of all {poses.length} poses with voice cues
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="size-6" />
        </Link>
      )}

      {note && (
        <p className="flex items-start gap-2 rounded-xl bg-surface-alt p-4 text-sm text-muted">
          <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
          <span>{note}</span>
        </p>
      )}

      <h2 className="sr-only">Poses</h2>
      <ol className="grid gap-4 sm:grid-cols-2">
        {poses.map((pose, index) => (
          <li key={pose.id}>
            <PoseCard pose={pose} position={index + 1} />
          </li>
        ))}
      </ol>

      {tips && tips.length > 0 && (
        <section aria-labelledby="tips" className="rounded-xl border border-border bg-surface p-5">
          <h2 id="tips" className="flex items-center gap-2 font-semibold">
            <Sparkles aria-hidden="true" className="size-4 text-primary" />
            {tipsTitle ?? "Pro tips"}
          </h2>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-muted">
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="flex items-start gap-2 rounded-xl border border-[#ffe0b2] bg-[#fff8e1] p-4 text-sm text-[#7a4a00] dark:border-[#5c4415] dark:bg-[#2b2210] dark:text-[#ffd699]">
        <Stethoscope aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        These poses are for general wellness. Consult a doctor or certified yoga therapist for
        medical conditions.
      </p>
    </div>
  );
}
