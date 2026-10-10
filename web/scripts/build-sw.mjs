// Writes out/sw.js after `next build`: the service worker template
// (sw/sw.js) with the precache list and model revisions filled in.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { buildManifest, injectManifest, isPrecached } from "./sw-manifest.mjs";

const webDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(webDir, "out");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(outDir).map((full) => ({
  path: relative(outDir, full).split("\\").join("/"),
  hash: createHash("sha256").update(readFileSync(full)).digest("hex").slice(0, 16),
  size: statSync(full).size,
}));

const demoPhotos = JSON.parse(readFileSync(join(webDir, "src", "content", "demoPhotos.json"), "utf8")).photos.map(
  (photo) => photo.file,
);
const manifest = buildManifest(files, demoPhotos);
const template = readFileSync(join(webDir, "sw", "sw.js"), "utf8");
writeFileSync(join(outDir, "sw.js"), injectManifest(template, manifest));

const bytes = files.filter((f) => isPrecached(f.path, demoPhotos)).reduce((sum, f) => sum + f.size, 0);
console.log(
  `sw.js: ${manifest.precache.length} files precached (${(bytes / 1e6).toFixed(1)} MB), ` +
    `${Object.keys(manifest.runtime).length} cached on first use, version ${manifest.version}`,
);
