"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RoutineView } from "@/components/RoutineView";
import { useStored } from "@/lib/hooks/useStored";
import { getCustomSets } from "@/lib/storage";

export function SetView() {
  const id = useSearchParams().get("id");
  const load = useCallback(
    async () => (await getCustomSets()).find((set) => set.id === id) ?? null,
    [id],
  );
  const { value: set } = useStored(load);

  if (set === undefined) return null;
  if (set === null) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="Set not found" backHref="/sets" backLabel="My sets" />
        <p className="text-muted">It may have been deleted.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <Link href="/sets" className="text-sm font-semibold text-primary hover:underline">
        ← My sets
      </Link>
      <RoutineView
        badge="Custom set"
        title={set.name}
        poses={set.poses}
        practiceHref={`/practice?set=${encodeURIComponent(set.id)}`}
      />
    </div>
  );
}
