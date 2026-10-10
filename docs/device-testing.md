# Real-device testing

What automated tests can't cover: real cameras, real GPUs, phone CPUs and
thermals, speech voices, wake lock, and installing to a home screen. Run this
on at least a **mid-range Android phone (Chrome)** and an **iPhone (Safari,
then the installed home-screen app)**, and record the results below.

Use the production site (or a Vercel preview, which is HTTPS; WebGPU and the
camera need HTTPS, so a LAN `http://` address only tests the CPU path).

## 1. Benchmark (2 minutes)

Open **`/lab` → Benchmark this device**. It runs MoveNet Lightning and Thunder
on CPU (WASM) and, where available, WebGPU. Tap **Copy report (Markdown)** and
paste it under [Results](#results).

What the numbers decide (see `web/src/lib/live/modelChoice.ts`):

- **Phones default to Lightning on CPU.** If Thunder's p50 is under ~100 ms on a
  mid-range phone, Thunder could be the phone default too (it's more accurate:
  Wikimedia accuracy 0.800 vs 0.765).
- **WebGPU vs CPU on phones.** On desktop, CPU beat WebGPU for Lightning. If
  WebGPU wins clearly on phones, change the phone accelerator.
- Either way, the live corrector downgrades Thunder to Lightning by itself if
  Thunder's median inference exceeds 150 ms (`shouldDowngrade`).

## 2. Checklist

Mark ✅ / ❌ (with a note) per device.

| # | Check | How | Android · Chrome | iPhone · Safari | iPhone · installed |
|---|---|---|---|---|---|
| 1 | Camera permission prompt; deny, then the recovery message | `/corrector` → Start camera → deny | | | |
| 2 | Live corrections work; skeleton lines up | Start camera, hold Tree or Warrior II | | | |
| 3 | Rear/front flip; preview not stretched or wrongly mirrored | Flip button | | | |
| 4 | FPS and model with `?debug=1` (note fps, ms, model) | `/corrector?debug=1` | | | |
| 5 | Thunder vs Lightning live | `?debug=1&model=thunder`, then `&model=lightning` | | | |
| 6 | Warm or throttled after 5 min live? FPS drop? | Leave running 5 min | | | |
| 7 | Voice speaks after Start; no overlapping speech | Live session with voice on | | | |
| 8 | Screen stays on 3+ min during a session | Live session, or guided practice | | | |
| 9 | Guided practice timer, voice cues, pause/skip | Any condition → Start guided practice | | | |
| 10 | Install flow: prompt or Add-to-Home-Screen steps; icon and splash | Settings → Install the app | n/a | | |
| 11 | Offline: airplane mode, reopen, browse; corrector photo check | After one online visit + one corrector use | | | |
| 12 | Data survives close/reopen; backup export/import | Practise once, reopen; Settings → Export/Import | | | |
| 13 | Rotation doesn't break the live overlay | Rotate during a live session | | | |
| 14 | Uploaded portrait photo is upright | Photo tab → choose a phone photo | | | |
| 15 | Update banner appears after a new deploy, Reload works | Open the app, deploy, return to the app | | | |

## Results

### 2026-10-10 · Desktop, headless Chromium (CPU only, no GPU), Windows

| Model | Accelerator | p50 | p95 | Max FPS | Load |
|---|---|---|---|---|---|
| lightning | wasm | 13 ms | 17 ms | 75.8 | 0.4 s |
| thunder | wasm | 74 ms | 77 ms | 13.6 | 0.2 s |
| lightning | webgpu | unavailable (no GPU in headless) | | | |
| thunder | webgpu | unavailable (no GPU in headless) | | | |

Earlier desktop Chrome runs with a GPU (M2) measured Thunder on WebGPU at
39–43 ms. Live sessions on this machine are capped at the fake camera's
10 fps in tests.

<!-- Paste each device's report here. -->
