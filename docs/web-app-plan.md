# Web app (PWA) plan

Status: **M0 in progress** (decisions below, 2026-10-08). Written 2026-10-08 against `main` @ `afebfc9`.
Part 1 is the audit (every claim cites a file). Part 2 is the plan. Open questions are at the end.

---

# Part 1 — Audit

## 1. Repo structure

Not a monorepo. The Expo app **is** the repo root; the Python service is a self-contained folder.

| Path | What it is |
|---|---|
| `App.js`, `index.js`, `app.config.js`, `babel.config.js`, `eas.json`, `package.json` | Expo app entry and config ([index.js](../index.js), [app.config.js](../app.config.js)) |
| `src/screens/` (11 screens), `src/components/`, `src/navigation/`, `src/theme/` | RN UI |
| `src/data/` | Static content (`yogaData.js`, `suryaNamaskarData.js`, `poseNames.js`, `proTips.js`) and AsyncStorage helpers (`userStorage.js`, `sessionStorage.js`) |
| `src/config/poseApi.js` | Backend URL resolution ([poseApi.js:19-29](../src/config/poseApi.js)) |
| `src/utils/` | `reminders.js` (local notifications), `uploadImage.js` (resize before upload) |
| `assets/` | Icons, splash, 9 pose PNGs (7.6 MB total, ~0.7–1 MB each) |
| `backend/` | FastAPI service, training/eval scripts, `utils/` shared by server/trainer/evaluator, `models/`, `tests/`, two Dockerfiles, `k8s/` |
| `.github/workflows/` | 5 workflows (app tests, backend tests, Lambda deploy, EAS build, APK republish) |
| `docs/RECORDING_GUIDE.md`, `PROJECT_WORKFLOW.md`, `USER_GUIDE.md` | Docs |

There is no `packages/` folder and no npm workspaces ([package.json](../package.json)).

## 2. Expo setup

- **SDK 54** (`"expo": "~54.0.0"`, installed 54.0.33), RN 0.81.5, React 19.1 ([package.json:18,29-31](../package.json)).
- **Managed workflow** (CNG): `android/` and `ios/` are gitignored as prebuild output ([.gitignore:29-30](../.gitignore)); `newArchEnabled: false` ([app.config.js:29](../app.config.js)).
- **react-native-web 0.21 and react-dom are installed** ([package.json:30,36](../package.json)). Web config is minimal: `web: { bundler: 'metro', favicon }` ([app.config.js:46-49](../app.config.js)). No manifest, no service worker, no PWA settings.
- **`npx expo export --platform web` works.** I ran it into a temp folder (removed afterwards): it builds one 1.82 MB JS bundle plus assets (14 MB total, mostly pose PNGs and all 19 vector-icon fonts). Served locally, onboarding and Home render correctly.
- **What breaks at runtime on web** (tested in a browser, plus source reading):
  - `Alert.alert` is a **no-op** in react-native-web (`class Alert { static alert() {} }` in `node_modules/react-native-web/dist/exports/Alert/index.js`). The app has **16 call sites**, including confirm dialogs whose destructive action only runs from the dialog callback, e.g. "Clear Practice History?" ([SettingsScreen.js:51-60](../src/screens/SettingsScreen.js)), "End Session?" ([PracticeSessionScreen.js:139](../src/screens/PracticeSessionScreen.js)), "Delete Set" ([CustomSetScreen.js:86](../src/screens/CustomSetScreen.js)). On web those buttons silently do nothing.
  - `expo-notifications` logs "Listening to push token changes is not yet fully supported on web"; scheduled daily reminders have no web implementation.
  - The Pose Corrector screen asks for the camera and shows its permission UI; the web build calls the **hosted Lambda** `/warmup` (verified in the network log), because `Constants.expoConfig.hostUri` is empty in an export ([poseApi.js:21-29](../src/config/poseApi.js)). I could not test capture itself (the in-app browser blocks camera access).
  - Document title shows `undefined` on Home (cosmetic).

## 3. Pose pipeline (the important part)

**MoveNet runs on the server, not on the device.** The app has no ML dependency at all ([package.json dependencies](../package.json)). Every step from decoding to corrections is Python.

### 3.1 End-to-end trace

| # | Step | Where | Evidence |
|---|---|---|---|
| 1 | Live loop: capture a **still photo** with `takePictureAsync({quality: 0.8})` | JS | [PoseCorrectorScreen.js:235-245](../src/screens/PoseCorrectorScreen.js) |
| 2 | Resize longest side to **960 px**, JPEG `compress: 0.7`, base64 | JS | [uploadImage.js:11,22](../src/utils/uploadImage.js) |
| 3 | `POST /analyze-pose` JSON `{image_base64, session_id, source:'live', experience_level}` | JS | [PoseCorrectorScreen.js:160-170](../src/screens/PoseCorrectorScreen.js) |
| 4 | Next frame scheduled **850 ms after the previous response** (so < 1 fps; the UI says "about once a second") | JS | [PoseCorrectorScreen.js:310,578-580](../src/screens/PoseCorrectorScreen.js) |
| 5 | base64 → PIL decode, **EXIF transpose**, downscale to ≤ 1280 px | Py | [yoga_pose_engine.py:278-289](../backend/yoga_pose_engine.py), [preprocessing.py:89-113](../backend/utils/preprocessing.py) |
| 6 | **Pad** (not crop) to a centred square, fill colour (114,114,114) | Py | [preprocessing.py:116-138](../backend/utils/preprocessing.py) |
| 7 | Resize to model input with `cv2.INTER_AREA`, cast to the model dtype, run LiteRT | Py | [movenet.py:80-98](../backend/utils/movenet.py) |
| 8 | Output `[17,3]` as `(y, x, score)` in [0,1] → pixel `[x, y, score]` of the padded square | Py | [preprocessing.py:154-164](../backend/utils/preprocessing.py) |
| 9 | Body-presence gate: 4 core points ≥ 0.20 and ≥ 7 of 9 major points ≥ 0.15 | Py | [preprocessing.py:80-84,217-230](../backend/utils/preprocessing.py) |
| 10 | 34-value feature vector | Py | [preprocessing.py:167-193](../backend/utils/preprocessing.py) |
| 11 | MLP → softmax over 24 labels (NumPy, no TF) | Py | [yoga_pose_engine.py:183-187](../backend/yoga_pose_engine.py), [model.py:191-255](../backend/utils/model.py) |
| 12 | Confidence gate: 0.70 for images, **0.60 for live** | Py | [yoga_pose_engine.py:66,72,800-804](../backend/yoga_pose_engine.py) |
| 13 | **5-frame majority vote** (≥ 3 of last 5), per `session_id`, held **in server memory** | Py | [yoga_pose_engine.py:75-79,137,652-666](../backend/yoga_pose_engine.py) |
| 14 | Rule-based corrections (per pose, per experience level) | Py | [yoga_pose_engine.py:397-649](../backend/yoga_pose_engine.py) |
| 15 | Warrior-only "distances" | Py | [yoga_pose_engine.py:329-345](../backend/yoga_pose_engine.py) |
| 16 | Speak `corrections[0]` with `expo-speech` (`en-IN`, rate 0.9) when it changes | JS | [PoseCorrectorScreen.js:135-150](../src/screens/PoseCorrectorScreen.js) |
| 17 | If the server is unreachable: show **simulated DEMO results** | JS | [PoseCorrectorScreen.js:209-219,254](../src/screens/PoseCorrectorScreen.js), [demoPoseData.js](../src/data/demoPoseData.js) |

**Latency:** not measured anywhere in the app. The server logs `latency_ms` per request ([yoga_pose_engine.py:811-820](../backend/yoga_pose_engine.py)). The backend README says Thunder is ~27 ms per frame on a local CPU ([backend/README.md](../backend/README.md), "Why Thunder"). End-to-end time (photo capture + resize + upload + Lambda + response) is unknown. During this audit `/health` answered in 1.5 s and the Render fallback took 22 s (cold).

