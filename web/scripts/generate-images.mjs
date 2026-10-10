// Generates the web app's images from the RN app's assets. Run it after
// changing those assets; the outputs are committed.
//
//   node scripts/generate-images.mjs
//
// - Pose photos: assets/poses/*.png (1024 px, ~0.8 MB each) -> WebP at 480
//   and 960 px in public/poses/, plus a tiny blurred placeholder, listed in
//   src/content/poseImages.generated.json.
// - PWA icons: public/icons/icon-{192,512}.png and a maskable 512 px icon
//   (the Android adaptive-icon foreground on its background colour).
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const webDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = join(webDir, "..", "assets");
const posesOut = join(webDir, "public", "poses");
const iconsOut = join(webDir, "public", "icons");
const manifestOut = join(webDir, "src", "content", "poseImages.generated.json");

const WIDTHS = [480, 960];
const ADAPTIVE_BACKGROUND = "#F1F8E9"; // app.config.js android.adaptiveIcon.backgroundColor

mkdirSync(posesOut, { recursive: true });
mkdirSync(iconsOut, { recursive: true });

const manifest = {};
let before = 0;
let after = 0;
for (const file of readdirSync(join(assetsDir, "poses")).filter((f) => f.endsWith(".png")).sort()) {
  const name = basename(file, ".png");
  const source = join(assetsDir, "poses", file);
  before += statSync(source).size;
  const meta = await sharp(source).metadata();
  const entry = { width: meta.width, height: meta.height, sources: {} };
  for (const width of WIDTHS) {
    const out = join(posesOut, `${name}-${width}.webp`);
    await sharp(source).resize({ width }).webp({ quality: 80 }).toFile(out);
    after += statSync(out).size;
    entry.sources[width] = `/poses/${name}-${width}.webp`;
  }
  const blur = await sharp(source).resize({ width: 16 }).webp({ quality: 40 }).toBuffer();
  entry.blurDataURL = `data:image/webp;base64,${blur.toString("base64")}`;
  manifest[name] = entry;
}
writeFileSync(manifestOut, JSON.stringify(manifest, null, 2) + "\n");

const icon = join(assetsDir, "icon.png");
for (const size of [192, 512]) {
  await sharp(icon).resize(size, size).png().toFile(join(iconsOut, `icon-${size}.png`));
}
// Maskable: launchers crop to a circle or squircle within the central 80%,
// which the adaptive-icon foreground is already designed for.
await sharp(join(assetsDir, "adaptive-icon.png"))
  .resize(512, 512)
  .flatten({ background: ADAPTIVE_BACKGROUND })
  .png()
  .toFile(join(iconsOut, "maskable-512.png"));

console.log(
  `Pose images: ${Object.keys(manifest).length} photos, ${(before / 1e6).toFixed(1)} MB PNG -> ${(after / 1e6).toFixed(2)} MB WebP (both sizes). Icons written.`,
);
