"use client";

import { useEffect } from "react";
import { useClientValue } from "./useClientValue";

/**
 * Keep the screen on while `active` (the user holds poses without touching
 * the device). Browsers drop the lock when the tab is hidden, so it is
 * re-requested when the page becomes visible again.
 *
 * Returns whether the Screen Wake Lock API exists, so the UI can suggest
 * changing the screen timeout where it doesn't.
 */
export function useWakeLock(active: boolean): { supported: boolean } {
  const supported = useClientValue(() => "wakeLock" in navigator, true);

  useEffect(() => {
    if (!supported || !active) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) await lock.release();
        else sentinel = lock;
      } catch {
        // Denied (e.g. battery saver) or not allowed yet; nothing to do.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void request();
    };

    void request();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => {});
    };
  }, [active, supported]);

  return { supported };
}
