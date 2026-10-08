"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Camera,
  ChartColumn,
  ChevronRight,
  CircleUser,
  Heart,
  List,
  Stethoscope,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { ConditionCard } from "@/components/ConditionCard";
import { ExperienceBadge } from "@/components/ExperienceBadge";
import { PoseImage } from "@/components/PoseImage";
import { WeeklyStreakStrip } from "@/components/WeeklyStreakStrip";
import { CONDITIONS, poseById, posesForLevel, type Pose } from "@/content";
import { useClientValue } from "@/lib/hooks/useClientValue";
import { useStored } from "@/lib/hooks/useStored";
import { getFavoriteIds, getPracticeStats, getProfile, isOnboarded } from "@/lib/storage";

function greetingNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

async function loadFavorites(): Promise<Pose[]> {
  const ids = await getFavoriteIds();
  return ids.map(poseById).filter((pose): pose is Pose => Boolean(pose));
}

const QUICK_ACTIONS: ReadonlyArray<{
  href: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tint: string;
}> = [
  { href: "/surya", title: "Surya Namaskar", subtitle: "Sun Salutation", icon: Sun, tint: "#e65100" },
  { href: "/sets", title: "My Custom Sets", subtitle: "Build routines", icon: List, tint: "#00897b" },
  {
    href: "/conditions",
    title: "Health Scanner",
    subtitle: "Find by problem",
    icon: Stethoscope,
    tint: "#5c6bc0",
  },
  {
    href: "/progress",
    title: "My Progress",
    subtitle: "History & streaks",
    icon: ChartColumn,
    tint: "#f9a825",
  },
];

export function HomeView() {
  const router = useRouter();
  const greeting = useClientValue(greetingNow, "Welcome");
  const { value: profile } = useStored(getProfile);
  const { value: stats } = useStored(getPracticeStats);
  const { value: favorites } = useStored(loadFavorites);
  const [checkedOnboarding, setCheckedOnboarding] = useState(false);

  // First visit: set up a profile before showing recommendations (as the APK
  // does). Deep links to other pages work without it.
  useEffect(() => {
    isOnboarded().then((done) => {
      if (done) setCheckedOnboarding(true);
      else router.replace("/onboarding");
    });
  }, [router]);

  return (
    <div className="flex flex-col gap-8" aria-busy={!checkedOnboarding}>
      <section className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-muted">{greeting}</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">
            {profile?.name ?? "Yogi"} <span aria-hidden="true">🙏</span>
          </h1>
          {profile && (
            <div className="mt-1">
              <ExperienceBadge level={profile.experience} />
            </div>
          )}
        </div>
        <Link
          href="/profile"
          aria-label="Edit profile"
          className="rounded-full border border-border bg-surface p-2 text-primary hover:bg-surface-alt"
        >
          <CircleUser aria-hidden="true" className="size-7" />
        </Link>
      </section>

      {stats && stats.totalSessions > 0 && (
        <Link href="/progress" aria-label="View your progress" className="block">
          <WeeklyStreakStrip
            last7Days={stats.last7Days}
            currentStreakDays={stats.currentStreakDays}
          />
        </Link>
      )}

      <Link href="/corrector" className="bg-hero flex items-center gap-4 rounded-2xl p-5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <Camera aria-hidden="true" className="size-6" />
        </span>
        <span className="flex-1">
          <span className="block text-lg font-bold">AI Pose Corrector</span>
          <span className="block text-sm text-white/85">
            Point a camera at yourself and hear how to fix your alignment.
          </span>
          <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-white/75">
            Runs on this device · nothing uploaded
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="size-6" />
      </Link>

      <section aria-labelledby="quick-actions" className="flex flex-col gap-3">
        <h2 id="quick-actions" className="text-sm font-bold uppercase tracking-wider text-muted">
          Quick actions
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_ACTIONS.map(({ href, title, subtitle, icon: Icon, tint }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface p-4 hover:bg-surface-alt"
              >
                <span
                  className="flex size-10 items-center justify-center rounded-lg"
                  style={{ color: tint, backgroundColor: `${tint}1f` }}
                >
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="font-semibold">{title}</span>
                <span className="text-sm text-muted">
                  {href === "/progress" && stats?.totalSessions
                    ? `${stats.totalSessions} sessions`
                    : subtitle}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {favorites && favorites.length > 0 && (
        <section aria-labelledby="favorites" className="flex flex-col gap-3">
          <h2
            id="favorites"
            className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-muted"
          >
            <Heart aria-hidden="true" className="size-4 text-danger" fill="currentColor" />
            Your favorites
          </h2>
          <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {favorites.map((pose) => (
              <li key={pose.id} className="w-36 shrink-0">
                <Link
                  href={`/poses/${pose.id}`}
                  className="block overflow-hidden rounded-xl border border-border bg-surface hover:bg-surface-alt"
                >
                  <PoseImage
                    poseId={pose.id}
                    image={pose.image}
                    alt=""
                    className="aspect-square h-auto w-full"
                    sizes="144px"
                  />
                  <span className="block truncate px-3 pt-2 text-sm font-semibold">{pose.name}</span>
                  <span className="block px-3 pb-2 text-xs text-muted">{pose.duration}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="conditions" className="flex flex-col gap-3">
        <h2 id="conditions" className="text-sm font-bold uppercase tracking-wider text-muted">
          Choose a condition
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {CONDITIONS.map((condition) => (
            <li key={condition.slug}>
              <ConditionCard
                name={condition.name}
                href={`/conditions/${condition.slug}`}
                poseCount={posesForLevel(condition.poses, profile?.experience ?? "beginner").length}
              />
            </li>
          ))}
        </ul>
      </section>

      <p className="text-center text-sm text-muted">
        Practice yoga safely. Consult a professional if needed.{" "}
        <Link href="/about" className="font-semibold text-primary hover:underline">
          About this app
        </Link>
      </p>
    </div>
  );
}
