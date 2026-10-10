// Decides what the service worker caches, from the files in the static
// export. Pure functions, unit-tested in src/lib/pwa/swManifest.test.ts.

/**
 * Files fetched on demand and cached at runtime, not at install: the
 * MoveNet models and LiteRT's WebAssembly builds (only one of the four is
 * ever loaded), tens of MB the corrector may never need.
 */
export function isRuntimeCached(path) {
  return path.startsWith("models/") || path.startsWith("litert/");
}

/**
 * Whether an exported file is precached at install. Paths use forward
 * slashes. `demoPhotos` lists the fixture photos the app itself shows
 * (src/content/demoPhotos.json); the other fixtures serve only /lab.
 */
export function isPrecached(path, demoPhotos = []) {
  if (isRuntimeCached(path) || path === "sw.js") return false;
  // The RN app's original pose PNGs are still emitted (its data files
  // require() them) but the web serves WebP versions instead.
  if (/^_next\/static\/media\/.+\.png$/.test(path)) return false;
  if (path.startsWith("lab/fixtures/")) {
    return path === "lab/fixtures/ATTRIBUTION.md" || demoPhotos.includes(path.slice("lab/fixtures/".length));
  }
  return (
    path.endsWith(".html") ||
    path.endsWith(".txt") || // React Server Component payloads for client navigation
    path.startsWith("_next/static/") ||
    path.startsWith("poses/") ||
    path.startsWith("icons/") ||
    path.startsWith("demo/") ||
    ["manifest.webmanifest", "icon.png", "apple-icon.png"].includes(path)
  );
}

/**
 * The URL a file is served at. Pages drop ".html" (Vercel and `serve` map
 * /about to about.html); index.html is "/". Everything else is served as is.
 */
export function urlFor(path) {
  if (path === "index.html") return "/";
  if (path.endsWith(".html") && path !== "404.html" && !path.startsWith("_next/")) {
    return `/${path.slice(0, -".html".length)}`;
  }
  return `/${path}`;
}

/**
 * Build the service worker's manifest from `{ path, hash }` records of
 * every exported file.
 */
export function buildManifest(files, demoPhotos = []) {
  const precache = files
    .filter((f) => isPrecached(f.path, demoPhotos))
    .map((f) => ({ url: urlFor(f.path), revision: f.hash }))
    .sort((a, b) => a.url.localeCompare(b.url));
  const runtime = Object.fromEntries(
    files
      .filter((f) => isRuntimeCached(f.path))
      .map((f) => [urlFor(f.path), f.hash])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  // The cache version changes whenever any precached file does.
  let version = 0;
  for (const { url, revision } of precache) {
    for (const ch of `${url}:${revision};`) version = (version * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return { version: version.toString(16), precache, runtime };
}

const PLACEHOLDER = "const BUILD = __BUILD__;";

/**
 * Fill the service worker template's manifest. Replaces the exact
 * assignment (the placeholder name also appears in comments) using a
 * function, so "$" sequences in the JSON aren't treated as patterns.
 */
export function injectManifest(template, manifest) {
  if (template.split(PLACEHOLDER).length !== 2) {
    throw new Error(`The service worker template must contain "${PLACEHOLDER}" exactly once`);
  }
  return template.replace(PLACEHOLDER, () => `const BUILD = ${JSON.stringify(manifest)};`);
}
