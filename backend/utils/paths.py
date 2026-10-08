"""Filesystem layout for the backend.

All three entry points previously declared these paths independently. They are
resolved relative to this file, so scripts work regardless of the current
working directory.
"""

from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

MODELS_DIR = BASE_DIR / "models"
LABELS_PATH = MODELS_DIR / "pose_labels.json"

# Keypoint model. The classifier is trained on one variant's keypoints, so
# training, evaluation and serving must all use the same one; select it with
# the MOVENET_VARIANT environment variable. Thunder (256px input) is the
# default: on 5-fold grouped CV it beat Lightning (192px) on accuracy
# 0.777 -> 0.822 and macro F1 0.710 -> 0.782, at ~27 vs ~7 ms per frame.
MOVENET_VARIANTS = {
    "lightning": (
        MODELS_DIR / "movenet_lightning.tflite",
        "https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/3?lite-format=tflite",
    ),
    "thunder": (
        MODELS_DIR / "movenet_thunder.tflite",
        "https://tfhub.dev/google/lite-model/movenet/singlepose/thunder/3?lite-format=tflite",
    ),
}
MOVENET_VARIANT = os.environ.get("MOVENET_VARIANT", "thunder").strip().lower()
if MOVENET_VARIANT not in MOVENET_VARIANTS:
    raise ValueError(
        f"MOVENET_VARIANT={MOVENET_VARIANT!r}; expected one of {sorted(MOVENET_VARIANTS)}"
    )
MOVENET_MODEL_PATH, MOVENET_URL = MOVENET_VARIANTS[MOVENET_VARIANT]

# One classifier head per keypoint model: a head trained on Thunder keypoints
# misclassifies Lightning's (the web lab measured 29/32 agreement), so each
# variant has its own file and training one can't overwrite the other. Both
# share pose_labels.json. Thunder keeps the original filename.
CLASSIFIER_MODEL_PATHS = {
    "thunder": MODELS_DIR / "pose_classifier.keras",
    "lightning": MODELS_DIR / "pose_classifier_lightning.keras",
}
CLASSIFIER_MODEL_PATH = CLASSIFIER_MODEL_PATHS[MOVENET_VARIANT]

# Training images. `dataset/` is preferred; `yoga_poses/train` is the older
# layout and is still read if present. Both are gitignored (see README).
TRAIN_DATASET_DIR = BASE_DIR / "dataset"
LEGACY_TRAIN_DIR = BASE_DIR / "yoga_poses" / "train"
TEST_DATASET_DIR = BASE_DIR / "yoga_poses" / "test"

IMAGE_PATTERNS = ("*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG")
