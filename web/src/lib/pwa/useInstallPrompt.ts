"use client";

import { useCallback, useEffect, useState } from "react";
import { useClientValue } from "@/lib/hooks/useClientValue";
import { isIOS, isStandalone } from "./platform";

/** Chrome's install prompt event (not in TypeScript's DOM types). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface InstallState {
  /** Already running as an installed app. */
  installed: boolean;
  /** The browser offered an install prompt we can show. */
  canPrompt: boolean;
  /** iOS: install by hand via Share -> Add to Home Screen. */
  ios: boolean;
  prompt: () => Promise<void>;
}

// The event fires once, often before React mounts, so it's captured at
// module load and shared by every component using the hook.
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // show our own button instead of the mini-infobar
    deferred = event as BeforeInstallPromptEvent;
    listeners.forEach((notify) => notify());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((notify) => notify());
  });
}

export function useInstallPrompt(): InstallState {
  const [canPrompt, setCanPrompt] = useState(false);
  const [installedNow, setInstalledNow] = useState(false);
  const standalone = useClientValue(isStandalone, false);
  const ios = useClientValue(() => isIOS(navigator.userAgent, navigator.maxTouchPoints), false);

  useEffect(() => {
    const sync = () => {
      setCanPrompt(deferred !== null);
      if (deferred === null && window.matchMedia("(display-mode: standalone)").matches) setInstalledNow(true);
    };
    sync();
    listeners.add(sync);
    const onInstalled = () => setInstalledNow(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      listeners.delete(sync);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const prompt = useCallback(async () => {
    if (!deferred) return;
    const event = deferred;
    await event.prompt();
    const { outcome } = await event.userChoice;
    deferred = null; // a prompt can only be used once
    setCanPrompt(false);
    if (outcome === "accepted") setInstalledNow(true);
  }, []);

  return { installed: standalone || installedNow, canPrompt, ios: ios && !standalone, prompt };
}
