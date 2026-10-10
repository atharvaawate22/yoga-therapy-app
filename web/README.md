# Yoga Therapy — web app

The installable web version (PWA) of the Yoga Therapy app. Next.js 16 (App
Router), TypeScript, Tailwind, built as a fully static export. Pose logic lives
in [`../packages/pose-core`](../packages/pose-core) and is shared with the
Python backend's contract through parity tests.

Status and roadmap: [`docs/web-app-plan.md`](../docs/web-app-plan.md).
Milestone M1 is in: everything in the Android app except the camera pose
corrector (routines, guided practice, Surya Namaskar, custom sets, favorites,
progress, settings), stored in the browser with JSON backup and restore.

## Develop

```bash
cd web
npm install          # also links ../packages/pose-core
npm run dev          # http://localhost:3000
```

CI installs with npm 10 (Node 22). npm 11 on Windows can write a lockfile that
npm 10 rejects, so add dependencies with `npx npm@10 install <pkg>`.

| Script | What it does |
|---|---|
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm run typecheck` | Generates Next route types, then `tsc --noEmit` |
| `npm test` | Vitest + Testing Library (jsdom) |
| `npm run build` | Static export to `out/`, then `out/sw.js` (service worker) |
| `npx playwright test` | End-to-end tests against `out/` in Chromium (build first) |
| `npm run lighthouse` | Mobile Lighthouse budgets on the main pages (serve `out/` on :4180 first) |
| `npm run preview` | Serves `out/` locally |

CI: [`.github/workflows/web-ci.yml`](../.github/workflows/web-ci.yml) runs
all of the above for `web/` and `packages/` on every PR and on pushes to
`main`. Changes here don't trigger the Android APK build.

## How it's put together

- **Shared with the APK, not copied.** Poses, conditions, tips and the Surya
  Namaskar sequence come straight from the RN app's `src/data` (the `@app-data`
  alias). So do its storage helpers: `userStorage.js` and `sessionStorage.js`
  run unchanged because `next.config.ts` aliases AsyncStorage to a localStorage
  shim (`src/lib/storage/asyncStorageShim.ts`). Streaks and stats are the same
  code, under the same Jest tests, as on Android. `src/content` and
  `src/lib/storage` give that JS a typed boundary.
- **Timing logic is pure.** Guided practice and Surya Namaskar are reducers in
  `src/lib/practice/` with unit tests. The practice page applies wall-clock
  seconds, not timer callbacks, because browsers throttle background timers.
- **Browser equivalents for native features:** Web Speech API (voice cues),
  Screen Wake Lock (screen stays on), a native `<dialog>` (the RN app's
  `Alert.alert` does nothing on the web), and a calendar `.ics` file instead of
  scheduled notifications, which browsers can't do while the page is closed.
- **Static export.** Every condition and pose page is prerendered; anything
  read from storage renders after hydration. Routines are addressed by URL
  (`/practice?condition=back-pain`, `?pose=tree_pose`, `?set=<id>`).
- `pose-core` is a `file:` dependency that ships TypeScript source, so
  `next.config.ts` lists it in `transpilePackages` and points `turbopack.root`
  at the repo root (Turbopack won't resolve files outside its root).

## In-browser inference (M2)

`src/inference/` runs MoveNet in the browser with **LiteRT.js**, executing the
server's own `.tflite` files (copied from `backend/models` into `public/models`
by `scripts/copy-runtime-assets.mjs`, together with LiteRT's WASM). WebGPU uses
LiteRT's JSPI build; CPU uses the plain build, which is faster there.
Pre-processing mirrors the server: pad to a centred square with grey (114)
borders, never crop.

**Photo check (M3).** `/corrector` analyses a photo entirely on the device:
MoveNet Thunder on LiteRT, then `pose-core`'s `analyzeFrame` (the server's
gate, classifier and correction rules, held to it by golden parity tests).
The first use downloads the model with a progress bar. The live camera mode
is M4.

**Live corrector (M4).** `/corrector` (Live tab) analyses the camera, a video
file or a no-camera demo in real time, on the device:

- **Model:** Thunder on desktop (WebGPU where LiteRT can use it, else WASM),
  Lightning on phones (`src/lib/live/modelChoice.ts`). `?model=` and `?accel=`
  override it, and `?debug=1` shows FPS, timings and the classifier's raw top
  guess.
- **Vote:** a time-window version of the server's 3-of-5 rule (`TimeWindowVote`
  in pose-core: 1.2 s, 60%), which never keeps fewer than 5 frames, so slow
  devices get the server's exact rule.
- **Speech:** `SpeechCoach` speaks a cue only after it has held for 2 s, at
  most every 4 s, and never twice in a row.
- **Sessions:** saved like the APK does (15 s or more with a recognised pose,
  camera only).
- **Demo:** `/corrector?demo=1` starts a slideshow of the credited sample
  photos.

To add recorded demo clips, put MP4 (H.264) or WebM files in `public/demo/`
and list them in `public/demo/videos.json`, for example
`[{"file": "tree.mp4", "label": "Tree Pose"}]`. Each one appears as a "Sample"
button. Keep clips short (8–12 s, ~1–2 MB) and only use footage of people who
agreed to be published (see `docs/RECORDING_GUIDE.md`).

`/lab` is a developer page that checks the browser against the server on 32
fixture photos (`public/lab/fixtures`, generated by
`backend/export_lab_fixtures.py`). It reports keypoint error, label and
served-result agreement, plus a benchmark and a live skeleton view. Results
and the runtime decision are in the plan, under Progress → M2.

## Installable and offline (M5)

- **Manifest** (`src/app/manifest.ts`): name, colours, any and maskable
  icons, and shortcuts. iOS gets `appleWebApp` metadata, and Settings shows
  "Share → Add to Home Screen" steps there, since Safari has no install prompt.
- **Install prompts:** Chrome and Android get an "Install app" button
  (`useInstallPrompt`) in Settings, and a one-time nudge on Home after the
  first practice session.
- **Service worker** (`sw/sw.js`, filled in by `scripts/build-sw.mjs` after
  `next build`), with no dependencies:
  - At install it precaches every page, Next's hashed assets, fonts, icons,
    pose photos and demo photos (about 5.7 MB), served cache-first.
  - The models and LiteRT WASM are cached the first time the corrector
    needs them. Content hashes version both caches, so a deploy or a
    retrained model replaces only what changed.
  - A new version waits until the user taps "Reload" in the update banner.
- **Images:** `scripts/generate-images.mjs` turns the RN app's pose PNGs
  (7.9 MB) into 480/960 px WebP (0.23 MB) and generates the icons. Rerun it
  after changing `assets/`; a test fails if a photo has no WebP version.
- **End-to-end tests** (`e2e/`, also in CI) check the manifest, offline use
  after one visit, the corrector offline once its model has loaded, and the
  live camera through Chromium's fake camera: Warrior II is recognised,
  matched against the target, corrected, and saved to Progress.

## Performance (M6)

Measured in Chromium on a Windows desktop; phone numbers go in
[`docs/device-testing.md`](../docs/device-testing.md) (`/lab` → Benchmark this
device).

- **Lighthouse (mobile), every main page:** performance 93–98, accessibility
  100, best practices 96 (100 on Linux; the gap is a Windows-only Next export
  bug), SEO 100. CI fails below 90 / 95 / 95 / 90 (`scripts/lighthouse.mjs`).
- **Inference runs in a Web Worker** (`src/inference/pose.worker.ts`). On a
  live session with Thunder on CPU, the main thread went from 64–67 long tasks
  per ~6 s (70% blocked, taps answered in 32–96 ms) to none (taps in
  16–24 ms), at the same inference speed (`scripts/measure-live.mjs`).
- **The corrector page loads lighter.** The classifier weights now load with
  the model, and WebGPU probing waits for Start. Lighthouse TBT on
  `/corrector` fell from 220 ms to 30–70 ms.
- **The model adapts to the device.** If Thunder's median inference exceeds
  150 ms live, the session switches to Lightning (checked with a 4×
  throttled CPU), and WebGPU that fails to start falls back to CPU.

Known local quirk: on Windows, Next 16.3's static export writes nested
prefetch files to the wrong path, so a local `npm run preview` logs 404s for
`__next.*.txt` prefetches. Navigation still works, and Linux builds (CI,
Vercel) are unaffected.

## Deploy (Vercel)

One-time setup in the Vercel dashboard:

1. **Add New → Project**, import `atharvaawate22/yoga-therapy-app`.
2. **Root Directory:** `web`. Leave "Include files outside the root
   directory in the Build Step" **on**: the build needs `../packages`.
3. Framework preset **Next.js**; the defaults for build and output are right
   for a static export.
4. **Settings → Domains:** add `yoga.atharvaawate.me`, then create the DNS
   record Vercel shows (a `CNAME` for `yoga`) at the domain's DNS provider.

After that, pushes to `main` deploy production and every PR gets a preview URL.
