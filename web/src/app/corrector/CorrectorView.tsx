"use client";

import { useSearchParams } from "next/navigation";
import { Camera } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { poseById, poseDisplayName } from "@/content";
import { APK_URL } from "@/lib/links";
import { PhotoCheck } from "./PhotoCheck";

/**
 * The corrector: photo analysis works in the browser today; the live camera
 * mode arrives in M4.
 */
export function CorrectorView() {
  const params = useSearchParams();
  const pose = poseById(params.get("pose") ?? "");
  // Pose pages pass ?pose=<id>; Surya Namaskar steps pass ?label=<classifier label>.
  const targetLabel = pose?.id ?? params.get("label");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pose corrector"
        subtitle={targetLabel ? `Target pose: ${poseDisplayName(targetLabel)}` : undefined}
        backHref={pose ? `/poses/${pose.id}` : "/"}
      />

      <PhotoCheck targetLabel={targetLabel} />

      <section className="flex items-start gap-4 rounded-2xl border border-border bg-surface p-5">
        <span className="bg-hero flex size-12 shrink-0 items-center justify-center rounded-xl">
          <Camera aria-hidden="true" className="size-6" />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">Live camera: coming next</h2>
          <p className="text-muted">
            Real-time corrections from your camera, spoken aloud while you hold the pose, also
            running on this device. Until then, live mode is in the Android app.
          </p>
          <a href={APK_URL} className="w-fit font-semibold text-primary hover:underline">
            Get the Android app
          </a>
        </div>
      </section>
    </div>
  );
}
