"use client";

import { useId, useState } from "react";
import { Lightbulb, Search, X } from "lucide-react";
import { ConditionCard } from "@/components/ConditionCard";
import { PageHeader } from "@/components/PageHeader";
import { CONDITION_GROUPS, CONDITIONS, posesForLevel, type Condition } from "@/content";
import { useStored } from "@/lib/hooks/useStored";
import { getProfile } from "@/lib/storage";

/** Search or browse conditions by group (RN HealthScanScreen). */
export function HealthScanner() {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const { value: profile } = useStored(getProfile);
  const level = profile?.experience ?? "beginner";

  const card = (condition: Condition) => (
    <li key={condition.slug}>
      <ConditionCard
        name={condition.name}
        href={`/conditions/${condition.slug}`}
        poseCount={posesForLevel(condition.poses, level).length}
      />
    </li>
  );

  const term = query.trim().toLowerCase();
  const matches = term ? CONDITIONS.filter((c) => c.name.toLowerCase().includes(term)) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Health Scanner"
        subtitle={`Tell us your problem and we'll recommend yoga poses for your level (${level}).`}
        backHref="/"
        backLabel="Home"
      />

      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          Search health conditions
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted"
        />
        <input
          id={searchId}
          type="search"
          placeholder="Search health conditions…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-xl border border-border bg-surface py-3 pl-10 pr-10 placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-surface-alt"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        )}
      </div>

      {matches ? (
        <section aria-live="polite" className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            {matches.length} condition{matches.length === 1 ? "" : "s"} found
          </p>
          {matches.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">{matches.map(card)}</ul>
          ) : (
            <p className="rounded-xl bg-surface-alt p-6 text-center text-muted">
              No matching conditions. Try a different search term.
            </p>
          )}
        </section>
      ) : (
        CONDITION_GROUPS.map((group) => (
          <section key={group.label} aria-label={group.label} className="flex flex-col gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted">{group.label}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {CONDITIONS.filter((c) => group.names.includes(c.name)).map(card)}
            </ul>
          </section>
        ))
      )}

      <p className="flex items-start gap-2 rounded-xl bg-surface-alt p-4 text-sm text-muted">
        <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
        Poses are filtered to your experience level. Update your profile to see different
        recommendations.
      </p>
    </div>
  );
}
