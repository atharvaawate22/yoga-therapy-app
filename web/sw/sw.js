/* Service worker for the Yoga Therapy web app.
 *
 * scripts/build-sw.mjs writes this file to out/sw.js after `next build`,
 * replacing __BUILD__ with the list of files to precache and the model
 * revisions (content hashes). Kept as plain JavaScript with no dependencies,
 * so what the browser runs is exactly what's here.
 *
 * - Precached (on install): every page, Next's hashed assets, fonts, icons,
 *   pose photos and the demo photos. Served cache-first, so the app opens
 *   instantly and works offline.
 * - Cached on first use: the MoveNet models and LiteRT's WebAssembly (tens of
 *   MB, only needed by the corrector). Keyed by content hash, so a retrained
 *   model replaces the stale copy.
 * - A new deploy installs a new worker that waits; the page offers a reload
 *   (SKIP_WAITING) instead of swapping code under a running app.
 */

const BUILD = __BUILD__;
const PRECACHE = `yoga-precache-${BUILD.version}`;
const RUNTIME = "yoga-runtime"; // models + WASM, pruned by revision

/** URL path -> revision for everything precached. */
const PRECACHE_REVISIONS = new Map(BUILD.precache.map((entry) => [entry.url, entry.revision]));

function runtimeRevision(pathname) {
  return BUILD.runtime[pathname];
}

function runtimeKey(pathname, revision) {
  return `${pathname}?rev=${revision}`;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      // One failed file shouldn't leave a half-installed worker; addAll is atomic.
      await cache.addAll(BUILD.precache.map((entry) => new Request(entry.url, { cache: "reload" })));
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith("yoga-precache-") && name !== PRECACHE) await caches.delete(name);
      }
      // Drop models/WASM whose content changed in this deploy.
      const runtime = await caches.open(RUNTIME);
      const current = new Set(
        Object.entries(BUILD.runtime).map(([path, rev]) => runtimeKey(path, rev)),
      );
      for (const request of await runtime.keys()) {
        const url = new URL(request.url);
        if (!current.has(url.pathname + url.search)) await runtime.delete(request);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

/** "/about/" and "/about" are the same page; queries don't change the file. */
function precacheUrl(url) {
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/$/, "") : url.pathname;
  return PRECACHE_REVISIONS.has(path) ? path : null;
}

async function cacheFirstPrecache(path) {
  const cache = await caches.open(PRECACHE);
  const cached = await cache.match(path);
  return cached ?? fetch(path);
}

async function cacheFirstRuntime(request, pathname, revision) {
  const cache = await caches.open(RUNTIME);
  const key = runtimeKey(pathname, revision);
  const cached = await cache.match(key);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(key, response.clone());
  return response;
}

async function navigate(request) {
  try {
    return await fetch(request);
  } catch {
    // Offline and not precached (e.g. a mistyped URL): the 404 page.
    const cache = await caches.open(PRECACHE);
    return (await cache.match("/404.html")) ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const precached = precacheUrl(url);
  if (precached) {
    event.respondWith(cacheFirstPrecache(precached));
    return;
  }
  const revision = runtimeRevision(url.pathname);
  if (revision) {
    event.respondWith(cacheFirstRuntime(request, url.pathname, revision));
    return;
  }
  if (request.mode === "navigate") event.respondWith(navigate(request));
});
