// Main-thread blocking and tap latency during a live corrector session, in
// Chromium with the e2e fake camera (run `npx playwright test` once first).
//
//   npx serve out -l 4180 &
//   node scripts/measure-live.mjs "http://localhost:4180/corrector?debug=1"            # worker
//   node scripts/measure-live.mjs "http://localhost:4180/corrector?debug=1&worker=0"   # main thread
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "http://localhost:4180/corrector?debug=1";
const cam = process.argv[3] ?? fileURLToPath(new URL("../test-results/fake-camera.y4m", import.meta.url));
const browser = await chromium.launch({
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-video-capture=${cam}`],
});
const context = await browser.newContext({ permissions: ["camera"] });
const page = await context.newPage();
await page.goto(url);
await page.evaluate(() => {
  window.__long = [];
  window.__events = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ type: "longtask" });
  new PerformanceObserver((l) =>
    l.getEntries().forEach((e) => window.__events.push({ name: e.name, duration: e.duration })),
  ).observe({ type: "event", durationThreshold: 16 });
});
await page.getByRole("button", { name: "Start camera" }).click();
await page.locator(".font-mono").filter({ hasText: "top" }).waitFor({ timeout: 90000 });
await page.waitForTimeout(2000); // let timings settle after warm-up
await page.evaluate(() => {
  window.__long = [];
  window.__events = [];
});
const t0 = Date.now();
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Voice corrections" }).click();
}
const seconds = (Date.now() - t0) / 1000;
const r = await page.evaluate(() => ({
  long: window.__long,
  taps: window.__events.filter((e) => e.name === "click" || e.name === "pointerup").map((e) => e.duration),
  hud: document.querySelector(".font-mono")?.textContent,
}));
const pct = (a, q) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(q * a.length))] ?? 0;
console.log(
  JSON.stringify({
    hud: r.hud?.split(" · body")[0],
    longTasks: r.long.length,
    mainThreadBlocked: `${Math.round((r.long.reduce((s, d) => s + d, 0) / 1000 / seconds) * 100)}%`,
    tapP50: Math.round(pct(r.taps, 0.5)),
    tapMax: Math.round(Math.max(0, ...r.taps)),
  }),
);
await browser.close();