### 3.2 Pure-math logic that can be ported to TypeScript

All of this is NumPy-only and has no platform dependency:

| Function | Lines | Notes |
|---|---|---|
| `extract_keypoints_pixels` (y,x → x,y swap) | [preprocessing.py:154-164](../backend/utils/preprocessing.py) | trivial |
| `normalize_keypoints` (34-vector) | [preprocessing.py:167-193](../backend/utils/preprocessing.py) | needs a degenerate-case fallback |
| `has_body` + thresholds | [preprocessing.py:80-84,217-230](../backend/utils/preprocessing.py) | trivial |
| `mirror_features` | [preprocessing.py:197-214](../backend/utils/preprocessing.py) | only used for training augmentation; useful for tests |
| `NumpyClassifier.predict` (Dense + ReLU + softmax) | [model.py:204-255](../backend/utils/model.py) | ~10 lines of TS |
| Confidence gate + `_apply_stability` | [yoga_pose_engine.py:797-806,652-666](../backend/yoga_pose_engine.py) | the vote becomes client state |
| `_to_torso_units`, `_joint_angle`, `_generate_corrections` | [yoga_pose_engine.py:365-649](../backend/yoga_pose_engine.py) | ~250 lines of branching rules, all strings included |
| `_distance_metrics` | [yoga_pose_engine.py:329-345](../backend/yoga_pose_engine.py) | warrior only; app ignores `distances` except storing them |
| `feedback_pose_alias`, `NO_POSE`/`UNKNOWN` | [label_utils.py:296-297,435-445](../backend/utils/label_utils.py) | tiny |

Not portable (image I/O): `decode_image` (PIL/EXIF), `pad_to_square` (cv2), `MoveNetRuntime` (LiteRT). These get browser equivalents.

Note: **there are no "reference angles"** in the codebase. Corrections are threshold checks on coordinates in torso units; `_joint_angle` is used once, to find Warrior II's front leg ([yoga_pose_engine.py:608-616](../backend/yoga_pose_engine.py)).

### 3.3 Exact keypoint contract (what a browser MoveNet must reproduce)

