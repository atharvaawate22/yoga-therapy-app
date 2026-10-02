# Yoga Pose Engine (backend API)

FastAPI service that powers the Yoga Therapy app's Live Pose Corrector. It runs
MoveNet (TFLite) for body keypoints and a small classifier for the pose label,
then returns rule-based corrections.

In production it runs on **AWS Lambda** as a container image behind API
Gateway; see [Deployment](#deployment).

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
lambda_handler.py           AWS Lambda entry point (wraps the app with Mangum)
Dockerfile.lambda           Lambda container image (the hosted API)
Dockerfile                  plain uvicorn image for any other Docker host
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
python train_movenet_classifier.py --augment-mirror   # extract (cached), split, train
python eval_pose_metrics.py                           # held-out test metrics
```

Feature extraction over the full dataset is cached to
`models/feature_cache.npz`; later runs reuse it. `--rebuild-cache` forces
re-extraction (required after any preprocessing, label-space or data-cleaning
change). Images are decoded with the same `utils.preprocessing.decode_image`
the server uses (EXIF rotation, downscale), then padded to a square.

`--augment-mirror` adds a left-right mirrored copy of each training sample
(the same pose done to the other side), applied after the split so
validation stays unaugmented. It was the best option on the grouped
validation split over seeds 42/7/2024 (macro F1 0.669 vs 0.656 without).
Joint-angle input features were also tried: they helped only while the data
still had the label conflicts below, and were dropped once it was cleaned.

### Data cleaning

`utils.dataset.build_feature_dataset` applies three rules and reports each in
its summary line:

- **Label conflicts.** The synthetic 3D-render images are named
  `<actor><n>_<pose><frame>` (`guy2_cobra065.jpg`). 200 cobra frames were also
  filed under the upward-dog training folder as byte-identical copies of files
  in `cobra/` (40 more in the test folder), so the same image was labelled
  both ways. A file whose name names a different pose than its folder is
  skipped, as is an identical image already seen under another label.
- **Duplicates.** Byte-identical copies under the same label (e.g. 418 images
  in both `tree/` and `Vrksasana/`) are counted once.
- **Train/test leakage.** 1,143 of the 3,425 test images are byte-identical
  copies of training images. The evaluator passes the training set's hashes
  (`exclude_hashes`) so those are not scored as held out.

### Results (leak-free test set)

1,591 test images remain after cleaning. Every test image of `upward_dog` and
of the Surya-only classes (`ashtanga_namaskara`, `ashwa_sanchalanasana`,
`dandasana`, `hasta_padasana`, `hasta_uttanasana`, `pranamasana`, `tadasana`)
was a copy of a training image, so those 8 classes currently **have no
held-out evaluation**; adding fresh test photos for them is the next data task.

| model | accuracy | macro F1 (18 measurable classes) | butterfly | cobra | seated twist |
|---|---|---|---|---|---|
| previous (cropped features, uncleaned data) | 0.829 | 0.746 | 0.354 | 0.910 | 0.596 |
| current (`--augment-mirror`, cleaned data) | **0.865** | **0.787** | **0.554** | **0.942** | **0.614** |

Scores published here before this cleanup were computed on the leaky test
set and overstate generalization.

### Per-class estimates for every class (cross-validation)

`python train_movenet_classifier.py --cv 5 --augment-mirror` predicts every
training sample with a model that never saw it or its group, so it scores the
8 classes the test folder can't. "served" is the share of a class the API
reports correctly *above the confidence cutoff* — what a user experiences.

Overall: accuracy 0.762, macro F1 0.642. The weakest classes, all short on
unique data after deduplication:

| class | n | F1 | served @ 0.70 | served @ 0.60 |
|---|---|---|---|---|
| seated_twist | 160 | 0.544 | 0.069 | 0.212 |
| upward_dog | 224 | 0.388 | 0.062 | 0.179 |
| cobra_pose | 430 | 0.579 | 0.209 | 0.363 |
| butterfly_pose | 259 | 0.591 | 0.259 | 0.344 |
| pranamasana | 46 | 0.539 | 0.174 | 0.304 |
| hasta_padasana | 52 | 0.105 | — | — |
| dandasana | 6 | 0.000 | — | — |

**Confidence cutoffs.** Single images keep `MIN_CLASS_PROB = 0.70`
(93.1% of reported poses correct, 61.8% of frames reported). Live frames use
`MIN_CLASS_PROB_LIVE = 0.60` because they also pass the 3-of-5 stability vote:
simulated on the out-of-fold predictions, report precision stays ~95% while
the share of windows with a reported pose rises from 47% to 55%. The
simulation treats frames as independent; real consecutive frames are
correlated, so the vote filters somewhat less than that in practice.

**What would actually fix the weak classes is more unique training images**
(and fresh test images for the 8 classes the test folder can't score).

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

Chosen by ablation on the corrected split, not by assumption (these runs
predate the data cleaning above, so absolute numbers are not comparable):

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

`requirements.txt` includes full TensorFlow for training and evaluation. The
server itself doesn't need it: MoveNet runs on LiteRT and the classifier runs
in NumPy from the same `.keras` file (`utils.model.NumpyClassifier`), so the
hosted images install the much smaller `requirements-space.txt`.

## Deployment

The hosted API runs on **AWS Lambda** (`us-east-1`) as a container image behind
an API Gateway HTTP API. The app reaches it through `HOSTED_API_URL` in
[`src/config/poseApi.js`](../src/config/poseApi.js).

- `Dockerfile.lambda` builds the image: the serving dependencies from
  `requirements-space.txt`, the Lambda Runtime Interface Client, and
  `lambda_handler.py`, which wraps the unchanged FastAPI app with Mangum.
- [`deploy-lambda-backend.yml`](../.github/workflows/deploy-lambda-backend.yml)
  runs on every push to `main` that touches `backend/`. It builds the image,
  smoke-tests it with `smoke_test_image.py`, pushes it to ECR, creates or
  updates the Lambda function (30 s timeout, 2 GB memory) and applies API
  Gateway throttling (10 requests/s, burst 20). It needs the
  `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` repository secrets.
- Check a deploy with `GET /health` on the API URL.

The plain `Dockerfile` runs the same app with uvicorn on `$PORT` (7860 by
default) for any other Docker host, such as Render or the Minikube setup in
`k8s/`.

### Cold starts

The first request after the function has been idle starts a new container, so
it is noticeably slower than the ones after it. If the app shows "Analysis
server unreachable" on first open, wait a few seconds and tap
**Retry Connection**.
