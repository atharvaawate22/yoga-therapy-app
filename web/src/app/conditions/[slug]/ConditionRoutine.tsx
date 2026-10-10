"use client";

import Link from "next/link";
import { RoutineView } from "@/components/RoutineView";
import { conditionBySlug, posesForLevel, tipsFor } from "@/content";
import { useStored } from "@/lib/hooks/useStored";
import { getProfile } from "@/lib/storage";

/**
 * Poses for a condition, filtered to the user's level (read from storage, so
 * this part renders in the browser; beginner is the default until then).
 */
export function ConditionRoutine({ slug }: { slug: string }) {
  const condition = conditionBySlug(slug)!;
  const { value: profile } = useStored(getProfile);
  const level = profile?.experience ?? "beginner";
  const poses = posesForLevel(condition.poses, level);
  const hidden = condition.poses.length - poses.length;

  return (
    <RoutineView
      badge={condition.name}
      title="Recommended yoga"
      poses={poses}
      practiceHref={`/practice?condition=${condition.slug}`}
      tips={tipsFor(condition.name)}
      tipsTitle={`Pro tips for ${condition.name}`}
      note={
        <>
          Showing poses for your level ({level}).
          {hidden > 0 && ` ${hidden} more ${hidden === 1 ? "pose is" : "poses are"} above your level.`}{" "}
          <Link href="/profile" className="font-semibold text-primary hover:underline">
            Change level
          </Link>
        </>
      }
    />
  );
}
