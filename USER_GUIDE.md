# Yoga Therapy App — Install & Usage Guide (APK)

This app is **not on the Play Store**. You install it directly as an APK file on
an Android phone. This guide explains where to get the APK, how to install it,
what works out of the box, and how the **Live Pose Corrector** (AI camera
feedback) works — it just needs your phone to be online, nothing to set up.

---

## 1. What works with just the APK (no setup at all)

Once installed, everything below works fully offline — no server, no account,
no internet:

| Feature | What it does |
|---|---|
| 🩺 Health conditions | Browse 11 conditions (Back Pain, Stress, Insomnia, …) with recommended poses |
| 🧘 Guided practice | Timed play-through of poses with voice cues, pause/skip, prep countdowns |
| ☀️ Surya Namaskar | 12-step guided sun salutation with round selection and breathing cues |
| 📋 Custom sets | Build, edit, reorder and play your own routines |
| ❤️ Favorites | Bookmark poses; they appear on the Home screen |
| 📊 Progress | Practice history, day streak, weekly minutes, 7-day activity chart |
| 🔔 Daily reminders | One local notification a day at a time you pick |

The **📸 Live Pose Corrector** (AI camera feedback) needs one extra thing:
your phone online — see section 4.

---

## 2. Getting the APK

**Just download it — no commands, no account:**

<p>
  <a href="https://github.com/atharvaawate22/yoga-therapy-app/releases/latest/download/yoga-therapy.apk">
    <img src="https://img.shields.io/badge/⬇%20Download%20APK-Android-2E7D32?style=for-the-badge&logo=android&logoColor=white" alt="Download APK" />
  </a>
</p>

**[⬇ yoga-therapy.apk (latest version)](https://github.com/atharvaawate22/yoga-therapy-app/releases/latest/download/yoga-therapy.apk)**

Open that link on your Android phone and the APK downloads directly — then
continue with section 3. Older versions are listed on the
[Releases page](https://github.com/atharvaawate22/yoga-therapy-app/releases).
This link is republished automatically by CI on every push to `main` (see
[`.github/workflows/eas-build.yml`](.github/workflows/eas-build.yml)), so
it's always the current build — no manual step needed.

> ℹ️ **Note about the Pose Corrector:** every APK is built pointing at the
> hosted backend (see section 4) — no server address to configure, no
> network requirements beyond your phone having internet.

<details>
<summary>For developers: building the APK yourself</summary>

**Cloud build with EAS** (free Expo account, no Android tooling needed):

```bash
npm install && npm install -g eas-cli
eas login
eas init                       # first time only
eas build --platform android --profile preview
```

By default this points at the hosted backend baked into
[`src/config/poseApi.js`](src/config/poseApi.js) (`HOSTED_API_URL`) — no
configuration needed. The finished build gives you a download link + QR code.

**Local build** (needs JDK 17 + Android SDK):

```bash
npx expo prebuild --platform android
cd android
gradlew assembleRelease        # .\gradlew on Windows, ./gradlew on macOS/Linux
```

The APK lands in `android/app/build/outputs/apk/release/app-release.apk`.

**Running your own copy of the backend instead of the hosted one:** see
[`backend/README.md`](backend/README.md) for deployment options (AWS
Lambda, Render, or plain `uvicorn` on a LAN machine for local dev). If you
point the app at a LAN server for local development, `fallbackHost` in
`src/config/poseApi.js` is only used in Expo dev mode when the dev host
can't be auto-detected — it's not used in a built APK, which always uses
`HOSTED_API_URL` if set.

**Publishing a new release manually** (CI does this automatically on every
push to `main` — see above; only needed for an out-of-band release):

```bash
gh release create v1.x.x path/to/app-release.apk#yoga-therapy.apk --title "v1.x.x" --notes "..."
```

Keeping the asset named `yoga-therapy.apk` keeps the
`releases/latest/download/yoga-therapy.apk` direct link working.
</details>

---

## 3. Installing the APK on your phone

1. Copy the `.apk` to your phone (direct download, USB, or any file share).
2. Tap the file. Android will warn that the app is from an **unknown source**
   — this is expected for any app outside the Play Store. Allow
   **"Install unknown apps"** for your browser/file manager when prompted.
3. Tap **Install**, then open **Yoga Therapy**.
4. On first launch, set up your profile (name, age, experience level) and
   optionally a daily reminder. Allow the **notifications** permission if you
   want reminders, and the **camera** permission if you plan to use the Pose
   Corrector.

That's it — everything in section 1 now works with no further setup.

---

## 4. Using the Live Pose Corrector

### How it actually works

The AI that recognizes your pose does **not** run on the phone. The app takes
a camera frame (or a gallery photo) and sends it over the internet to a
hosted backend — a MoveNet (TensorFlow Lite) keypoint model plus a trained
classifier, running on AWS Lambda behind API Gateway. The backend sends back
the detected pose and correction tips, which the app shows on screen and
speaks aloud.

```
Your phone (app)  ──camera frame──▶  Hosted backend on AWS (internet)
                  ◀──pose + tips──
```

Consequences of this design:

- **Just needs your phone to be online** (Wi-Fi or mobile data) — no laptop,
  no local network, nothing to start or configure.
- The backend is serverless and **cold-starts** after a period of inactivity:
  the first request after a while can take 30–40 seconds, which is longer
  than the gateway's timeout, so that first attempt may show a brief demo
  fallback. Retrying immediately after hits the now-warm backend and works
  normally. Every request after that is fast (roughly 1 analysis/sec).
- If your phone has no internet connection at all, the app shows an
  **"Analysis server unreachable"** banner and falls back to a simulated demo
  so the feature still demonstrates end-to-end. Everything else in the app
  keeps working regardless.

### Using it

1. In the app, open **Live Mobile Pose Corrector** from the Home screen (live
   camera) or use **🖼️ Image → Upload from Gallery** for a single photo.
2. Optionally tap **Test Backend Connection** at the bottom to confirm it's
   reachable before you start.
3. Stand back so your **full body** is in frame, in reasonably good lighting.

### Troubleshooting

| Symptom | Fix |
|---|---|
| "Analysis server unreachable" banner, or a "DEMO" badge on the result | Phone has no internet, or the very first request hit a cold start and timed out (see above) — tap **Retry Connection** or just try again; the second attempt hits the now-warm backend. |
| Pose never recognized ("No full-body skeleton detected") | Stand back so your **full body** — head to feet — is in frame, good lighting, camera roughly waist height. |
| No voice feedback | Check the 🔊 toggle in the corrector, the global **Settings → Voice guidance** switch, and media volume. |

Want to run your own copy of the backend instead of the hosted one (e.g. for
local development)? See [`backend/README.md`](backend/README.md).

---

## 5. Updating and uninstalling

- **Update:** install a newer APK over the old one (same package id) — your
  profile, history, favorites and custom sets are kept.
- **Uninstall:** removes all data. Practice history lives only on the phone —
  there is no cloud backup. You can also wipe just the history from
  **Settings → Clear practice history** inside the app.

## Privacy

Profile, history, favorites and custom sets stay on your device (stored
locally) — nothing is synced to an account. Camera frames from the Pose
Corrector are sent to the hosted backend over the internet for analysis and
are processed in memory only, never written to disk or stored anywhere on
the server side.
