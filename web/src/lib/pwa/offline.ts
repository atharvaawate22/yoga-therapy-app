/** Offline readiness of the pose models (cached by the service worker). */

const RUNTIME_CACHE = "yoga-runtime"; // see sw/sw.js

/** Which MoveNet variants are cached for offline use. */
export async function cachedModels(): Promise<string[]> {
  if (typeof caches === "undefined") return [];
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const keys = await cache.keys();
    const variants = new Set<string>();
    for (const request of keys) {
      const match = /\/models\/movenet_(\w+)\.tflite/.exec(new URL(request.url).pathname);
      if (match) variants.add(match[1]!);
    }
    return [...variants].sort();
  } catch {
    return [];
  }
}

let persistRequested = false;

/**
 * Ask the browser not to evict our storage (the cached model is tens of MB
 * and history lives in localStorage). Called after the first model loads;
 * browsers may grant it silently, prompt, or decline.
 */
export function requestPersistentStorage(): void {
  if (persistRequested) return;
  persistRequested = true;
  void navigator.storage?.persist?.().catch(() => undefined);
}
