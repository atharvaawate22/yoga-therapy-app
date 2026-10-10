"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, X } from "lucide-react";
import { useClientValue } from "@/lib/hooks/useClientValue";
import { useInstallPrompt } from "@/lib/pwa/useInstallPrompt";

// Per-device UI state, deliberately outside the "@yoga_" keys that backups
// copy between devices.
const DISMISSED_KEY = "yoga-web:install-nudge-dismissed";

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * A one-time suggestion to install, shown on Home once the user has
 * practised at least once (not on first visit), until installed or dismissed.
 */
export function InstallNudge({ hasPractised }: { hasPractised: boolean }) {
  const { installed, canPrompt, ios, prompt } = useInstallPrompt();
  const dismissedEarlier = useClientValue(wasDismissed, true);
  const [dismissed, setDismissed] = useState(false);

  if (!hasPractised || installed || dismissedEarlier || dismissed || !(canPrompt || ios)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage blocked: it just shows again next visit.
    }
  };

  return (
    <aside aria-label="Install the app" className="flex items-center gap-3 rounded-xl border border-border bg-surface-alt p-4">
      <Download aria-hidden="true" className="size-6 shrink-0 text-primary" />
      <p className="flex-1 text-sm">
        <span className="font-semibold">Install Yoga Therapy</span> for one-tap access and offline practice.
      </p>
      {canPrompt ? (
        <button
          type="button"
          onClick={() => void prompt()}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary"
        >
          Install
        </button>
      ) : (
        <Link href="/settings#install" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary">
          How
        </Link>
      )}
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="rounded-full p-1 text-muted hover:bg-surface">
        <X aria-hidden="true" className="size-4" />
      </button>
    </aside>
  );
}
