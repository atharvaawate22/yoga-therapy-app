"""Filesystem layout for the backend.

All three entry points previously declared these paths independently. They are
resolved relative to this file, so scripts work regardless of the current
working directory.
"""

from __future__ import annotations

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

MODELS_DIR = BASE_DIR / "models"
MOVENET_MODEL_PATH = MODELS_DIR / "movenet_lightning.tflite"
CLASSIFIER_MODEL_PATH = MODELS_DIR / "pose_classifier.keras"
LABELS_PATH = MODELS_DIR / "pose_labels.json"

MOVENET_URL = (
    "https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/3"
    "?lite-format=tflite"
)

# Training images. `dataset/` is preferred; `yoga_poses/train` is the older
# layout and is still read if present. Both are gitignored (see README).
TRAIN_DATASET_DIR = BASE_DIR / "dataset"
LEGACY_TRAIN_DIR = BASE_DIR / "yoga_poses" / "train"
TEST_DATASET_DIR = BASE_DIR / "yoga_poses" / "test"

IMAGE_PATTERNS = ("*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG")
