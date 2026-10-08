"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { poseById, poseDisplayName } from "@/content";
import { LiveCorrector } from "./LiveCorrector";
import { PhotoCheck } from "./PhotoCheck";

type Mode = "live" | "photo";

const MODES: ReadonlyArray<{ id: Mode; label: string }> = [
  { id: "live", label: "Live" },
  { id: "photo", label: "Photo" },
];

/** The pose corrector: live camera (or demo/video) and single-photo modes. */
export function CorrectorView() {
  const params = useSearchParams();
  const pose = poseById(params.get("pose") ?? "");
  // Pose pages pass ?pose=<id>; Surya Namaskar steps pass ?label=<classifier label>.
  const targetLabel = pose?.id ?? params.get("label");
  const [mode, setMode] = useState<Mode>(params.get("mode") === "photo" ? "photo" : "live");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pose corrector"
        subtitle={targetLabel ? `Target pose: ${poseDisplayName(targetLabel)}` : undefined}
        backHref={pose ? `/poses/${pose.id}` : "/"}
      />

      <div role="tablist" aria-label="Corrector mode" className="flex w-fit gap-1 rounded-xl bg-surface-alt p-1">
        {MODES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={mode === id}
            aria-controls={`panel-${id}`}
            onClick={() => setMode(id)}
            className={`rounded-lg px-5 py-2 font-semibold ${
              mode === id ? "bg-primary text-on-primary" : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${mode}`} aria-labelledby={`tab-${mode}`}>
        {/* Switching tabs unmounts the live view, which stops the camera. */}
        {mode === "live" ? <LiveCorrector targetLabel={targetLabel} /> : <PhotoCheck targetLabel={targetLabel} />}
      </div>
    </div>
  );
}
