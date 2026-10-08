"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { conditionBySlug, poseById, posesForLevel, type Pose } from "@/content";
import { useStored } from "@/lib/hooks/useStored";
import { getCustomSets, getProfile, type SessionType } from "@/lib/storage";
import { PracticeSession } from "./PracticeSession";

export interface Routine {
  title: string;
  poses: Pose[];
  type: SessionType;
  backHref: string;
}

/**
 * Resolve the routine from the URL:
 *   ?condition=<slug>  poses for a condition, filtered to the user's level
 *   ?pose=<id>         a single pose
 *   ?set=<id>          a custom set
 */
export async function resolveRoutine(params: URLSearchParams): Promise<Routine | null> {
  const conditionSlug = params.get("condition");
  if (conditionSlug) {
    const condition = conditionBySlug(conditionSlug);
    if (!condition) return null;
    const { experience } = await getProfile();
    return {
      title: condition.name,
      poses: posesForLevel(condition.poses, experience),
      type: "routine",
      backHref: `/conditions/${condition.slug}`,
    };
  }
  const poseId = params.get("pose");
  if (poseId) {
    const pose = poseById(poseId);
    return pose
      ? { title: pose.name, poses: [pose], type: "single", backHref: `/poses/${pose.id}` }
      : null;
  }
  const setId = params.get("set");
  if (setId) {
    const set = (await getCustomSets()).find((s) => s.id === setId);
    return set ? { title: set.name, poses: set.poses, type: "custom", backHref: "/sets" } : null;
  }
  return null;
}

export function PracticeLoader() {
  const params = useSearchParams();
  const query = params.toString();
  const load = useCallback(() => resolveRoutine(new URLSearchParams(query)), [query]);
  const { value: routine } = useStored(load);

  if (routine === undefined) return <p className="text-muted">Loading practice…</p>;
  if (routine === null || routine.poses.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-2xl font-bold">Nothing to practice</h1>
        <p className="text-muted">That routine doesn&apos;t exist or has no poses.</p>
        <Link href="/" className="font-semibold text-primary hover:underline">
          Back to home
        </Link>
      </div>
    );
  }
  return <PracticeSession key={query} routine={routine} />;
}
