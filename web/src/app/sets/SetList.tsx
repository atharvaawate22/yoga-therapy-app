"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ClipboardList, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { useStored } from "@/lib/hooks/useStored";
import { deleteCustomSet, getCustomSets, type CustomSet } from "@/lib/storage";

const SAVED_MESSAGES: Record<string, string> = {
  created: "Your custom set has been created.",
  updated: "Your custom set has been updated.",
};

export function SetList() {
  const params = useSearchParams();
  const savedMessage = SAVED_MESSAGES[params.get("saved") ?? ""];
  const { value: sets, reload } = useStored(getCustomSets);
  const [pendingDelete, setPendingDelete] = useState<CustomSet | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My custom sets"
        subtitle="Create your own yoga routines"
        backHref="/"
        backLabel="Home"
      />

      {savedMessage && (
        <p role="status" className="rounded-xl bg-surface-alt p-4 font-medium text-primary">
          {savedMessage}
        </p>
      )}

      <Link
        href="/sets/edit"
        className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary hover:bg-primary-strong"
      >
        <Plus aria-hidden="true" className="size-5" />
        Create new set
      </Link>

      {sets === undefined ? null : sets.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-surface-alt p-8 text-center text-muted">
          <ClipboardList aria-hidden="true" className="size-10" />
          <p>No custom sets yet. Create one above!</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {sets.map((set) => (
            <li
              key={set.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface p-3"
            >
              <Link href={`/sets/view?id=${encodeURIComponent(set.id)}`} className="flex-1 px-1 hover:underline">
                <span className="block font-semibold">{set.name}</span>
                <span className="block text-sm text-muted">
                  {set.poses.length} {set.poses.length === 1 ? "pose" : "poses"}
                </span>
              </Link>
              <Link
                href={`/practice?set=${encodeURIComponent(set.id)}`}
                aria-label={`Practice ${set.name}`}
                className="flex size-10 items-center justify-center rounded-full bg-primary text-on-primary hover:bg-primary-strong"
              >
                <Play aria-hidden="true" className="size-4" fill="currentColor" />
              </Link>
              <Link
                href={`/sets/edit?id=${encodeURIComponent(set.id)}`}
                aria-label={`Edit ${set.name}`}
                className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-alt"
              >
                <Pencil aria-hidden="true" className="size-5" />
              </Link>
              <button
                type="button"
                aria-label={`Delete ${set.name}`}
                onClick={() => setPendingDelete(set)}
                className="flex size-10 items-center justify-center rounded-full text-danger hover:bg-surface-alt"
              >
                <Trash2 aria-hidden="true" className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete set?"
        confirmLabel="Delete"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await deleteCustomSet(pendingDelete.id);
          setPendingDelete(null);
          await reload();
        }}
      >
        &ldquo;{pendingDelete?.name}&rdquo; will be deleted. Your practice history is kept.
      </ConfirmDialog>
    </div>
  );
}
