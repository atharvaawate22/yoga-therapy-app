"use client";

import Link from "next/link";
import { useCallback } from "react";
import {
  ArrowRight,
  Camera,
  CircleCheck,
  CircleDot,
  Clock,
  Flame,
  List,
  PersonStanding,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { WeeklyStreakStrip } from "@/components/WeeklyStreakStrip";
import { useStored } from "@/lib/hooks/useStored";
import {
  formatDuration,
  getPracticeSessions,
  getPracticeStats,
  groupSessionsByDay,
  type SessionType,
} from "@/lib/storage";

const TYPE_META: Record<SessionType, { icon: LucideIcon; label: string }> = {
  routine: { icon: PersonStanding, label: "Routine" },
  custom: { icon: List, label: "Custom set" },
  single: { icon: CircleDot, label: "Single pose" },
  surya: { icon: Sun, label: "Surya Namaskar" },
  corrector: { icon: Camera, label: "Pose corrector" },
};

const BAR_MAX_PX = 96;

export function ProgressView() {
  const load = useCallback(async () => {
    const [stats, sessions] = await Promise.all([getPracticeStats(), getPracticeSessions()]);
    return { stats, groups: groupSessionsByDay(sessions) };
  }, []);
  const { value } = useStored(load);

  if (!value) return <PageHeader title="My progress" subtitle="Your yoga practice, day by day" />;
  const { stats, groups } = value;
  const maxMinutes = Math.max(...stats.last7Days.map((d) => d.minutes), 1);

  const tiles: ReadonlyArray<{ icon: LucideIcon; tint: string; value: number; label: string }> = [
    { icon: Flame, tint: "text-warm", value: stats.currentStreakDays, label: "Day streak" },
    { icon: Clock, tint: "text-accent", value: stats.weekMinutes, label: "Min this week" },
    { icon: CircleCheck, tint: "text-primary", value: stats.totalSessions, label: "Sessions" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My progress" subtitle="Your yoga practice, day by day" />

      <dl className="grid grid-cols-3 gap-3">
        {tiles.map(({ icon: Icon, tint, value: n, label }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface p-4"
          >
            <Icon aria-hidden="true" className={`size-5 ${tint}`} />
            <dd className="text-2xl font-extrabold tabular-nums">{n}</dd>
            <dt className="text-center text-xs text-muted">{label}</dt>
          </div>
        ))}
      </dl>

      <WeeklyStreakStrip last7Days={stats.last7Days} currentStreakDays={stats.currentStreakDays} />

      <section
        aria-labelledby="activity"
        className="rounded-xl border border-border bg-surface p-4"
      >
        <h2 id="activity" className="text-xs font-bold uppercase tracking-wider text-muted">
          Last 7 days · minutes
        </h2>
        <ol className="mt-4 grid grid-cols-7 items-end gap-2" style={{ height: BAR_MAX_PX + 40 }}>
          {stats.last7Days.map((day, i) => {
            const isToday = i === stats.last7Days.length - 1;
            const height = day.minutes > 0 ? Math.max(8, (day.minutes / maxMinutes) * BAR_MAX_PX) : 0;
            return (
              <li key={day.key} className="flex h-full flex-col items-center justify-end gap-1">
                {day.minutes > 0 ? (
                  <>
                    <span className="text-[11px] font-semibold tabular-nums text-muted">
                      {day.minutes}
                    </span>
                    <span
                      className={`w-full max-w-8 rounded-t-md ${isToday ? "bg-streak" : "bg-primary"}`}
                      style={{ height }}
                    />
                  </>
                ) : (
                  <span className="mb-1 size-1.5 rounded-full bg-border" />
                )}
                <span className={`text-[11px] ${isToday ? "font-bold text-warm" : "text-muted"}`}>
                  {isToday ? "Today" : day.label}
                </span>
                <span className="sr-only">
                  {day.minutes} minute{day.minutes === 1 ? "" : "s"}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {stats.totalSessions === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-surface-alt p-8 text-center">
          <PersonStanding aria-hidden="true" className="size-10 text-primary" />
          <h2 className="text-lg font-bold">No sessions yet</h2>
          <p className="max-w-sm text-muted">
            Complete a timed practice, a custom set, or Surya Namaskar and it will show up here.
          </p>
          <Link
            href="/"
            className="mt-1 flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary hover:bg-primary-strong"
          >
            Start practicing <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-label={group.title} className="flex flex-col gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">{group.title}</h2>
            <ul className="flex flex-col gap-2">
              {group.sessions.map((session) => {
                const meta = TYPE_META[session.type] ?? TYPE_META.routine;
                const Icon = meta.icon;
                const partial = session.posesCompleted < session.poseCount;
                const time = new Date(session.completedAt).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                });
                return (
                  <li
                    key={session.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-alt text-primary">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold">{session.title}</span>
                      <span className="block text-sm text-muted">
                        {meta.label} · {session.posesCompleted}/{session.poseCount} poses
                        {partial ? " · ended early" : ""}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-semibold tabular-nums">
                        {formatDuration(session.durationSec)}
                      </span>
                      <span className="block text-xs text-muted">{time}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
