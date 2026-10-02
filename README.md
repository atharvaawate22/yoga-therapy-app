# Yoga Therapy App

A React Native mobile application built with Expo that helps users find recommended yoga poses for various physical and mental health problems. It includes an AI-powered live pose corrector backed by a Python (FastAPI + MoveNet) service on AWS Lambda.

For a deep dive into the architecture, algorithms, and data flow, see [PROJECT_WORKFLOW.md](PROJECT_WORKFLOW.md).

## 📥 Download & Install (APK)

This app is **not on the Play Store** — it installs directly as an Android APK.
Checking this out on your phone? Tap the button below. On a laptop? Scan the
QR code with your phone's camera.

<p>
  <a href="https://github.com/atharvaawate22/yoga-therapy-app/releases/latest/download/yoga-therapy.apk">
    <img src="https://img.shields.io/badge/⬇%20Download%20APK-Android-2E7D32?style=for-the-badge&logo=android&logoColor=white" alt="Download APK" />
  </a>
</p>

<p>
  <img src="assets/readme/download-qr.png" alt="Scan to download the APK" width="180" />
</p>

**[⬇ Direct download — yoga-therapy.apk](https://github.com/atharvaawate22/yoga-therapy-app/releases/latest/download/yoga-therapy.apk)**
— automatically rebuilt and republished on every push to `main`, so this
always points to the current build (all versions on the
[Releases page](https://github.com/atharvaawate22/yoga-therapy-app/releases)).

**Install & use:** see the **[USER_GUIDE.md](USER_GUIDE.md)** for install
steps and a feature walkthrough.

> **Key point for APK users:** every feature (guided practice, timers, history,
> streaks, custom sets, reminders…) works standalone with no server and no
> internet. The camera-based **Live Pose Corrector** talks to a hosted AWS
> backend over the internet (no laptop or local network needed) — it just
> needs your phone to be online. Details in the [user guide](USER_GUIDE.md).

## Features

- 🩺 Browse 11 health conditions with recommended, experience-filtered poses
- 🧘 Timed guided practice with voice cues, prep countdowns and pause/skip
- ☀️ Surya Namaskar mode — 12-step guided rounds with breathing cues
- 📊 Practice history: day streaks, weekly minutes, 7-day activity chart
- 📋 Custom routines — build, edit, reorder and play your own pose sets
- ❤️ Favorite poses, surfaced on the Home screen
- 🔔 Daily practice reminder notifications (local, no account needed)
- 📷 AI Live Pose Corrector with spoken corrections (backend-powered)
- ⚙️ Bottom-tab navigation (Home / Progress / Settings) with a wellness-themed UI

## Engineering Highlights

**Pose recognition pipeline.** Camera frame → MoveNet Thunder keypoints → body-visibility
check → normalized keypoint vector → MLP classifier → confidence cutoff →
multi-frame vote → rule-based corrections that are spoken aloud. The correction
rules measure in torso lengths, so feedback doesn't depend on photo resolution
or camera distance. A rule only runs on joints the model detected confidently.

**Data quality work on the classifier** ([details](backend/README.md#data-cleaning)):
- Found a *train/serve mismatch*: the model was trained on center-cropped
  images while the server padded them, and training skipped the server's EXIF
  rotation. Both now go through one shared preprocessing function.
- Found 200 training images labelled **both** cobra and upward dog (the same
  file filed in two folders), and **35% of the test set** (1,143 of 3,425
  images) duplicated from training. Extraction now drops label conflicts and
  duplicates, and evaluation excludes train copies.
- Added grouped k-fold cross-validation so every class gets an honest score,
  chose training options by multi-seed ablation (mirror augmentation helped;
  joint-angle features and class weighting didn't), and merged or dropped
  classes the data couldn't support.
- Built an **independent test set** of 238 freely licensed Wikimedia Commons
  photos: hand-reviewed, with attribution, and checked against training data
  with a perceptual hash (it caught 12 resized copies an exact-match check
  would miss).
- Swapped MoveNet Lightning for the more accurate **Thunder** keypoint model
  after it won on all three measurements.
- Result: macro F1 **0.746 → 0.828** on the leak-free test set; butterfly
  **0.354 → 0.779**, seated twist **0.596 → 0.752**; **80% accuracy** on the
  independent photos. Remaining weak classes are documented with their data
  counts, and there's a [recording guide](docs/RECORDING_GUIDE.md) plus a
  script that turns friends' phone videos into training data, holding out
  whole people as the test set.

**Serverless serving.** The API runs as a container on AWS Lambda behind API
Gateway, with no TensorFlow at runtime: MoveNet runs on LiteRT, and the
classifier runs in NumPy straight from the Keras file (verified equal to Keras
within 3×10⁻⁷). Models load in under a second, down from timing out the
30 s gateway.
The app pre-warms the server when the corrector opens.

**Delivery.** 227 backend tests and 33 app tests (including an app↔model
contract test) run in CI. Each backend deploy builds the image and smoke-tests
the real models inside it before pushing. The public API is rate-limited.
Every app change builds an APK with EAS and publishes it to the download link
above.

## Tech Stack

**Mobile app**
- React Native with Expo
- React Navigation (Native Stack)
- Expo Camera, Image Picker, Speech
- Functional Components with React Hooks

**Pose-analysis backend**
- FastAPI + Uvicorn, hosted on AWS Lambda (container image) behind API Gateway
- MoveNet SinglePose Lightning keypoints, run on LiteRT (the standalone TFLite runtime)
- A small MLP pose classifier, trained with TensorFlow/Keras and served with plain NumPy
- OpenCV, Pillow, NumPy

## Project Structure

The React Native app lives at the repository root; the Python pose-analysis
service is self-contained under `backend/`.

```
├── App.js                          # App entry point
├── app.config.js                   # Expo configuration (single source)
├── eas.json                        # EAS build profiles (APK output)
├── package.json                    # JS dependencies
├── assets/poses/                   # Local pose reference images (see assets/README.md)
├── src/
│   ├── components/                 # PoseCard, PoseImage, ProblemCard, RoundSelector,
│   │                               # ExperienceBadge, WeeklyStreakStrip
│   ├── screens/                    # Home, Pose, PoseDetail, PoseCorrector, HealthScan,
│   │                               # SuryaNamaskar, CustomSet, ProfileSetup,
│   │                               # PracticeSession, History, Settings
│   ├── data/                       # yogaData, poseImages, suryaNamaskarData, proTips,
│   │                               # userStorage, sessionStorage
│   ├── config/poseApi.js           # Backend API base URL and endpoints
│   ├── navigation/                 # Bottom tabs + native stack
│   ├── theme/                      # Centralized design system
│   └── utils/                      # reminders, uploadImage
│
└── backend/                        # Python pose-analysis service (independent of the app)
    ├── yoga_pose_engine.py         # FastAPI server (pose detection + corrections)
    ├── train_movenet_classifier.py # Training script for the pose classifier
    ├── eval_pose_metrics.py        # Evaluation metrics for the classifier
    ├── requirements.txt            # Training/eval dependencies (full TensorFlow)
    ├── requirements-space.txt      # Serving dependencies (no TensorFlow)
    ├── Dockerfile.lambda           # AWS Lambda image (deployed by CI)
    └── models/                     # MoveNet TFLite model, trained classifier, labels
```

> **Note:** The training image datasets (`backend/yoga_poses/`, `backend/dataset/`)
> are not included in this repository due to their size. The trained models in
> `backend/models/` are included, so the app and backend work without the raw
> dataset. To retrain, place class-labeled image folders under
> `backend/yoga_poses/train` and `backend/yoga_poses/test` and run
> `python train_movenet_classifier.py` from inside `backend/`.

## Getting Started

### Prerequisites

- Node.js 20 or later (Expo SDK 54)
- npm
- Expo CLI via `npx expo` (no global install needed)

### Installation

1. Clone the repository and navigate into it:
   ```bash
   git clone https://github.com/atharvaawate22/yoga-therapy-app.git
   cd yoga-therapy-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Expo development server:
   ```bash
   npx expo start
   ```

4. Run on your device:
   - Scan the QR code with Expo Go app (Android/iOS)
   - Press `a` for Android emulator
   - Press `i` for iOS simulator
   - Press `w` for web browser

### Building a Real Installable App (no Expo Go needed)

To get a standalone APK a recruiter/tester can install directly on an
Android phone, use [EAS Build](https://docs.expo.dev/build/introduction/)
(free tier, runs in Expo's cloud):

```bash
npm install -g eas-cli
eas login              # free Expo account
eas build --platform android --profile preview
```

This uses the `preview` profile in `eas.json`, which builds a downloadable
`.apk` file (not an `.aab`, so no Play Store needed) — EAS prints a link to
the finished APK when the build completes (a few minutes).

#### Automated builds via GitHub Actions

`.github/workflows/eas-build.yml` builds a fresh APK automatically on every
push to `main` that can change the app (pushes touching only `backend/`, docs
or other workflows are skipped to save EAS build quota), and can also be run
on demand. One-time setup:

1. Create a free account at [expo.dev](https://expo.dev) if you don't have one.
2. Generate an access token: [expo.dev/accounts/\[account\]/settings/access-tokens](https://expo.dev/accounts/%5Baccount%5D/settings/access-tokens) → **Create token**.
3. In this GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**, name it `EXPO_TOKEN`, and paste the token.

After that, every push to `main` (or a manual run from the **Actions** tab →
**EAS Build (Android APK)** → **Run workflow**) builds the APK in Expo's
cloud, attaches it to the workflow run as a downloadable artifact
(`yoga-therapy-app-preview-apk`), and publishes it to the rolling
`latest-preview` GitHub Release that the download button above points to.

If the Live Pose Corrector can't reach the backend, it falls back to a
simulated result clearly labelled **DEMO**, so the feature still demonstrates
end to end. Demo results are never saved to history and never count as a
match for a target pose.

### The Pose-Analysis Backend

The installed APK uses the hosted backend (AWS Lambda behind API Gateway,
URL in `src/config/poseApi.js`); nothing needs to run locally. Pushes that
change `backend/` are tested by `.github/workflows/backend-tests.yml` and
deployed by `.github/workflows/deploy-lambda-backend.yml`, which smoke-tests
the built image with the real models before it goes live and applies API
Gateway rate limits.

**Running it locally** (for backend development). In an Expo dev build the
app automatically uses your dev machine's LAN IP on port 8000, so the phone
and computer must be on the same Wi-Fi. From `backend/`:

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt   # full TensorFlow, also needed for training
uvicorn yoga_pose_engine:app --host 0.0.0.0 --port 8000
```

Check it at `http://localhost:8000/health`. Tests need no TensorFlow:
`pip install -r requirements-dev.txt && pytest`. See
[backend/README.md](backend/README.md) for training and evaluation.

### Pose API

`POST /analyze-pose`

```json
{
  "image_base64": "<JPEG/PNG, optionally a data URL; max ~3 MB>",
  "session_id": "<stable per live session; enables the stability filter>",
  "source": "live | image",
  "experience_level": "beginner | intermediate | expert",
  "include_debug_image": false
}
```

Response:

```json
{
  "pose": "warrior_pose",
  "confidence": 0.92,
  "corrections": ["Keep both arms level — extend equally left and right"],
  "distances": {
    "warrior_arm_span": 210.5,
    "warrior_arm_height_offset": 12.3,
    "warrior_wrist_height_diff": 8.1
  },
  "debug_image_base64": null,
  "probabilities": { "warrior_pose": 0.92, "...": 0.01 }
}
```

`pose` is `"nopose"` when no full body is visible or the classifier isn't
confident. `distances` are in percent of the person's torso length. The
skeleton overlay is only returned when `include_debug_image` is true.

## Health Conditions Covered

- Back Pain
- Hip Alignment Issue
- Scapula Winging
- Knee Pain
- Poor Posture
- Headache
- Stress
- Anxiety
- Insomnia
- Digestion Issues
- Weight Loss

## Theme Colors

Defined in `src/theme/theme.js`:

| Color      | Hex Code  | Usage                    |
|------------|-----------|--------------------------|
| Primary    | #2E7D32   | Main actions, headers    |
| Secondary  | #81C784   | Badges, accents          |
| Background | #F5F9F4   | Screen backgrounds       |
| Card       | #FFFFFF   | Card backgrounds         |
| Text       | #1A2E1A   | Primary text             |

## Adding New Health Problems

1. Open `src/data/yogaData.js`.
2. Add an entry built with the `p(...)` helper:

```javascript
"New Problem": [
  p("tree_pose", "Tree Pose", "Vrksasana",
    "Short description of why this pose helps.",
    "30 sec each", "beginner",            // duration, difficulty
    ["Benefit one", "Benefit two"],
    ["Precaution one"],
    ["Step one", "Step two", "Step three"]),
],
```

The pose id must be in `ALLOWED_POSE_IDS` (same file) or it is filtered out.
Photos come from `src/data/poseImages.js`; a pose without a bundled photo
shows an icon placeholder. Add an icon for the new condition in
`src/components/ProblemCard.js` and, optionally, tips in `src/data/proTips.js`.

## Disclaimer

This app provides general yoga pose recommendations for educational purposes only. Always consult with a healthcare professional before starting any new exercise program, especially if you have existing health conditions.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
