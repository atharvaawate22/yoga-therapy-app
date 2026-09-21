# Yoga Therapy App

A React Native mobile application built with Expo that helps users find recommended yoga poses for various physical and mental health problems. It includes an AI-powered live pose corrector backed by a Python (FastAPI + TensorFlow/MoveNet) server.

For a deep dive into the architecture, algorithms, and data flow, see [PROJECT_WORKFLOW.md](PROJECT_WORKFLOW.md).

## 📥 Download & Install (APK)

This app is **not on the Play Store** — it installs directly as an Android APK.

<p>
  <a href="https://github.com/atharvaawate22/yoga-therapy-app/releases/latest/download/yoga-therapy.apk">
    <img src="https://img.shields.io/badge/⬇%20Download%20APK-Android-2E7D32?style=for-the-badge&logo=android&logoColor=white" alt="Download APK" />
  </a>
</p>

**[⬇ Direct download — yoga-therapy.apk](https://github.com/atharvaawate22/yoga-therapy-app/releases/latest/download/yoga-therapy.apk)**
(always points to the newest release; all versions on the
[Releases page](https://github.com/atharvaawate22/yoga-therapy-app/releases))

**Install & use:** see the **[USER_GUIDE.md](USER_GUIDE.md)** — it covers
installing the APK, what works fully offline (almost everything), and how to
set up the **Live Pose Corrector**, which needs the Python server running on
a laptop on the **same Wi-Fi network** as your phone.

> **Key point for APK users:** every feature (guided practice, timers, history,
> streaks, custom sets, reminders…) works standalone with no server and no
> internet. Only the camera-based Pose Corrector talks to the laptop server
> over your local Wi-Fi — and the server's IP must be set in
> `src/config/poseApi.js` (`fallbackHost`) **before building the APK**.
> Details in the [user guide](USER_GUIDE.md).

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

## Tech Stack

**Mobile app**
- React Native with Expo
- React Navigation (Native Stack)
- Expo Camera, Image Picker, Speech
- Functional Components with React Hooks

**Pose-analysis backend**
- FastAPI + Uvicorn
- TensorFlow (MoveNet SinglePose Lightning, TFLite)
- OpenCV, NumPy

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
│   ├── components/                 # ProblemCard, PoseCard, RoundSelector, ExperienceBadge
│   ├── screens/                    # Home, Pose, PoseDetail, PoseCorrector, HealthScan,
│   │                               # SuryaNamaskar, CustomSet, ProfileSetup,
│   │                               # PracticeSession, History, Settings
│   ├── data/                       # yogaData, poseImages, suryaNamaskarData, proTips,
│   │                               # userStorage, sessionStorage
│   ├── config/poseApi.js           # Backend API base URL and endpoints
│   ├── navigation/                 # Bottom tabs + native stack
│   ├── theme/                      # Centralized design system
│   └── utils/                      # imageUtils, reminders
│
└── backend/                        # Python pose-analysis service (independent of the app)
    ├── yoga_pose_engine.py         # FastAPI server (pose detection + corrections)
    ├── train_movenet_classifier.py # Training script for the pose classifier
    ├── eval_pose_metrics.py        # Evaluation metrics for the classifier
    ├── requirements.txt            # Python dependencies
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

- Node.js (v16 or later recommended)
- npm or yarn
- Expo CLI

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

### Running the Pose-Analysis Backend

The live pose corrector requires the Python backend to be running on a machine
reachable from your phone (same Wi-Fi network). All backend commands run from
the `backend/` folder.

1. Create and activate a virtual environment (Python 3.11 recommended):
   ```bash
   cd backend
   python -m venv .venv
   # Windows
   .venv\Scripts\activate
   # macOS/Linux
   source .venv/bin/activate
   ```

2. Install the Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Start the FastAPI server:
   ```bash
   uvicorn yoga_pose_engine:app --host 0.0.0.0 --port 8000
   ```

4. Verify it is up by opening `http://localhost:8000/health` in a browser.

## Mobile Pose Corrector Integration

This app includes a mobile screen that captures a camera frame and sends it to a Python backend for pose analysis.

1. Open the app and tap **Live Mobile Pose Corrector** on the home screen.
2. Ensure your phone and backend machine are on the same Wi-Fi network.
3. **In development (Expo Go):** the server address is auto-detected from your
   dev machine — no configuration needed.
   **In an installed APK:** the app uses the `fallbackHost` IP hardcoded in
   `src/config/poseApi.js`, so set it to your laptop's LAN IP *before building*.
   See [USER_GUIDE.md](USER_GUIDE.md) for the full setup and troubleshooting guide.

### Expected Backend Endpoint

- URL: `POST /analyze-pose`
- Request JSON:

```json
{
   "image_base64": "..."
}
```

- Response JSON:

```json
{
   "pose": "warrior",
   "confidence": 0.92,
   "corrections": ["Arm too high/low", "Knee not over ankle"],
   "distances": {
      "warrior_arm_lateral": 0.31,
      "warrior_arm_vertical": 0.24,
      "warrior_arm_depth": 0.14
   }
}
```

Your existing laptop Python script should run as a service endpoint that accepts base64 images and returns this payload.

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

| Color      | Hex Code  | Usage                    |
|------------|-----------|--------------------------|
| Primary    | #4CAF50   | Main actions, headers    |
| Secondary  | #81C784   | Badges, accents          |
| Background | #F1F8E9   | Screen backgrounds       |
| Card       | #FFFFFF   | Card backgrounds         |
| Text       | #333333   | Primary text             |

## Adding New Health Problems

To add new health conditions:

1. Open `src/data/yogaData.js`
2. Add a new entry with the problem name and array of poses:

```javascript
"New Problem": [
  {
    name: "Pose Name",
    description: "Description of the pose",
    duration: "Duration",
    image: "image_url"
  }
]
```

## Disclaimer

This app provides general yoga pose recommendations for educational purposes only. Always consult with a healthcare professional before starting any new exercise program, especially if you have existing health conditions.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