- **Model:** MoveNet SinglePose **Thunder v3** TFLite by default (`MOVENET_VARIANT`, default `thunder`, [paths.py:24-39](../backend/utils/paths.py)). Lightning v3 is vendored too.
- **Input:** `[1, 256, 256, 3]` **float32**, RGB, values **0–255 unnormalised** (uint8 pixels cast to float, [movenet.py:91-92](../backend/utils/movenet.py)). Lightning is `[1,192,192,3]` float32. (I read these from the interpreter's input details.)
- **Pre-processing:** EXIF-upright → longest side ≤ 1280 → **pad to square, centred, fill 114** → `INTER_AREA` resize. Aspect ratio is preserved; the image is never stretched or cropped.
- **Output:** `[1,1,17,3]`, each row `(y, x, score)`, y and x in [0,1] of the padded square.
- **Order (COCO-17):** 0 nose, 1 left_eye, 2 right_eye, 3 left_ear, 4 right_ear, 5 left_shoulder, 6 right_shoulder, 7 left_elbow, 8 right_elbow, 9 left_wrist, 10 right_wrist, 11 left_hip, 12 right_hip, 13 left_knee, 14 right_knee, 15 left_ankle, 16 right_ankle ([preprocessing.py:39-57](../backend/utils/preprocessing.py)).
- **Coordinate system:** image space, origin top-left, **y grows downward** (the rules rely on this, e.g. "hips higher" is `hip_y >= shoulder_y`, [yoga_pose_engine.py:459](../backend/yoga_pose_engine.py)).
- **Feature vector:** for each keypoint `(x − hip_mid) / torso`, where `hip_mid` is the hip midpoint and `torso = max(|L_sh − R_sh|, |L_hip − R_hip|)` (shoulder width or hip width, **not** torso length). If torso < 1e-6, use the max side of the keypoint bounding box (min 1.0). Flattened as `[x0, y0, x1, y1, …]`, float32 ([preprocessing.py:167-193](../backend/utils/preprocessing.py)).
- **Correction units:** a *different* scale: 100 = torso **length** (shoulder midpoint to hip midpoint); fallback is bbox max side / 3 ([yoga_pose_engine.py:365-383](../backend/yoga_pose_engine.py)).
- Because both scales are translation- and scale-invariant, the browser can work in normalised [0,1] square coordinates. It must keep x and y on the **same scale** (square input).

## 4. Model assets

| File | Format | Size | Notes |
|---|---|---|---|
| `movenet_thunder.tflite` | TFLite, float32 I/O | 25.0 MB | served model |
| `movenet_lightning.tflite` | TFLite, float32 I/O | 9.4 MB | vendored, not served |
| `pose_classifier.keras` | Keras 3.15.1 zip (`config.json` + `model.weights.h5`) | 91 KB | Dense 34→64→32→24, ReLU, Dropout 0.2 (inference no-op), softmax: **5,112 parameters** |
| `pose_labels.json` | JSON list | 459 B | 24 labels, index = softmax position ([pose_labels.json](../backend/models/pose_labels.json)) |
| `feature_cache_{lightning,thunder}.npz` | NumPy | ~0.9 MB each | local only, gitignored ([.gitignore:22](../.gitignore)) |

**Can the MLP run in the browser?** Yes, and it doesn't need TF.js or ONNX. `NumpyClassifier` already proves the model is three matmuls ([model.py:191-255](../backend/utils/model.py)). Plan: a Python script exports `{labels, layers:[{kernel, bias, activation}], sha256}` as JSON (~5k floats, ~60 KB, smaller as base64 float32). TS runs it in a few lines. **Effort:** half a day including the parity test. **Accuracy risk:** essentially none; float32 matmul order differences are ~1e-7 (the README already reports NumPy vs Keras within 3×10⁻⁷).

**MoveNet in the browser** is the real risk; see Plan §B.

## 5. Native-only dependencies and web equivalents

| Library (usage) | Works on web today? | Web equivalent |
|---|---|---|
| `expo-camera` `CameraView` + `takePictureAsync` ([PoseCorrectorScreen.js:7,235](../src/screens/PoseCorrectorScreen.js)) | Partially (getUserMedia under the hood), but capturing stills is the wrong model for 10+ fps | `getUserMedia` → `<video>` → `requestVideoFrameCallback`/`createImageBitmap` |
| `expo-image-picker` (gallery upload) | Yes | `<input type="file" accept="image/*">` + `createImageBitmap(file, {imageOrientation:'from-image'})` (handles EXIF) |
| `expo-image-manipulator` ([uploadImage.js](../src/utils/uploadImage.js)) | Yes | Canvas / `OffscreenCanvas`; not needed for in-browser inference |
| `expo-speech` (corrector + guided practice, [PracticeSessionScreen.js:15,52](../src/screens/PracticeSessionScreen.js)) | Yes (wraps Web Speech) | `speechSynthesis`; iOS needs a user gesture before the first utterance; `en-IN` voice availability varies |
| `expo-keep-awake` (corrector + practice) | Yes (Wake Lock) | `navigator.wakeLock.request('screen')`, re-acquire on `visibilitychange` |
| `expo-notifications` daily local reminder ([reminders.js](../src/utils/reminders.js), [App.js:4-16](../App.js)) | **No** | No web API schedules a local notification while the page is closed (Notification Triggers was abandoned). Web Push needs a server, VAPID keys and, on iOS, an installed PWA. Offer an `.ics` calendar event instead (see §E) |
| `@react-native-async-storage/async-storage` | Yes (localStorage) | `localStorage` behind the same async API, or IndexedDB (`idb-keyval`) |
| `expo-linear-gradient` | Yes | CSS gradients |
| `@expo/vector-icons` | Yes | SVG icon set (Ionicons SVGs or lucide-react) |
| `Alert.alert` (16 sites) | **No-op** | Accessible modal dialog component |
| `Linking.openSettings` ([PoseCorrectorScreen.js:431](../src/screens/PoseCorrectorScreen.js)) | No | Per-browser instructions to re-enable camera permission |
| `expo-constants` `hostUri` ([poseApi.js:21](../src/config/poseApi.js)) | n/a | `NEXT_PUBLIC_*` build-time env |
| `expo-haptics`, `react-native-svg` | n/a | **Unused**: listed in [package.json:21,35](../package.json) but never imported in `src/` or `App.js` |

## 6. Data and state

All state is in AsyncStorage on the device:

| Key | Contents | File |
|---|---|---|
| `@yoga_user_profile` | `{name, age, experience}` | [userStorage.js:8,35-45](../src/data/userStorage.js) |
| `@yoga_onboarded` | `'true'` | [userStorage.js:10](../src/data/userStorage.js) |
| `@yoga_custom_sets` | `[{id, name, poseIds, createdAt}]` | [userStorage.js:9,55-110](../src/data/userStorage.js) |
| `@yoga_favorite_poses` | pose id list | [userStorage.js:11,113-127](../src/data/userStorage.js) |
| `@yoga_voice_enabled` | `'true'/'false'` | [userStorage.js:12,130-139](../src/data/userStorage.js) |
| `@yoga_practice_sessions` | ≤ 300 session records; streaks and weekly stats are **derived** on read | [sessionStorage.js:18-19,66-119](../src/data/sessionStorage.js) |
| `@yoga_daily_reminder` | `{key}` | [reminders.js:11](../src/utils/reminders.js) |

**Confirmed: no accounts, no auth, no server-side database.** The backend keeps only the in-memory vote history ([yoga_pose_engine.py:137](../backend/yoga_pose_engine.py)).

**Every network call** (grep for `fetch`, `axios`, `XMLHttpRequest`, `WebSocket`, URLs in `src/` and `App.js`):
1. `GET /warmup`, when the corrector opens, 2 attempts, 45 s timeout ([PoseCorrectorScreen.js:84-100](../src/screens/PoseCorrectorScreen.js))
2. `POST /analyze-pose`, live loop and image mode, one retry on 502/503/504, 60 s timeout ([PoseCorrectorScreen.js:102-107,166-171](../src/screens/PoseCorrectorScreen.js), [poseApi.js:44](../src/config/poseApi.js))
3. `GET /health`, from the "Test Backend Connection" button ([PoseCorrectorScreen.js:388-402](../src/screens/PoseCorrectorScreen.js))

Pose images are bundled; the old remote Unsplash URLs were removed ([poseImages.js:1-8](../src/data/poseImages.js)). Nothing else touches the network.

## 7. Backend

- **Endpoints:** `GET /warmup` (loads both models), `GET /health` (cheap; no model load), `POST /analyze-pose` ([yoga_pose_engine.py:691-829](../backend/yoga_pose_engine.py)).
- **Request schema** `PoseAnalyzeRequest`: `image_base64` (≤ 4,000,000 chars, data-URL prefix allowed), `session_id?`, `source` (`image`|`live`), `experience_level` (unknown values fall back to beginner), `include_debug_image` (default false) ([yoga_pose_engine.py:89-114,735-742](../backend/yoga_pose_engine.py)).
- **Response** `PoseAnalyzeResponse`: `pose`, `confidence`, `corrections[]`, `distances{}`, `debug_image_base64?`, `probabilities{}` ([yoga_pose_engine.py:117-123](../backend/yoga_pose_engine.py)).
- **CORS:** `allow_origins=["*"]`, no credentials ([yoga_pose_engine.py:127-135](../backend/yoga_pose_engine.py)). Verified live: preflight from a foreign origin returns `access-control-allow-origin: *`.
- **Auth:** none. Abuse is bounded only by API Gateway throttling, 10 req/s with burst 20, **shared by all users** ([deploy-lambda-backend.yml:18-21,104-114](../.github/workflows/deploy-lambda-backend.yml)).
- **Deployment, as configured:** **AWS Lambda container** (`Dockerfile.lambda` + Mangum, [lambda_handler.py](../backend/lambda_handler.py)) behind API Gateway `vb57jykmzc` in us-east-1, 2 GB, 30 s timeout. CI deploys on backend changes after a smoke test of the real models ([deploy-lambda-backend.yml](../.github/workflows/deploy-lambda-backend.yml)). The plain `Dockerfile` defaults to port 7860 "for HF Spaces", and Render is mentioned as an alternative ([Dockerfile:1-4](../backend/Dockerfile), [poseApi.js:17-18](../src/config/poseApi.js)).
- **Hugging Face Space:** **no Space config exists in the repo**: no Space README front-matter and no HF workflow. Only the Dockerfile comment mentions HF. The live deployment is Lambda. Checked during the audit: Lambda `/health` → 200 (`classifier_loaded: true`), Render `/health` → 200 after a 22 s cold start.
- **Correctness issue for live mode on Lambda:** the 5-frame vote is stored per container. Lambda can route consecutive requests of one session to different concurrent containers, so a session's vote history can split across instances. This is one more reason to move the vote to the client.

## 8. Tests and CI

**What exists:**
- **Backend:** 227 pytest cases (122 test functions, parametrised), all passing locally in about 1 s. Models are stubbed, so no TensorFlow is needed ([backend/tests/](../backend/tests), [backend-tests.yml](../.github/workflows/backend-tests.yml)). Coverage includes preprocessing invariants, the gates, the stability vote, corrections, labels, splits and NumPy-vs-Keras ([test_numpy_classifier.py](../backend/tests/test_numpy_classifier.py)). (My local `.venv-test` was missing Pillow; I installed it there. That venv is gitignored and nothing in the repo changed.)
- **App:** 33 Jest tests in 4 suites, all passing: storage helpers, yogaData, and an **app↔model label contract test** importing `backend/models/pose_labels.json` ([poseContract.test.js](../src/data/__tests__/poseContract.test.js)). CI also bundles Android JS to catch import errors ([app-tests.yml:37-38](../.github/workflows/app-tests.yml)).
- **Deploy-time smoke test** of the real image ([smoke_test_image.py](../backend/smoke_test_image.py)).

**What's missing:**
- No component or screen tests and no e2e tests; the corrector screen (≈ 830 lines) is untested.
- No lint, typecheck or formatter in CI (no ESLint/Prettier config; plain JS).
- No test exercises the real MoveNet in the PR pipeline (only the deploy smoke test).
- No web build in CI.
- No end-to-end latency measurement.

## 9. Known issues

1. **Fabricated results when offline.** If the backend is unreachable, or even when frame capture fails, the corrector shows cycling fake poses with random 78–96% confidence ([demoPoseData.js:29-39](../src/data/demoPoseData.js), [PoseCorrectorScreen.js:209-219,250-259](../src/screens/PoseCorrectorScreen.js)). It is labelled DEMO and never saved, but recruiters may read it as the model's output. The web app should never do this.
2. **`Alert.alert` is a no-op on web** (16 sites; §2).
3. **Stale docs and comments:**
   - Root README Tech Stack says "MoveNet SinglePose **Lightning**" while Thunder is served ([README.md](../README.md), "Pose-analysis backend"; [paths.py:34](../backend/utils/paths.py)).
   - `movenet.py` docstring says Lightning ([movenet.py:1](../backend/utils/movenet.py)).
   - backend README says "identical square **crop**", but the code pads ([backend/README.md](../backend/README.md), "Layout").
   - backend README's endpoint list omits `/warmup`.
   - Corrector comment says the backend "center-crops a square" ([PoseCorrectorScreen.js:239](../src/screens/PoseCorrectorScreen.js)).
4. **Hardcoded values:**
   - LAN fallback `192.168.1.7` ([poseApi.js:23](../src/config/poseApi.js)).
   - The public API URL ships in the APK by design ([poseApi.js:19](../src/config/poseApi.js)).
   - The AWS account ID appears in the IAM role ARN ([deploy-lambda-backend.yml:15](../.github/workflows/deploy-lambda-backend.yml)). That ID is not a secret, but it is unnecessary exposure; it could move to a repo variable.
   - **No secrets found** in tracked files. AWS and Expo credentials come from GitHub secrets.
5. **Hardcoded threshold duplicate:** `_describe_gate_failure` uses literal `0.15` instead of `MAJOR_MIN_SCORE` ([yoga_pose_engine.py:297](../backend/yoga_pose_engine.py)). It only affects logs.
6. **Unused dependencies:** `expo-haptics`, `react-native-svg` ([package.json:21,35](../package.json)).
7. **`/analyze-pose` is unauthenticated** and shares one global throttle, so one heavy user (or a web demo going viral) degrades everyone, including APK users.
8. **Web export ships all 19 icon fonts (~3.4 MB)** and 7.6 MB of PNG pose images. Fine for a native bundle, heavy for a PWA precache.
9. **No TODO/FIXME markers** in `src/`, `App.js` or backend sources (grep).

---

# Part 2 — Plan

## A. Architecture options

### Option 1 — Expo web (react-native-web), reuse existing screens

| Pros | Cons |
|---|---|
| Already builds and renders (§2): a link could be live in about a day | 16 `Alert` sites need replacing; reminders don't port |
| One UI codebase for APK and web | The corrector's capture model (`takePictureAsync` stills, ~1 fps) is wrong for in-browser inference; that screen gets rewritten anyway |
| No new framework | RN-web output is a phone layout stretched onto a desktop, which is what recruiters see on laptops |
| | PWA (manifest, SW, model caching) is bolt-on with Metro web; little tooling |
| | Any change to shared screens risks the APK, which you've ruled out for now |
| | Doesn't demonstrate Next.js/TypeScript, which is your target stack |

### Option 2 — Next.js + TypeScript PWA with a shared `packages/pose-core`

| Pros | Cons |
|---|---|
| Showcases the stack you're applying with (Next.js, TS, testing, CI, PWA) | Rebuilds about 11 screens' worth of UI (most are simple lists and cards) |
| The pose logic becomes a typed, tested, framework-free package that the RN app can import later | Two UIs to maintain |
| Zero risk to the APK: new folders, no changes to the Expo app | Static content (`src/data`) has to be shared carefully (see M1) |
| Proper desktop and mobile layouts; first-class PWA tooling (Serwist) | |
| Static export: no server, offline-first matches the product | |

### Recommendation: **Option 2**

The deciding factors: the corrector, which is the most valuable screen, must be rewritten for either option; the APK must not be touched; and your target roles reward a Next.js/TS codebase with a clean shared core.

Layout, chosen so the Expo root and EAS build stay byte-for-byte unchanged:

```
/ (Expo app, unchanged)
├── web/                    Next.js 16 App Router, TypeScript, static export
├── packages/pose-core/     pure TS: features, gate, MLP, vote, rules (no DOM, no React)
├── packages/pose-fixtures/ golden JSON generated by Python (for parity tests)
└── backend/                + export_web_artifacts.py, + export_parity_fixtures.py
```

Use **standalone packages** (`web/` depends on `"pose-core": "file:../packages/pose-core"`), **not** root npm workspaces. Converting the root to a workspace would change `package.json` and `package-lock.json`, which EAS builds from. Workspaces can come later, when the RN app adopts `pose-core`.

## B. Inference strategy: in-browser

**Recommendation: run everything in the browser.** That means MoveNet, the MLP, the gate, the vote and the rules, with no server in the hot path.

Why:
- Privacy: frames never leave the device. Recruiters can see this in the network tab.
- Offline: the PWA works after first load.
- Latency: frame rate goes from < 1 fps to 10–30 fps. No cold starts.
- Cost: a public demo link can't run up the Lambda bill or exhaust the shared 10 req/s throttle that APK users rely on.
- It fixes the Lambda vote-splitting issue (§7) by construction.

**MoveNet runtime: decide in M2 with a spike, comparing two candidates:**

| | Candidate A: **same weights** | Candidate B: TF.js MoveNet |
|---|---|---|
| How | Convert the vendored `movenet_thunder.tflite` (and lightning) to ONNX with `tf2onnx --tflite`; run with `onnxruntime-web` (WebGPU, falling back to WASM SIMD) | Load MoveNet **graph model** (TF Hub/Kaggle tfjs, **v4**) with `@tensorflow/tfjs` + WebGL/WebGPU backend, feeding our own padded tensor |
| Train/serve skew | Lowest: identical v3 weights the classifier was trained on | v3 → v4 weight change; keypoint distributions shift, so a classifier retrain on v4 keypoints may be needed |
| Risk | Conversion of MoveNet's post-processing ops may need fixes; ORT-web bundle ~10 MB WASM | Mature on web; widely used |
| Do **not** use | — | the `@tensorflow-models/pose-detection` wrapper: it does its own crop-region tracking and keypoint smoothing, which the classifier never saw |

**Decision gate (end of M2):** pick the candidate that (1) matches Python keypoints on the fixture set (mean |Δ| ≤ 0.01 normalised, top-1 label agreement ≥ 95%), then (2) has the better FPS on the test phone. If neither matches, fall back to B and retrain the head on v4 keypoints (needs the local dataset).

> **Outcome (M2, 2026-10-08): LiteRT.js running the vendored Thunder `.tflite`.** A third candidate found during the spike beat both of the above: Google's LiteRT.js (`@litertjs/core`) runs the server's exact `.tflite` file in the browser on WebGPU or WASM, so no conversion is needed (A2 was dropped). Results are under Progress → M2.

**Thunder vs Lightning:** Thunder is 25 MB and more accurate (CV macro F1 0.782 vs 0.710, [backend/README.md](../backend/README.md) "Results"). Lightning is 9.4 MB and roughly 3–4× faster. Likely outcome: default to Lightning on phones and Thunder on desktop/WebGPU. That needs **one classifier head per variant** (each ~60 KB). The local `feature_cache_lightning.npz` makes training a Lightning head cheap. This is an open question for you.

**Pre-processing in the browser must mirror Python:** pad to a centred square with fill 114, then resize. `INTER_AREA` vs canvas/bilinear resampling is a known small skew; M2 measures it. If it matters, do an area-average resize in a WebGL/WASM step. Camera frames have no EXIF; uploaded images use `createImageBitmap(..., {imageOrientation:'from-image'})`. Feed **un-mirrored** pixels: mirror only the preview with CSS.

**Role of the FastAPI service afterwards:** it is the training pipeline, the **reference implementation and parity oracle**, and an optional "server mode" toggle in the web app's debug panel (useful to demo both and compare). It is not required for the web app.

**Fit with the fully offline APK plan:** the same three artifacts serve all three clients:
1. the `.tflite` file
2. `classifier.json`
3. `pose-core`

On Android: `react-native-vision-camera` frame processor + `react-native-fast-tflite` running the **same `.tflite`**, then `pose-core` (TS works in Metro via `babel-preset-expo`) for features, MLP, vote and rules. The web work therefore de-risks the offline APK: by the time you start it, the hard part (a tested TS port with Python parity) is done. Expo managed + EAS dev builds support these native modules via config plugins.

## C. Keeping clients consistent (anti-skew)

1. **One source of truth per artifact**:
   - `backend/models/` remains canonical.
   - A new `backend/export_web_artifacts.py` writes `classifier.<variant>.json` with `{labels, layers, sha256_of_keras, movenet_variant, thresholds}`, where thresholds are `MIN_CLASS_PROB*`, `STABILITY_*`, gate values and `RULE_MIN_KEYPOINT_SCORE`, read from the Python constants. Also the ONNX file(s).
   - `pose-core` reads thresholds from that JSON rather than re-declaring them, so the numbers can't drift.
2. **Labels:** `pose-core` reads `labels` from the exported JSON. A test asserts it deep-equals `backend/models/pose_labels.json`, the same pattern as [poseContract.test.js](../src/data/__tests__/poseContract.test.js).
3. **Golden parity fixtures** (`backend/export_parity_fixtures.py`, output committed to `packages/pose-fixtures/`):
   - *Logic fixtures:* about 50 real images run through the Python pipeline, plus **~5,000 synthetic keypoint sets** (real keypoints with jitter, low scores, degenerate torsos, mirrored). For each: raw output → pixel keypoints → 34-vector → `has_body` → probabilities → candidate pose → corrections × 3 experience levels. Also vote sequences.
   - *Image fixtures:* the ~50 images plus Python's raw MoveNet output for each.
4. **Two parity test layers in CI:**
   - **L1 (pure logic, every PR, Node, < 5 s):** from Python's keypoints, TS must reproduce features (|Δ| ≤ 1e-5), probabilities (≤ 1e-5), gate, label and **exact correction strings** on 100% of fixtures.
   - **L2 (model):** TS MoveNet on the fixture images (Node `onnxruntime-node`, or Playwright Chromium) vs Python keypoints, using the tolerances from §B. Runs on PRs touching `packages/`, `web/src/inference/`, `backend/utils/`, `backend/models/` or `yoga_pose_engine.py`.
5. **Change protocol:** any edit to Python rules or thresholds means regenerating fixtures. CI fails if fixtures are stale: the fixture header stores a hash of the Python source files it was generated from.
6. **Images for fixtures:** use your own recordings (see [RECORDING_GUIDE.md](RECORDING_GUIDE.md)) or Wikimedia images with their attribution carried over. Don't commit unlicensed dataset images.

## D. PWA requirements

- **Build:** `next build` with `output: 'export'` (pure static).
- **Service worker:** [Serwist](https://serwist.pages.dev) (`@serwist/next`); `next-pwa` is unmaintained.
- **Manifest:** `name`, `short_name`, `start_url: "/"`, `scope`, `display: "standalone"`, `orientation: "portrait"`, `theme_color: "#2E7D32"`, `background_color: "#F1F8E9"` (matching [app.config.js:22-25](../app.config.js)), icons 192/512 plus maskable variants generated from `assets/icon.png`/`adaptive-icon.png`, and `screenshots` (narrow and wide) for the richer Android install sheet.
- **Caching:**
  - Precache the app shell, routes, fonts and icons.
  - Models go in a separate versioned runtime cache, **cache-first, content-hashed filenames**, downloaded on first corrector visit with a progress bar and size shown up front ("Downloading pose model, 9 MB, one time").
  - Call `navigator.storage.persist()` after install.
  - Pose images: convert the PNGs to WebP/AVIF at 2 sizes (7.6 MB → ~0.5–1 MB total) and precache.
- **Install flow:**
  - Android/Chrome: capture `beforeinstallprompt` and show an "Install app" button after the first successful session, not on load.
  - iOS Safari: there is no prompt event. Detect iOS non-standalone and show a one-time sheet ("Share → Add to Home Screen") with a screenshot. Add `apple-touch-icon` and the `apple-mobile-web-app-*` meta.
- **Screen Wake Lock:** request on session start, release on stop, re-acquire on `visibilitychange`, and show a hint if it's unsupported. Verify on iOS in home-screen mode; older iOS versions had wake-lock bugs in standalone PWAs.
- **Camera permission:**
  - Only works in a secure context (HTTPS, or `localhost` in dev).
  - Explain *before* calling `getUserMedia`: "Frames stay on your device."
  - Handle `NotAllowedError` with per-browser re-enable instructions, `NotFoundError` with a "no camera, try the sample video" path, and `NotReadableError` with "camera in use by another app".
  - Default to `facingMode: 'environment'` on phones (matches the APK's rear-camera default, [PoseCorrectorScreen.js:54](../src/screens/PoseCorrectorScreen.js)) and `user` on laptops. Provide a flip button.
- **Offline check:** a Playwright test loads once, goes offline, reloads, and runs the corrector on the sample video.

## E. Native features on web

| Feature | Web plan | Status on web |
|---|---|---|
| Guided practice, Surya Namaskar, timers | Port | Full |
| Voice cues | `speechSynthesis`; unlock on the Start tap (iOS); voice picker fallback if `en-IN` is missing | Full (voice quality varies by OS) |
| Keep screen on | Wake Lock | Full on Chrome/Android; verify on iOS |
| History, streaks, custom sets, favorites, profile | `localStorage` (data < 200 KB) behind a typed storage module with schema version + migration; **Export/Import JSON** button, since browser storage can be cleared | Full, but per-browser and per-device |
| Daily reminder | **Not ported.** Offer "Add daily reminder to calendar" (generated `.ics` with RRULE). Web Push would need a backend and VAPID keys, and only works for installed PWAs on iOS: not worth it for v1 | **Degraded** |
| Live corrector | In-browser inference (§B) | **Better**: faster, private, offline |
| Image upload | File input | Full |
| Haptics | Not used by the app today | n/a |

For the README, add a short "Web vs Android" table with these rows, plus one sentence each on *why*. For example: "Browsers can't schedule a notification while the page is closed; the web app offers a calendar reminder instead." Stating limits plainly reads as engineering judgement.

## F. "Try without a webcam" demo mode

- A `FrameSource` interface (`camera | video | image`) feeds the same pipeline. The demo is not a special code path; it is the real model running on a video.
- **Clips:** 4–6 clips of ~8–12 s each (tree, warrior II, downward dog, chair, a deliberately misaligned version of one). 720p H.264 MP4 + WebM, ~1–2 MB each, lazy-loaded. Record yourself or consenting friends, following [RECORDING_GUIDE.md](RECORDING_GUIDE.md). Avoid dataset or third-party footage.
- **UI:** a "Try with a sample video" button on the corrector and landing page; a `?demo=tree` deep link for the README/portfolio; skeleton overlay; live label, confidence and FPS; corrections spoken (muted by default on desktop, with a visible toggle).
- **Labelling:** clearly marked "Sample video", but results are real model output. **No simulated results anywhere in the web app** (unlike [demoPoseData.js](../src/data/demoPoseData.js)).
- The same clips double as the **Playwright fake camera**: Chromium's `--use-file-for-fake-video-capture=clip.y4m` lets e2e tests drive the true camera path in CI.

## G. Performance plan

**Targets** (provisional until the M2 spike; mid-range Android means a ~₹15–20k phone, e.g. Snapdragon 6-series, Chrome):

| Metric | Mid-range Android | Laptop (integrated GPU) |
|---|---|---|
| Inference FPS, Lightning | ≥ 12 | ≥ 30 |
| Inference FPS, Thunder | ≥ 6 | ≥ 20 |
| Classify + rules per frame | < 1 ms | < 1 ms |
| First inference, cold (download + init) | < 8 s on 4G for Lightning | < 4 s |
| First inference, warm (cached) | < 1.5 s | < 1 s |

**Measurement:**
- `performance.now()` around capture, pre-process, inference and post-processing. Keep rolling p50/p95 in a ring buffer.
- `?debug=1` shows a HUD (backend in use, FPS, stage timings, model variant) and a "Copy metrics JSON" button.
- Report numbers from named real devices in the README, never from guesses.

**Loop design:**
- One frame in flight at a time, driven by `requestVideoFrameCallback`.
- Inference moves to a Web Worker (`OffscreenCanvas` + ORT's worker proxy) if main-thread jank shows in the profiler.
- Pick the backend at runtime: WebGPU → WebGL/WASM.

**Retune for frame rate:**
- The 5-frame vote and the 0.60 live cutoff were tuned at < 1 fps. At 12 fps, five frames is 0.4 s. Make the window **time-based** (~1–1.5 s) in the web client; keep a `parityMode` with the 5/3 frame vote for the L1 tests.
- Speech needs a debounce: speak only after a cue is stable for ≥ 2 s, with ≥ 4 s between utterances.

**Lighthouse:** Lighthouse 12 (2024) **removed the PWA category**, so there is no "PWA score" to target. Instead:
- Lighthouse CI on `/` and `/practice`, mobile profile: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.
- Installability verified by a Playwright test (manifest fields, SW registered, `beforeinstallprompt` fires in Chromium) and the DevTools Application panel during device testing.
- Keep the model download out of the measured routes: it is triggered only on `/corrector`.

## H. Testing plan

- **`pose-core` unit tests (Vitest):**
  - Each function against hand-built cases.
  - Property tests (`fast-check`): translation and scale invariance of features, mirror symmetry, softmax sums to 1, gate monotonicity, and vote behaviour on sequences.
- **Parity:** L1 and L2 from §C.
- **Web (Vitest + Testing Library):** storage migrations, streak computation (port `sessionStorage.test.js` cases), dialogs, the permission-state UI.
- **E2E (Playwright, Chromium + WebKit):** onboarding → practice → history; corrector on the fake camera clip reaches the expected label; offline reload; install manifest.
- **CI:** a new `web-ci.yml` (paths `web/**`, `packages/**`) running typecheck, ESLint, Vitest, build, Playwright and Lighthouse CI. The existing workflows stay as they are, except one line in `eas-build.yml` (see M0).
- **Real-device checklist** (run per milestone from M4; record results in `docs/device-testing.md`):

| Check | Mid-range Android, Chrome | iPhone, Safari | iPhone, home-screen PWA |
|---|---|---|---|
| Camera permission prompt, deny → recovery copy | | | |
| Rear/front flip; preview not stretched | | | |
| FPS (HUD p50/p95), Lightning and Thunder | | | |
| Phone gets warm or throttles after 5 min live | | | |
| Voice speaks after Start tap; no overlapping utterances | | | |
| Screen stays on 3+ min during a session | | | |
| Install flow (prompt / A2HS sheet), icon, splash, standalone | | | |
| Offline: airplane mode → reopen → corrector on sample video | | | |
| Storage survives close/reopen; export/import JSON | | | |
| Landscape/rotation doesn't break the overlay | | | |
| Uploaded portrait photo is upright (EXIF) | | | |

## I. Hosting

- **Vercel** (Hobby), project root `web/`, static export:
  - Preview deploy per PR (nice in the README: "every PR gets a live preview").
  - "Ignored Build Step" so only changes in `web/` or `packages/` build.
- **Model hosting:**
  - Serve from the same origin, so there is no CORS and the SW caches simply.
  - Check the platform's per-file limit against the converted model size before committing to a host. Thunder is 23.9 MiB; Cloudflare Pages' 25 MiB per-file cap would be borderline, and Vercel limits should be confirmed in M0.
  - Fallback: a GitHub Release asset or Cloudflare R2 with CORS and immutable caching.
- **URL:** `yoga.atharvaawate.me` (CNAME to Vercel), keeping it under your portfolio domain; or `yoga-therapy.vercel.app`. Your call (open question). Link it from the portfolio card and the repo About field.
- **The backend stays on Lambda for the APK** until the offline-APK milestone.

## J. README plan

Restructure the root README around **"v1: native app + cloud inference → v2: installable web app with on-device inference"**:

1. Hero: a one-line pitch, **Live demo** button, **Download APK** button, a 10 s GIF (sample-video demo with skeleton overlay and spoken-cue captions).
2. "Try it in 30 seconds": the demo link with `?demo=tree`, no webcam needed.
3. **Architecture diagram** (Mermaid, rendered by GitHub) with two lanes: v1 (APK → API Gateway → Lambda: MoveNet + MLP + rules) and v2 (browser: camera → MoveNet in ONNX/WASM-WebGPU → `pose-core` → speech). Shared artifacts sit in the middle: `.tflite`/`.onnx`, `classifier.json`, fixtures. The Python training pipeline feeds both.
4. **Measured metrics table:**
   - Model: CV/test/Wikimedia F1, already in the backend README.
   - Web: FPS p50/p95 on named devices, cold and warm first inference, bundle and model sizes.
   - Lighthouse scores.
   - Parity: "L1: 5,000/5,000 identical; L2: top-1 agreement X%".
5. **Design decisions & trade-offs** (short ADR-style bullets): why in-browser inference; why Next.js rather than Expo web; why pad rather than crop; why the MLP runs in plain TS; why a time-based vote on web; why no push notifications.
6. Web vs Android feature table (§E), stated plainly.
7. Testing and CI overview (badges for app, backend, web and parity).
8. Fix the stale lines from audit item 9.3 at the same time.

## K. Roadmap

Effort is in focused working days for one person. Each milestone ends with something you can link to.

| # | Milestone | Effort | Demo at the end | Main risks |
|---|---|---|---|---|
| **M0** | **Scaffold & guardrails.** `web/` (Next 16, TS strict, ESLint, Vitest), `packages/pose-core` skeleton, `web-ci.yml`, Vercel project + domain. Add `web/**` and `packages/**` to `eas-build.yml` `paths-ignore` so web pushes don't spend EAS quota | 1 | Live URL with a landing page | Vercel/monorepo path config; forgetting the EAS ignore burns build quota |
| **M1** | **Non-camera app on web.** Home, conditions, pose detail, guided practice (speech + wake lock), Surya Namaskar, custom sets, history/streaks, settings, onboarding; typed storage with export/import; accessible dialogs. Reuse `src/data/*.js` read-only via a path alias, with a web replacement for `poseImages.js` (it `require`s PNGs, [yogaData.js:1](../src/data/yogaData.js)) | 5–7 | Fully usable web app minus the corrector | Content drift if copied instead of imported; scope creep on UI polish |
| **M2** | **Inference spike + decision gate.** Convert tflite → ONNX; Candidate A vs B; padded pre-processing; skeleton overlay on webcam and video at `/lab`; L2 parity script; FPS on the real phone | 3–4 | `/lab`: live skeleton + FPS HUD on phone and laptop | **Highest-risk milestone.** Conversion issues, keypoint mismatch, low phone FPS. Mitigation: B fallback, Lightning, retrain |
| **M3** | **`pose-core` + golden parity.** Port features, gate, MLP, vote, rules; `export_web_artifacts.py`, `export_parity_fixtures.py`; L1 in CI | 3–4 | Image upload → label + corrections, 100% in-browser; CI parity badge | Subtle rule-port mistakes (caught by the 5,000-case fixtures); fixture images' licensing |
| **M4** | **Live corrector.** Camera with permission UX, flip, overlay, time-based vote, debounced speech, wake lock, session saving, target-pose match, sample-video mode + `?demo=` links | 4–6 | The headline demo: real-time corrections from webcam or sample video | Speech/timing UX at high FPS; iOS camera quirks; recording good clips |
| **M5** | **PWA & offline.** Manifest, icons, Serwist, versioned model cache with progress, install prompts (Android + iOS sheet), image optimisation, offline e2e | 2–3 | Install on phone; works in airplane mode | iOS storage eviction/standalone quirks; SW update/versioning bugs |
| **M6** | **Performance + device testing.** Worker offload if needed, backend auto-select, Lighthouse CI, device checklist on Android + iPhone, fix findings | 3–4 | Metrics table with real numbers | Thermal throttling on phones; WebGPU availability varies |
| **M7** | **Docs & story.** README restructure, Mermaid diagram, demo GIF, ADR notes, portfolio card update | 1–2 | Recruiter-ready repo + live link | Over-claiming; keep every number measured |

**Total: about 22–31 working days.** M0–M1 alone already give a shippable link, and M2 should be done early since it decides the rest.

**After v2 (not in scope now): M8, offline APK.** Adopt `pose-core` in the RN app; `react-native-vision-camera` + `react-native-fast-tflite` with the same `.tflite`; drop the DEMO fallback; keep Lambda only as optional. This will touch the APK build, so it's a separate decision.

---

# Progress

**M0 (scaffold & guardrails): code done on branch `web/m0-scaffold`; deploy pending.**

- `web/`: Next.js 16.3.8, TypeScript strict, Tailwind 4, ESLint, Vitest + Testing Library, `output: "export"`. Landing page in the RN app's palette, light and dark.
- `packages/pose-core`: keypoint contract plus a test that parses `backend/utils/preprocessing.py`, so Python/TS drift fails CI from day one.
- CI: `web-ci.yml` (pose-core typecheck + tests; web lint, typecheck, tests, static build).
- Guardrails:
  - `eas-build.yml` and `app-tests.yml` ignore `web/**`, `packages/**` and `web-ci.yml`.
  - Root Jest ignores `/web/` and `/packages/`; without that change, root `npm test` picked up the Vitest files and failed.
  - Root Jest is still 33/33 and the Android JS bundle still builds.
- Deviations from the plan:
  - Next 16 instead of 15 (current stable).
  - No Vercel "Ignored Build Step": static builds are cheap, and a `HEAD^` diff can wrongly skip multi-commit pushes.
- Pending (needs Atharva's accounts): Vercel project (Root Directory `web`) and the `yoga.atharvaawate.me` CNAME. Steps are in `web/README.md`.

**M1 (non-camera app on web): done on branch `web/m1-app`, stacked on M0.**

- All screens except the camera corrector: Home (onboarding gate), Health Scanner, 11 condition pages and 18 pose pages (prerendered), guided practice, Surya Namaskar, custom sets (list, create/edit with reordering, view), progress, settings, profile, and an honest corrector placeholder.
- Content and storage logic are reused from `src/data` rather than copied. AsyncStorage is aliased to a localStorage shim with an in-memory fallback, so streak and stats code is shared with the APK. The RN app is unchanged.
- Web substitutes: Web Speech, Wake Lock, native `<dialog>`, `.ics` daily reminder, JSON export/import.
- Tests: 63 Vitest tests (practice and Surya state machines, `.ics`, backup validation, storage shim, content contract vs `pose_labels.json`, routine resolution, dialog, profile form, set editor).
- Checked in a browser at phone and desktop widths, light and dark. Fixed from that pass: views opening scrolled to the bottom; the set-editor error appearing off screen; destructive dialogs focusing the destructive button.
- Deferred to M5 as planned: pose photos are still the original ~1 MB PNGs.

**M2 (inference spike + decision gate): done on branch `web/m2-inference`, stacked on M1.**

- **Fixtures.**
  - `backend/export_lab_fixtures.py` re-encodes 32 freely licensed Wikimedia photos (CC0, public domain or CC BY only, credited in `web/public/lab/fixtures/ATTRIBUTION.md`).
  - It records the server pipeline's outputs for both MoveNet variants at float32 precision.
  - The server gets 25/32 right on Thunder, in line with the 80% the backend README reports for this set.
- **Classifier in TypeScript, pulled forward from M3.**
  - `backend/export_web_artifacts.py` writes the MLP weights and server thresholds to `packages/pose-core/models/classifier.thunder.json`.
  - `pose-core` now has `normalizeKeypoints`, `hasBody` and `PoseClassifier`.
  - On all 64 fixture cases, the TypeScript features (within 1e-5 relative), body gate, labels and probabilities match Python.
  - Backend and pose-core tests both fail if the export goes stale after retraining.
- **`/lab`** (noindex, linked from About): load a runtime and model, run parity over the fixtures, benchmark, and run live with a skeleton overlay from camera, video file or image.
- **Results** (desktop Chrome in the hidden browser pane; parity is deterministic, timings are throttled ranges):

| Runtime · model | Mean keypoint error | Same label | Same served result | Body gate | Inference (desktop) |
|---|---|---|---|---|---|
| **LiteRT · Thunder · WASM** | **0.00095** | 31/32 | **32/32** | 32/32 | 66–112 ms |
| **LiteRT · Thunder · WebGPU** | **0.00095** | 31/32 | **32/32** | 32/32 | 39–43 ms |
| LiteRT · Lightning · WASM | 0.00128 | 29/32 | 29/32 | 31/32 | 12–20 ms |
| LiteRT · Lightning · WebGPU | 0.00128 | 29/32 | 29/32 | 31/32 | 24–36 ms |
| TF.js v4 · Thunder · WebGPU | 0.0109 | 28/32 | 26/32 | 31/32 | 6–12 ms |
| TF.js v4 · Lightning · WebGPU | 0.0149 | 25/32 | — | 29/32 | 8–13 ms |

- **Reading the results.**
  - *Served result* is what the user would see after the body gate and the 0.70 cutoff.
  - The one Thunder label mismatch is a borderline photo (server 0.48 plow, browser 0.40 bridge, caused by one ambiguous wrist). Both fall below the cutoff, so both serve "no pose".
  - TF.js is fastest but fails parity: its v4 weights differ from the v3 weights the classifier was trained on.
  - Lightning's keypoints are close to the server's, but the Thunder-trained classifier sits near decision boundaries on them.
- **Decision.**
  - Use LiteRT.js with the server's Thunder `.tflite`: WebGPU (JSPI build) where available, otherwise WASM (plain build, which is faster on CPU than the JSPI one).
  - Lightning is not used until it has its own classifier head (decision #1). Training it needs the local dataset, so it moves to M3, where the Lightning head gets its own parity check.
- **Other findings.**
  - Canvas "low" smoothing matched slightly better on these 2× downscales (0.00079 vs 0.00095). "high" is kept because camera frames are downscaled 5× or more, where bilinear aliases.
  - LiteRT logs INFO lines to `console.error` (cosmetic).
- **Still open (needs a real phone).** FPS on a mid-range Android and an iPhone, which also decides WebGPU vs WASM on mobile and whether Thunder is fast enough there. Run `/lab` → Benchmark on a Vercel preview URL; WebGPU needs HTTPS, so a LAN `http://` address only tests WASM.

**M3 (pose-core + golden parity): done on branch `web/m3-pose-core`, stacked on M2.**

- **Per-variant classifier heads.**
  - `utils.paths.CLASSIFIER_MODEL_PATHS` maps Thunder to `pose_classifier.keras` (unchanged) and Lightning to the new `pose_classifier_lightning.keras`.
  - Training writes only the selected variant's head, and refuses to change the shared label order.
  - This also fixes a latent server bug: `MOVENET_VARIANT=lightning` used to pair Lightning keypoints with the Thunder classifier.
  - Lightning head, trained from the cached features: Wikimedia accuracy 0.765 / macro F1 0.605, against Thunder's 0.800 / 0.652.
  - In the lab, Lightning with its own head now matches the server's served result on 31/32 photos (it was 29/32 with the Thunder head), which passes the 95% gate. Decision #1 is viable; phone FPS decides it.
- **The rest of the pose logic in pose-core:**
  - `corrections.ts`: every pose's rules, legacy-label aliases, Warrior II distances
  - `stability.ts`: the 5-frame vote, including Counter tie-breaking
  - `analyze.ts`: `analyzeFrame`, in `/analyze-pose` order
- **Golden parity fixtures** (`backend/export_parity_fixtures.py` → `packages/pose-core/fixtures/parity.json.gz`, 292 KB):
  - 1,008 skeletons × 29 pose names × 3 levels, i.e. 87,696 correction outputs, including collapsed-torso cases
  - 500 frames per variant through the full post-MoveNet pipeline (real photos, no-body frames, recognised poses, image and live cutoffs)
  - 300 vote sequences
- **Results:**
  - TypeScript reproduces 100% of these outputs.
  - Cases on a float32/float64 decision boundary are resampled (182 of about 1,200 skeletons, mostly from rounding of the distance metrics).
  - Source hashes (line-ending-normalized) make both the pose-core and backend tests fail when the Python changes without regenerating.
  - `web-ci` now runs on changes to `yoga_pose_engine.py`, `preprocessing.py`, `label_utils.py` and the models.
- **Demo: photo check on `/corrector`.**
  - Pick a photo or one of three credited samples, and get the skeleton overlay, pose, confidence, corrections and target-pose match.
  - It runs on the device (LiteRT Thunder on WASM plus `analyzeFrame`), with a progress bar for the one-time 25 MB model download.
  - Verified in the browser: the Warrior II sample is recognised at 98% and matches its target; Tree Pose at 99%.
- **Tests:** backend 243, pose-core 98 (including 6 parity suites), web 73.

**M4 (live corrector): done on branch `web/m4-live`, stacked on M3.**

- **`/corrector` Live tab.**
  - Sources: camera (permission explained up front; blocked, missing, busy and insecure-context errors explained, plus separate video errors), a video file, or a no-camera demo (a slideshow of the credited sample photos; `?demo=1` starts it).
  - Skeleton overlay on the live video, mirrored for the front camera while the model sees unmirrored frames.
  - Pose name, confidence and the top cue on screen; the full corrections and target-pose match below.
  - Flip camera, voice toggle, screen kept on.
  - The Photo tab keeps M3's photo check.
- **Model choice** (`modelChoice.ts`), as in decision #1: Thunder on desktop (WebGPU if LiteRT can use it), Lightning on phones (WASM). `?model=` / `?accel=` override it for the phone benchmark; `?debug=1` shows FPS, inference time, the body gate and the raw top guess.
- **`TimeWindowVote` (pose-core).**
  - The server's majority rule over 1.2 s and 60% instead of 5 frames, since 5 frames would be half a second at 10+ fps.
  - It never keeps fewer than 5 frames, so slow devices get exactly the server's 3-of-5 behaviour. A test checks this equivalence.
  - Found in the browser: without that floor, a 1 fps device never reported a pose.
- **`SpeechCoach`:** speaks a cue after it has held 2 s, at most every 4 s, never a back-to-back repeat, prefixed with the pose name as in the APK.
- **`SessionTracker`:** the APK's save rules (at least 15 s with a recognised pose; camera only, so demo and video runs aren't logged as practice).
- **Verified in the browser** (desktop, with timers substituted for the hidden pane's paused `requestAnimationFrame`):
  - The demo runs at 16–19 fps on Thunder/WebGPU (37–56 ms per frame), and recognises Warrior II 98%, Tree 99%, Downward Dog 100% and Triangle 99%.
  - The target match toggles correctly.
  - Speech: one sentence per pose about 4 s apart.
  - Stop shows a summary and doesn't save the demo.
  - The camera-blocked path shows the right message.
  - Not verifiable in the hidden pane: a real camera (blocked) and video playback (Chrome pauses background video). Both need a visible tab or a phone.
- **Sample videos (decision #4)** still need recording. `public/demo/videos.json` is empty, and each clip added there becomes a "Sample" button (format in `web/README.md`).
- **Tests:** pose-core 107, web 91.

**M5 (PWA & offline): done on branch `web/m5-pwa`, stacked on M4.**

- **Installable.**
  - `app/manifest.ts`: standalone, portrait, theme and background colours from the APK, 192/512 and maskable icons, shortcuts.
  - `appleWebApp` metadata for iOS.
  - Settings has an Install card (the browser prompt on Chrome/Android, Share → Add to Home Screen steps on iOS).
  - Home shows a dismissible install nudge, only after the first practice session.
- **Service worker** (`sw/sw.js` + `scripts/build-sw.mjs` + `scripts/sw-manifest.mjs`). It is hand-written instead of Serwist: a static export is a complete file list, so a dependency-free worker is easier to reason about and test, and Serwist's Next integration is webpack-first while this app builds with Turbopack.
  - **Precache** at install: all pages, RSC payloads, hashed assets, fonts, icons, the WebP pose photos and the 4 demo photos (about 5.7 MB; about 1.2 MB of it is the lab-only TF.js chunk, accepted rather than filtered with fragile heuristics).
  - **Runtime cache:** the models and LiteRT WASM on first use.
  - Both caches are versioned by content hash; a new deploy waits for the user's "Reload".
  - `navigator.storage.persist()` is requested after the first model load.
- **Images.** `scripts/generate-images.mjs` turns 7.9 MB of pose PNGs into 0.23 MB of WebP (480/960 px with a blur placeholder) and makes the icons. The content layer maps the RN image handles to them; a test fails if a photo lacks its WebP version.
- **End-to-end tests (Playwright, Chromium, in CI).** The in-app browser pane can't run service workers, so offline behaviour is verified in headless Chromium. Five tests:
  1. The manifest is valid and its icons load.
  2. The app works offline after one visit (pages, photos, client navigation).
  3. The corrector works offline once its model has loaded.
  4. The live camera, via Chromium's fake camera playing a generated Warrior II clip, recognises the pose, matches the target, shows corrections, and saves a 16 s session to Progress. This is the first verification of M4's real camera path.
  5. `?demo=1` starts the demo.
- **Bugs found by these tests, now fixed:**
  - The build script's placeholder replacement hit a comment first, leaving a worker that threw on load. A regression test now covers it.
  - The first service-worker install reloaded the page under a new visitor (`clients.claim` fired `controllerchange`). The page now reloads only after the user taps "Reload".
- **Tests:** web unit 116, e2e 5 (about 30 s locally).
- **Not done:**
  - Screenshots for the richer Android install sheet (optional in the manifest).
  - An automated test of the update banner across two deploys.

# Decisions (2026-10-08)

Atharva accepted the recommendation on every open question:

1. **Model variant:** Lightning on phones, Thunder on desktop/WebGPU. Train a Lightning classifier head from the local feature cache (M2/M3).
2. **EAS guard:** `web/**`, `packages/**` and `web-ci.yml` are added to `paths-ignore` in `eas-build.yml` (and `app-tests.yml`) in M0.
3. **Domain:** `yoga.atharvaawate.me`, a CNAME to Vercel. DNS and the Vercel project are set up by Atharva (needs his accounts).
4. **Sample videos:** Atharva records them (or consenting friends) following `docs/RECORDING_GUIDE.md`: tree, warrior II, downward dog, chair, and one deliberately misaligned warrior II (M4).
5. **Reminders on web:** ship the `.ics` calendar-reminder substitute (M1).
6. **Server mode:** in-browser by default and in the public demo. A Lambda comparison toggle exists only behind `?debug=1`.
7. **Hugging Face:** ignored; Lambda (and Render) are the real deployments.
8. **Content:** the web app imports `src/data/*.js` read-only via a path alias, with a web replacement for `poseImages.js` (M1). Moving content to a shared package waits until changing the RN app is allowed.
9. **Onboarding on web:** experience level plus an optional name. Age is dropped: the RN app stores it but never uses it (it is written at [ProfileSetupScreen.js:67](../src/screens/ProfileSetupScreen.js) and only read back to prefill that same form, lines 50-52).
