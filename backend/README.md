---
title: Yoga Pose Engine
emoji: 🧘
colorFrom: green
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Yoga Pose Engine (backend API)

FastAPI service that powers the Yoga Therapy app's Live Pose Corrector. It runs
MoveNet (TFLite) for body keypoints and a small classifier for the pose label,
then returns rule-based corrections.

The YAML block at the top of this file configures a **Hugging Face Space** — it
is ignored everywhere else, so this doubles as the Space's landing page and the
backend's own README.

## Layout

```
yoga_pose_engine.py         FastAPI app (routes, gating, correction rules)
train_movenet_classifier.py CLI: train the classifier head
eval_pose_metrics.py        CLI: precision/recall/F1 on the test split
utils/                      shared by all three — this is what prevents skew
  ├── paths.py              filesystem layout
  ├── label_utils.py        dataset folder name -> canonical class label
  ├── preprocessing.py      image -> 34-value feature vector (no TensorFlow)
  ├── movenet.py            TFLite keypoint runtime (lazy TF import)
  ├── dataset.py            labelled folders -> feature matrix
  └── model.py              classifier architecture / train / save / load
tests/                      pytest suite (runs without TensorFlow)
k8s/                        Minikube-oriented Deployment + Service
```

The trainer, the evaluator and the server all extract features through
`utils/dataset.py` → `utils/preprocessing.py`. Training and serving therefore
apply the identical square crop, keypoint normalization and body-presence gate
by construction rather than by convention.

## Endpoints

- `GET /health` — liveness/model-availability probe (returns JSON). Cheap by
  design: it does not force a model load.
- `POST /analyze-pose` — body `{ image_base64, session_id?, source, experience_level }`
  → `{ pose, confidence, corrections, distances, probabilities, debug_image_base64 }`

## Training

```bash
python train_movenet_classifier.py              # extract (cached), split, train
python eval_pose_metrics.py                     # held-out test metrics
```

Feature extraction over the full dataset takes ~10 minutes and is cached to
`models/feature_cache.npz`; later runs reuse it. `--rebuild-cache` forces
re-extraction (required after any preprocessing or label-space change).

### Label space — 26 classes

Folder names are normalized to canonical labels by `utils/label_utils.py`, which
merges duplicates (`Trikonasana` / `traingle` / `triangle` → `triangle_pose`;
`Adho Mukha Svanasana` → `downward_dog`).

The dataset's `no_pose/` folder normalizes to `unknown`, which is in
`EXCLUDED_LABELS` and **not trained**. The body-presence gate already rejects
frames without a visible person before the classifier runs, so those images
were filtered out anyway (400 raw → 25 surviving) and the class had zero test
coverage — an output neuron that could never be evaluated. Feature extraction
skips the folder and reports the count under `skipped_excluded_class`.

### Why the split is grouped and stratified

Features are appended class by class, so the matrix is **sorted by label**.
Keras' `validation_split` takes the *last* rows *before* shuffling, which
carves off whole classes — validation ends up containing poses that never
appear in training. That produces a ~50-point train/val gap that looks exactly
like overfitting but is a split artifact. Measured on this dataset:

| split | train acc | val acc | val loss | gap |
|---|---|---|---|---|
| `validation_split=0.2` (class-ordered) | 0.895 | 0.406 | 27.90 ↑ | 48.9 pts |
| grouped + stratified | 0.839 | 0.796 | 0.67 ↓ | 4.3 pts |

Same data, same architecture — only the split changed. Reproduce the broken
behaviour with `--legacy-split`.

A val loss of ~28 alongside 40% accuracy is the tell: that combination is not
what genuine overfitting looks like. It means some validation samples were
assigned near-zero probability — i.e. their class was absent from training.

The split is also **grouped**: the dataset contains horizontal-flip twins
(`1.jpg` / `1_flipped.jpg`) and consecutive video frames (`annotated_000001…`,
`girl1_warrior046/048/049`). A plain random split puts near-identical frames on
both sides, so validation would score memorization. `utils/splits.py` derives a
group key per file and assigns whole groups.

### Regularization

