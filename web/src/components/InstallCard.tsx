"use client";

import { CircleCheck, Download, Share } from "lucide-react";
import { useInstallPrompt } from "@/lib/pwa/useInstallPrompt";

/**
 * How to install the app on this device: Chrome/Edge/Android get a button
 * (the browser's install prompt); iOS gets Share -> Add to Home Screen
 * steps, since Safari has no prompt; anything else gets a hint.
 */
export function InstallCard() {
  const { installed, canPrompt, ios, prompt } = useInstallPrompt();

  if (installed) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-border bg-surface p-4 font-medium text-primary">
        <CircleCheck aria-hidden="true" className="size-5" />
        Installed. The app opens from your home screen and works offline.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <p className="text-sm text-muted">
        Install the app to open it from your home screen, full screen, and use it offline.
      </p>
      {canPrompt ? (
        <button
          type="button"
          onClick={() => void prompt()}
          className="flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-semibold text-on-primary hover:bg-primary-strong"
        >
          <Download aria-hidden="true" className="size-5" />
          Install app
        </button>
      ) : ios ? (
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
          <li>
            Tap the <Share aria-label="Share" className="inline size-4 align-text-bottom" /> Share button in
            Safari&apos;s toolbar.
          </li>
          <li>Choose &ldquo;Add to Home Screen&rdquo;.</li>
          <li>Tap &ldquo;Add&rdquo;.</li>
        </ol>
      ) : (
        <p className="text-sm">
          Use your browser&apos;s menu and choose &ldquo;Install app&rdquo; or &ldquo;Add to Home
          screen&rdquo;.
        </p>
      )}
    </div>
  );
}
