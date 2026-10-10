// Records the README's demo GIF from the real static build: the corrector's
// no-camera demo (`/corrector?demo=1`), so every label, confidence and cue in
// the GIF is real model output from the browser, not a mock-up.
//
//   npm run build && node scripts/record-demo.mjs [out.gif] [seconds]
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const OUT = process.argv[2] ?? "../assets/readme/web-demo.gif";
const SECONDS = Number(process.argv[3] ?? 14);
const PORT = 4181;
const FRAME_MS = 250;
const VIEWPORT = { width: 430, height: 900 };

// Run serve's entry point directly: through npx on Windows, kill() stops the
// shell but leaves the server holding the port.
const server = spawn(process.execPath, ["node_modules/serve/build/main.js", "out", "-l", String(PORT), "--no-clipboard"], {
  stdio: "ignore",
});
const browser = await chromium.launch();
try {
  for (let i = 0; i < 60; i++) {
    if (await fetch(`http://localhost:${PORT}/`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme: "light" });
  await page.goto(`http://localhost:${PORT}/corrector?demo=1`);
  const overlay = page.locator(".absolute.inset-x-2");
  // Wait until the model is loaded and the first pose is reported.
  await overlay.filter({ hasText: /Warrior II|Tree Pose|Downward-Facing Dog|Triangle Pose/ }).waitFor({ timeout: 120_000 });
  const stage = page.locator("main");
  const box = await stage.boundingBox();
  const clip = { x: 0, y: Math.max(0, box.y), width: VIEWPORT.width, height: Math.min(VIEWPORT.height - box.y, 760) };

  const frames = [];
  const end = Date.now() + SECONDS * 1000;
  while (Date.now() < end) {
    const started = Date.now();
    frames.push(await page.screenshot({ clip }));
    await page.waitForTimeout(Math.max(0, FRAME_MS - (Date.now() - started)));
  }
  console.log(`${frames.length} frames`);

  // Stack the frames into one tall raw image with a page height; sharp
  // writes that as an animated GIF.
  const width = 360;
  const raws = await Promise.all(
    frames.map((f) => sharp(f).resize({ width }).removeAlpha().raw().toBuffer({ resolveWithObject: true })),
  );
  const height = raws[0].info.height;
  mkdirSync(dirname(OUT), { recursive: true });
  const info = await sharp(Buffer.concat(raws.map((r) => r.data)), {
    raw: { width, height: height * raws.length, channels: 3, pageHeight: height },
  })
    .gif({ delay: raws.map(() => FRAME_MS), loop: 0, colours: 96, effort: 10 })
    .toFile(OUT);
  console.log(`${OUT}: ${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)} KB`);
} finally {
  await browser.close();
  server.kill();
}
