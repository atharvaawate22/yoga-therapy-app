"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { ChevronRight, Flame, Leaf, PersonStanding, Trophy, type LucideIcon } from "lucide-react";
import type { Level } from "@/content";
import { getProfile, isOnboarded, saveProfile, setOnboarded } from "@/lib/storage";

const LEVEL_OPTIONS: ReadonlyArray<{ key: Level; label: string; icon: LucideIcon; desc: string }> = [
  { key: "beginner", label: "Beginner", icon: Leaf, desc: "New to yoga, gentle corrections" },
  {
    key: "intermediate",
    label: "Intermediate",
    icon: Flame,
    desc: "1-2 years experience, balanced feedback",
  },
  { key: "expert", label: "Expert", icon: Trophy, desc: "3+ years, strict & precise corrections" },
];

/**
 * Onboarding and profile editing. Asks only for what the app uses: an
 * optional name and the experience level, which filters poses everywhere.
 */
export function ProfileForm({ mode }: { mode: "onboarding" | "edit" }) {
  const router = useRouter();
  const nameId = useId();
  const [name, setName] = useState("");
  const [experience, setExperience] = useState<Level>("beginner");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editing must start from the saved values, or saving would overwrite the
  // profile with blank defaults (a bug the APK once had).
  useEffect(() => {
    Promise.all([isOnboarded(), getProfile()]).then(([done, profile]) => {
      if (done) {
        setName(profile.name === "Yogi" ? "" : profile.name);
        setExperience(profile.experience as Level);
      }
      setLoaded(true);
    });
  }, []);

  const save = async () => {
    if (!loaded || saving) return;
    setSaving(true);
    await saveProfile({ name: name.trim() || "Yogi", experience });
    await setOnboarded();
    router.push(mode === "edit" ? "/settings" : "/");
  };

  const skip = async () => {
    await setOnboarded();
    router.push("/");
  };

  return (
    <form
      className="mx-auto flex max-w-lg flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="bg-hero flex size-16 items-center justify-center rounded-2xl">
          <PersonStanding aria-hidden="true" className="size-9" />
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-primary">
          {mode === "edit" ? "Edit your profile" : "Welcome to Yoga Therapy"}
        </h1>
        <p className="text-muted">
          {mode === "edit"
            ? "Update your details to adjust your yoga guidance."
            : "Two quick questions to tailor your routines. Everything stays on this device."}
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <label htmlFor={nameId} className="text-sm font-bold uppercase tracking-wider text-muted">
          Your name <span className="font-normal normal-case">(optional)</span>
        </label>
        <input
          id={nameId}
          type="text"
          autoComplete="given-name"
          placeholder="Enter your name"
          value={name}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
          className="rounded-lg border border-border bg-surface px-4 py-3 placeholder:text-muted"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">
          Experience level
        </legend>
        {LEVEL_OPTIONS.map(({ key, label, icon: Icon, desc }) => {
          const selected = experience === key;
          return (
            <label
              key={key}
              className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 p-4 transition-colors ${
                selected ? "border-primary bg-surface-alt" : "border-border bg-surface"
              }`}
            >
              <input
                type="radio"
                name="experience"
                value={key}
                checked={selected}
                onChange={() => setExperience(key)}
                className="peer sr-only"
              />
              <span
                className={`flex size-10 items-center justify-center rounded-lg ${
                  selected ? "bg-primary text-on-primary" : "bg-surface-alt text-primary"
                }`}
              >
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{label}</span>
                <span className="block text-sm text-muted">{desc}</span>
              </span>
              <span
                aria-hidden="true"
                className={`size-5 rounded-full border-2 ${
                  selected ? "border-primary bg-primary shadow-[inset_0_0_0_3px_var(--surface)]" : "border-border"
                } peer-focus-visible:ring-2 peer-focus-visible:ring-primary`}
              />
            </label>
          );
        })}
      </fieldset>

      <div className="flex flex-col items-center gap-3">
        <button
          type="submit"
          disabled={!loaded || saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-on-primary hover:bg-primary-strong disabled:opacity-60"
        >
          {mode === "edit" ? "Save changes" : "Start my journey"}
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
        {mode === "edit" ? (
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className="text-sm font-semibold text-muted hover:underline"
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void skip()}
            className="text-sm font-semibold text-muted hover:underline"
          >
            Skip for now
          </button>
        )}
      </div>
    </form>
  );
}
