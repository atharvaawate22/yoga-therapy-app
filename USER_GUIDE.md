# Yoga Therapy App — Install & Usage Guide (APK)

This app is **not on the Play Store**. You install it directly as an APK file on
an Android phone. This guide explains where to get the APK, how to install it,
what works out of the box, and how to set up the **Live Pose Corrector**, which
needs a companion server running on a laptop on the **same Wi-Fi network**.

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

The **only** feature that needs anything extra is the **📸 Live Pose Corrector**
(AI camera feedback) — see section 4.

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

> ⚠️ **Note about the Pose Corrector:** the server address is baked into the
> APK at build time (see section 5). The downloaded APK expects the laptop
> server at the IP it was built with — check the release notes for which IP
> that is. **Every other feature works regardless**, with no server at all.

<details>
<summary>For developers: building the APK yourself</summary>

**Cloud build with EAS** (free Expo account, no Android tooling needed):

```bash
npm install && npm install -g eas-cli
eas login
eas init                       # first time only
# Recommended: set your laptop IP in src/config/poseApi.js (fallbackHost)
eas build --platform android --profile preview
```

The finished build gives you a download link + QR code.

**Local build** (needs JDK 17 + Android SDK):

```bash
npx expo prebuild --platform android
cd android
gradlew assembleRelease        # .\gradlew on Windows, ./gradlew on macOS/Linux
```

The APK lands in `android/app/build/outputs/apk/release/app-release.apk`.

**Publishing a new release** so the download button stays current:

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

## 4. Using the Live Pose Corrector (needs the laptop server)

### How it actually works

The AI that recognizes your pose does **not** run on the phone. The app takes a
camera frame roughly every second and sends it over your **local Wi-Fi** to a
small Python server (FastAPI + TensorFlow/MoveNet) running on a laptop or PC.
The server sends back the detected pose and correction tips, which the app
shows on screen and speaks aloud.

```
Your phone (app)  ──camera frame──▶  Laptop on the SAME Wi-Fi (Python server, port 8000)
                  ◀──pose + tips──
```

Consequences of this design:

- Phone and laptop must be on the **same Wi-Fi network** (or the laptop
  connected to the phone's hotspot).
- **No internet is used or required** — traffic never leaves your network.
- If the server isn't running, the app shows an **"Analysis server
  unreachable"** banner in the Pose Corrector. Everything else keeps working.

### Setting up the server (one-time, on the laptop)

Python 3.11 recommended:

```bash
git clone https://github.com/atharvaawate22/yoga-therapy-app.git
cd yoga-therapy-app/backend
python -m venv .venv
.venv\Scripts\activate          # Windows   (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
```

### Every time you want to use the corrector

1. **Start the server** on the laptop (from the `backend/` folder):
   ```bash
   uvicorn yoga_pose_engine:app --host 0.0.0.0 --port 8000
   ```
   Check it's alive: open `http://localhost:8000/health` in the laptop browser.

2. **Find the laptop's Wi-Fi IP address:**
   - Windows: run `ipconfig` → "Wireless LAN adapter Wi-Fi" → *IPv4 Address*
     (e.g. `192.168.1.7`)
   - macOS/Linux: `ifconfig` or `ip addr`

3. **Make sure the app points at that IP** — see section 5. If the APK was
   built with the right IP you don't need to do anything.

4. **Allow the port through the firewall** (Windows usually prompts the first
   time you run uvicorn — click *Allow*). If you missed it:
   Windows Security → Firewall → Allow an app, or allow inbound TCP port 8000.

5. In the app, open **Live Mobile Pose Corrector** from the Home screen and tap
   **Test Backend Connection** at the bottom. If it says *Backend OK*, you're
   set — step onto your mat.

### Troubleshooting

| Symptom | Fix |
|---|---|
| "Analysis server unreachable" banner | Server not started, wrong IP baked into the APK, or different Wi-Fi networks. Work through steps 1–4 above, then tap **Retry Connection**. |
| *Backend OK* but detection feels slow | Normal on Wi-Fi (~1 analysis/sec). Move the laptop closer to the router; make sure the laptop isn't on a VPN. |
| Works on home Wi-Fi, not elsewhere | The server IP changes per network. Easiest fix: use your **phone's hotspot**, connect the laptop to it, and build the APK with that hotspot IP — it then stays stable anywhere. |
| Pose never recognized | Stand back so your **full body** is in frame, good lighting, camera roughly waist height. |
| No voice feedback | Check the 🔊 toggle in the corrector, the global **Settings → Voice guidance** switch, and media volume. |

---

## 5. The server IP address — the one thing to get right

The app decides where to send camera frames like this
(in [`src/config/poseApi.js`](src/config/poseApi.js)):

- **Running via Expo Go / dev mode:** the server address is detected
  automatically from the development machine — you don't configure anything.
- **Installed as an APK:** there is no dev machine to detect, so the app uses
  the hardcoded fallback:

```js
// src/config/poseApi.js
const fallbackHost = '192.168.1.7';   // ← change this to YOUR laptop's Wi-Fi IP
```

**Before building an APK**, set `fallbackHost` to the laptop's IP on the Wi-Fi
network where you'll practice (or to your phone-hotspot IP for a
network-independent setup). If the laptop's IP changes later (routers reassign
IPs), either make the IP static in your router settings, use the hotspot trick
from the troubleshooting table, or rebuild the APK.

---

## 6. Updating and uninstalling

- **Update:** install a newer APK over the old one (same package id) — your
  profile, history, favorites and custom sets are kept.
- **Uninstall:** removes all data. Practice history lives only on the phone —
  there is no cloud backup. You can also wipe just the history from
  **Settings → Clear practice history** inside the app.

## Privacy

Everything stays on your device (profile, history, favorites — stored locally).
Camera frames from the Pose Corrector go only to *your own* server on *your own*
network and are not stored. The app makes no other network requests.
