"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { ExperienceBadge } from "@/components/ExperienceBadge";
import { PageHeader } from "@/components/PageHeader";
import { PoseImage } from "@/components/PoseImage";
import { ALL_POSES, poseById } from "@/content";
import { getCustomSets, saveCustomSet, updateCustomSet } from "@/lib/storage";

/** Create a set, or edit one with `?id=` (RN CustomSetScreen edit mode). */
export function SetEditor() {
  const router = useRouter();
  const editingId = useSearchParams().get("id");
  const nameId = useId();
  const errorId = useId();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]); // ordered pose ids
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingId) return;
    getCustomSets().then((sets) => {
      const set = sets.find((s) => s.id === editingId);
      if (!set) {
        setNotFound(true);
        return;
      }
      setName(set.name);
      setSelected(set.poseIds);
    });
  }, [editingId]);

  const toggle = (poseId: string) =>
    setSelected((prev) =>
      prev.includes(poseId) ? prev.filter((id) => id !== poseId) : [...prev, poseId],
    );

  const move = (index: number, direction: -1 | 1) =>
    setSelected((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a name for your set.");
      nameInput.current?.focus();
      return;
    }
    // Ids only, in the chosen order; unknown ids (from old data) are dropped.
    const poseIds = selected.filter((id) => poseById(id));
    if (poseIds.length === 0) {
      setError("Please select at least one pose.");
      return;
    }
    if (editingId) await updateCustomSet(editingId, { name: trimmed, poseIds });
    else await saveCustomSet({ name: trimmed, poseIds });
    router.push(`/sets?saved=${editingId ? "updated" : "created"}`);
  };

  if (notFound) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="Set not found" backHref="/sets" backLabel="My sets" />
        <p className="text-muted">It may have been deleted.</p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <PageHeader
        title={editingId ? "Edit custom set" : "Create custom set"}
        backHref="/sets"
        backLabel="My sets"
      />

      <div className="flex flex-col gap-2">
        <label htmlFor={nameId} className="text-sm font-bold uppercase tracking-wider text-muted">
          Set name
        </label>
        <input
          ref={nameInput}
          id={nameId}
          type="text"
          placeholder="e.g. Morning Routine"
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          aria-describedby={error ? errorId : undefined}
          className="rounded-lg border border-border bg-surface px-4 py-3 placeholder:text-muted"
        />
      </div>

      {selected.length > 0 && (
        <section aria-labelledby="order" className="flex flex-col gap-2">
          <h2 id="order" className="text-sm font-bold uppercase tracking-wider text-muted">
            Pose order
          </h2>
          <ol className="flex flex-col gap-2">
            {selected.map((id, index) => {
              const pose = poseById(id);
              if (!pose) return null;
              return (
                <li
                  key={id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2 pl-4"
                >
                  <span className="w-5 font-bold text-primary">{index + 1}</span>
                  <span className="flex-1 truncate">{pose.name}</span>
                  <button
                    type="button"
                    aria-label={`Move ${pose.name} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    className="rounded-lg p-2 text-primary hover:bg-surface-alt disabled:text-muted disabled:opacity-40"
                  >
                    <ArrowUp aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${pose.name} down`}
                    disabled={index === selected.length - 1}
                    onClick={() => move(index, 1)}
                    className="rounded-lg p-2 text-primary hover:bg-surface-alt disabled:text-muted disabled:opacity-40"
                  >
                    <ArrowDown aria-hidden="true" className="size-4" />
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">
          Select poses ({selected.length} selected)
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ALL_POSES.map((pose) => {
            const checked = selected.includes(pose.id);
            return (
              <label
                key={pose.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-2 ${
                  checked ? "border-primary bg-surface-alt" : "border-border bg-surface"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(pose.id)}
                  className="peer sr-only"
                />
                <PoseImage
                  poseId={pose.id}
                  image={pose.image}
                  alt=""
                  className="size-12 shrink-0 rounded-lg"
                  sizes="48px"
                />
                <span className="flex flex-1 flex-col items-start gap-1">
                  <span className="font-medium">{pose.name}</span>
                  <ExperienceBadge level={pose.difficulty} small />
                </span>
                <span
                  aria-hidden="true"
                  className={`flex size-6 items-center justify-center rounded-md border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-primary ${
                    checked ? "border-primary bg-primary text-on-primary" : "border-border"
                  }`}
                >
                  {checked && <Check className="size-4" />}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Validation errors sit with the buttons, which stay on screen. */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] -mx-4 flex flex-col gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:bottom-0">
        <p id={errorId} role="alert" className="font-medium text-danger empty:hidden">
          {error}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/sets")}
            className="flex-1 rounded-xl border border-border bg-surface py-3 font-semibold hover:bg-surface-alt"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 rounded-xl bg-primary py-3 font-semibold text-on-primary hover:bg-primary-strong"
          >
            Save set
          </button>
        </div>
      </div>
    </form>
  );
}
