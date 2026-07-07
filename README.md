# Yoga Therapy App

A React Native mobile application built with Expo that helps users find recommended yoga poses for various physical and mental health problems. It includes an AI-powered live pose corrector backed by a Python (FastAPI + TensorFlow/MoveNet) server.

For a deep dive into the architecture, algorithms, and data flow, see [PROJECT_WORKFLOW.md](PROJECT_WORKFLOW.md).

## Features

- 🧘 Browse health conditions and problems
- 📋 View recommended yoga poses for each condition
- ⏱️ See duration recommendations for each pose
- 🎨 Modern wellness-themed UI design
- 📱 Cross-platform (iOS, Android, Web)
- 📷 Mobile camera pose-corrector screen (backend-powered)

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

```
├── App.js                          # Main app entry point
├── app.json / app.config.js        # Expo configuration
├── package.json                    # JS dependencies
├── babel.config.js                 # Babel configuration
├── assets/                         # App icons and pose images
├── src/
│   ├── components/                # ProblemCard, PoseCard, RoundSelector, ExperienceBadge
│   ├── screens/                   # Home, Pose, PoseDetail, PoseCorrector, HealthScan,
│   │                              # SuryaNamaskar, CustomSet, ProfileSetup screens
│   ├── data/                      # yogaData, poseImages, suryaNamaskarData, proTips, userStorage
│   ├── config/
│   │   └── poseApi.js             # Backend API base URL and endpoints
│   ├── theme/                     # Centralized theme styles
│   ├── utils/                     # Image helpers
│   └── navigation/                # Navigation configuration
│
├── yoga_pose_engine.py             # FastAPI backend (pose detection + corrections)
├── train_movenet_classifier.py     # Training script for the pose classifier
├── eval_pose_metrics.py            # Evaluation metrics for the classifier
├── requirements.txt                # Python dependencies
└── models/                         # MoveNet TFLite model, trained classifier, labels
```

> **Note:** The training image datasets (`yoga_poses/`, `dataset/`) are not included
> in this repository due to their size. The trained models in `models/` are included,
> so the app and backend work without the raw dataset. To retrain, place class-labeled
> image folders under `yoga_poses/train` and `yoga_poses/test` and run
> `python train_movenet_classifier.py`.

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
reachable from your phone (same Wi-Fi network).

1. Create and activate a virtual environment (Python 3.11 recommended):
   ```bash
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

This app now includes a mobile screen that captures a camera frame and sends it to a Python backend for pose analysis.

1. Open the app and tap **Live Mobile Pose Corrector** on the home screen.
2. Update API base URL in `src/config/poseApi.js` to your server LAN IP.
3. Ensure your phone and backend machine are on the same Wi-Fi network.

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
- Headache
- Stress
- Anxiety
- Poor Posture
- Insomnia

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
