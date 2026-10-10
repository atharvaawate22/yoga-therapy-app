/** Browser/platform facts that decide how the app can be installed. */

/**
 * iPhone/iPad Safari (including iPadOS, which reports itself as a Mac but
 * has touch). These install via Share -> Add to Home Screen; there is no
 * install prompt event.
 */
export function isIOS(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** Running as an installed app rather than in a browser tab. */
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
