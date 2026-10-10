"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Camera, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { poseById } from "@/content";
import { APK_URL } from "@/lib/links";

/**
 * The live corrector arrives in M4 (in-browser inference). Until then this
 * page says so plainly rather than faking results.
 */
export function CorrectorPlaceholder() {
  const params = useSearchParams();
  const pose = poseById(params.get("pose") ?? "");

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <PageHeader
        title="Pose corrector"
        subtitle={pose ? `Target pose: ${pose.name}` : undefined}
        backHref={pose ? `/poses/${pose.id}` : "/"}
      />
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-6 text-center">
        <span className="bg-hero flex size-16 items-center justify-center rounded-2xl">
          <Camera aria-hidden="true" className="size-8" />
        </span>
        <h2 className="text-xl font-bold">Coming to the web</h2>
        <p className="text-muted">
          The pose corrector isn&apos;t in the web app yet. When it arrives, it will run entirely in
          your browser: point a camera at yourself and hear how to fix your alignment.
        </p>
        <p className="flex items-start gap-2 text-left text-sm text-muted">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          Camera frames will be analyzed on your device and never uploaded.
        </p>
        <a
          href={APK_URL}
          className="w-full rounded-xl bg-primary px-5 py-3 font-semibold text-on-primary hover:bg-primary-strong"
        >
          Use it in the Android app
        </a>
        <Link href="/about" className="text-sm font-semibold text-primary hover:underline">
          How the corrector works
        </Link>
      </div>
    </div>
  );
}
