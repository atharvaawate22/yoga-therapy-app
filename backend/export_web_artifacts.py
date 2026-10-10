"""Export the pose classifiers for the web app (packages/pose-core).

    python export_web_artifacts.py

Writes each MoveNet variant's trained MLP head (utils.paths.CLASSIFIER_MODEL_PATHS) as JSON:
its labels, Dense layer weights and the Python thresholds the TypeScript port
must share. The weights are read with the same NumpyClassifier the server
uses, so the browser runs exactly the served model. The source file's
SHA-256 is recorded so a stale export can be detected.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np

import yoga_pose_engine as engine
from utils import preprocessing
from utils.model import NumpyClassifier, load_labels
from utils.paths import BASE_DIR, CLASSIFIER_MODEL_PATHS

DEFAULT_OUT_DIR = BASE_DIR.parent / "packages" / "pose-core" / "models"


def float32_list(array: np.ndarray) -> list:
    """Values that round-trip exactly to the same float32 (9 significant digits)."""
    return [float(f"{v:.9g}") for v in np.asarray(array, dtype=np.float32).reshape(-1)]


def build_artifact(variant: str = "thunder") -> dict:
    model_path = CLASSIFIER_MODEL_PATHS[variant]
    classifier = NumpyClassifier.from_keras_file(model_path)
    labels = load_labels()
    layers = []
    for kernel, bias, activation in classifier.layers:
        layers.append(
            {
                "inputs": int(kernel.shape[0]),
                "units": int(kernel.shape[1]),
                "activation": activation,
                # Row-major [inputs][units], flattened.
                "kernel": float32_list(kernel),
                "bias": float32_list(bias),
            }
        )
    if layers[-1]["units"] != len(labels):
        raise ValueError("Output layer size doesn't match pose_labels.json")
    return {
        "description": "Pose classifier exported by backend/export_web_artifacts.py. Do not edit.",
        "sourceFile": model_path.name,
        "sourceSha256": hashlib.sha256(model_path.read_bytes()).hexdigest(),
        "movenetVariant": variant,
        "labels": labels,
        "thresholds": {
            "minClassProb": engine.MIN_CLASS_PROB,
            "minClassProbLive": engine.MIN_CLASS_PROB_LIVE,
            "stabilityWindow": engine.STABILITY_WINDOW,
            "stabilityMinVotes": engine.STABILITY_MIN_VOTES,
            "coreMinScore": preprocessing.CORE_MIN_SCORE,
            "majorMinScore": preprocessing.MAJOR_MIN_SCORE,
            "minMajorVisible": preprocessing.MIN_MAJOR_VISIBLE,
            "coreKeypoints": list(preprocessing.CORE_KEYPOINTS),
            "majorKeypoints": list(preprocessing.MAJOR_KEYPOINTS),
            "ruleMinKeypointScore": engine.RULE_MIN_KEYPOINT_SCORE,
        },
        "layers": layers,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    for variant in CLASSIFIER_MODEL_PATHS:
        artifact = build_artifact(variant)
        out = args.out_dir / f"classifier.{variant}.json"
        out.write_text(json.dumps(artifact, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"Wrote {out} ({out.stat().st_size // 1024} KB, {len(artifact['labels'])} labels)")


if __name__ == "__main__":
    main()
