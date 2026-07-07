# Yoga Therapy App - Technology, Algorithms, and Workflow

## Overview
This project is a mobile yoga therapy app with a Python backend for pose analysis. The mobile app is built with React Native (Expo). The backend uses MoveNet (TFLite) for keypoints and a small neural classifier for pose labels.

## Technology Stack

### Mobile App
- React Native (Expo)
- React Navigation (Native Stack)
- Expo Camera
- Expo Image Picker
- Expo Speech
- AsyncStorage

### Backend
- FastAPI
- Uvicorn
- TensorFlow (TFLite Interpreter)
- OpenCV
- NumPy
- Pydantic

### Data and Models
- MoveNet SinglePose Lightning (TFLite)
- Pose classifier model (Keras)
- Pose labels stored as JSON

## Core Algorithms

### 1) MoveNet Keypoint Extraction
- Input image is center-cropped and resized to the MoveNet input size.
- MoveNet returns 17 keypoints with (y, x, score).
- Keypoints are converted to pixel coordinates for further processing.

### 2) Keypoint Normalization
- Hip midpoint is used as the origin.
- Torso length is used to scale keypoints.
- Normalized 2D keypoints are flattened into a 34-value vector.

### 3) Pose Classification
- A lightweight MLP classifier predicts pose probabilities.
- If top probability is below the threshold, result is treated as "nopose".
- Optional stability filtering is applied for live mode (majority vote across recent frames).

### 4) Corrections and Feedback
- Rule-based corrections are generated using keypoint relationships.
- Experience level adjusts the strictness of correction rules.

## Project Workflow

### A) Training Pipeline
1. Images are stored in class folders (dataset/ or yoga_poses/train).
2. For each image:
   - Detect keypoints with MoveNet.
   - Skip samples with low visibility.
   - Normalize keypoints into a 34-value feature.
3. Train a dense neural network classifier.
4. Save model and labels to models/.

### B) Backend Inference (FastAPI)
1. Mobile app sends a base64 image to POST /analyze-pose.
2. Backend decodes, crops, and runs MoveNet.
3. Keypoints are normalized and passed to the classifier.
4. Best pose is selected; corrections are generated.
5. Response returns pose, confidence, corrections, and optional debug image.

### C) Mobile App Flow
1. User selects a health condition.
2. App displays recommended poses with descriptions.
3. Optional live pose corrector uses the backend.
4. Pose results and corrections are shown in the UI.

## Key Files

### Mobile
- App entry: App.js
- Navigation: src/navigation/AppNavigator.js
- Pose data: src/data/yogaData.js
- Pose images: src/data/poseImages.js
- Surya Namaskar flow: src/data/suryaNamaskarData.js

### Backend
- API server: yoga_pose_engine.py
- Training script: train_movenet_classifier.py
- Models: models/movenet_lightning.tflite, models/pose_classifier.keras
- Labels: models/pose_labels.json

## API Endpoints
- GET /health
- POST /analyze-pose

## End-to-End Data Flow
1. Camera or image capture in the app.
2. Image is sent to backend API.
3. MoveNet extracts keypoints.
4. Classifier predicts pose label.
5. App displays the result and corrections.