Chosen by ablation on the corrected split, not by assumption:

| config | val loss | val acc |
|---|---|---|
| none | 0.805 | 0.785 |
| **dropout 0.2** | **0.635** | **0.809** |
| dropout 0.3 + L2 1e-4 | 0.756 | 0.791 |
| inverse-frequency class weights | 0.811 | 0.808 |
| dropout 0.2 + class weights | 0.731 | 0.780 |

Dropout 0.2 is the default — best on both val loss and val accuracy. Adding L2
hurts. Class weighting roughly matches on accuracy but is much worse on loss
(less-calibrated confidence, which matters because the API gates predictions at
`MIN_CLASS_PROB = 0.70`). Both stay off; re-test with `--l2` / `--class-weight`.

Training runs to a 200-epoch ceiling with early stopping on `val_loss`
(patience 10, best weights restored).

Note the model has real run-to-run variance: across seeds 42/7/2024 validation
accuracy lands at 0.793 / 0.801 / 0.819. Aggregate numbers are stable to about
±1.5 points, but per-class F1 for the small classes (`butterfly_pose` n=42,
`childs_pose` n=30) swings much more than that. Do not read a single run's
per-class figures as a precise estimate.

## Tests

The suite stubs both model runtimes through FastAPI's dependency overrides, so
it needs neither TensorFlow nor the trained artifacts and finishes in about a
second:

```bash
cd backend
python -m venv .venv-test
.venv-test\Scripts\activate      # macOS/Linux: source .venv-test/bin/activate
pip install -r requirements-dev.txt
pytest
```

Covers the health probe, the `/analyze-pose` request path (confidence gate,
body-presence gate, live-mode stability filter, experience levels, malformed
input), label normalization, and the preprocessing invariants that pin the
train/serve contract.

## Run locally

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows   (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn yoga_pose_engine:app --host 0.0.0.0 --port 8000
# open http://localhost:8000/health
```

## Deploy free on Hugging Face Spaces

This makes the API reachable from anywhere so the installed APK works without a
laptop on the same Wi-Fi. Free tier, no credit card.

1. Create a free account at <https://huggingface.co>.
2. **New → Space.** Choose **SDK: Docker**, give it a name (e.g.
   `yoga-pose-engine`), visibility **Public**, and create it.
3. Push **only these files** into the Space repo (the Dockerfile serves just
   the API + models — do **not** upload the training data under
   `yoga_poses/` / `dataset/`):
   - `Dockerfile`
   - `requirements-space.txt`
   - `yoga_pose_engine.py`
   - `utils/` (shared preprocessing/label code — the server will not import without it)
   - `models/` (all three files)
   - `README.md` (this file — its YAML header configures the Space)

   Either drag them in via the Space's **Files** tab, or with git:
   ```bash
   git clone https://huggingface.co/spaces/<your-user>/yoga-pose-engine
   cd yoga-pose-engine
   # copy the 5 items above into here
   git add . && git commit -m "Deploy yoga pose engine" && git push
   ```
   > If HF asks you to use Git LFS for `movenet_lightning.tflite` (9 MB), run
   > `git lfs install && git lfs track "*.tflite"` before committing.
4. HF builds the image automatically — watch the **Logs** tab (first build
   ~5–10 min). When the status reads **Running**, your API is live at:
   ```
   https://<your-user>-yoga-pose-engine.hf.space
   ```
5. Verify: open `https://<your-user>-yoga-pose-engine.hf.space/health` in a
   browser — you should get a JSON response.
6. Point the app at it: set `HOSTED_API_URL` in
   [`src/config/poseApi.js`](../src/config/poseApi.js) to that base URL, then
   rebuild the APK (`eas build` or the local Gradle build).

### Cold starts

Free Spaces sleep after ~48 h of inactivity. The **first** request after sleep
takes ~30–60 s to wake the container, then responses are fast. In the app this
shows as the "Analysis server unreachable" banner on first open — wait a few
seconds and tap **Retry Connection**. Photo-upload mode is the smoothest demo;
live-streaming mode works but is slower over the internet than on LAN.
