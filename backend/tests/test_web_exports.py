"""Exports consumed by the web app (export_web_artifacts.py, export_lab_fixtures.py)."""

from __future__ import annotations

import json

import numpy as np
import pytest

from utils.model import NumpyClassifier
from utils.paths import BASE_DIR, CLASSIFIER_MODEL_PATH

pytest.importorskip("h5py")
pytest.importorskip("PIL")

import export_lab_fixtures as fixtures  # noqa: E402
import export_web_artifacts as artifacts  # noqa: E402

COMMITTED_ARTIFACT = BASE_DIR.parent / "packages" / "pose-core" / "models" / "classifier.thunder.json"


def test_artifact_reproduces_the_served_classifier() -> None:
    artifact = artifacts.build_artifact()
    served = NumpyClassifier.from_keras_file(CLASSIFIER_MODEL_PATH)
    x = np.random.default_rng(1).normal(0, 1.5, size=(32, served.input_dim)).astype(np.float32)

    out = x
    for layer in artifact["layers"]:
        kernel = np.asarray(layer["kernel"], dtype=np.float32).reshape(layer["inputs"], layer["units"])
        out = out @ kernel + np.asarray(layer["bias"], dtype=np.float32)
        if layer["activation"] == "relu":
            out = np.maximum(out, 0)
        elif layer["activation"] == "softmax":
            out = np.exp(out - out.max(axis=1, keepdims=True))
            out /= out.sum(axis=1, keepdims=True)

    np.testing.assert_allclose(out, served.predict(x), rtol=1e-6, atol=1e-7)


def test_committed_artifact_is_current() -> None:
    # Fails after retraining until `python export_web_artifacts.py` is rerun.
    committed = json.loads(COMMITTED_ARTIFACT.read_text(encoding="utf-8"))
    assert committed == artifacts.build_artifact()


def test_artifact_carries_the_server_thresholds() -> None:
    thresholds = artifacts.build_artifact()["thresholds"]
    assert thresholds["minClassProb"] == 0.70
    assert thresholds["stabilityWindow"] == 5
    assert thresholds["coreKeypoints"] == [5, 6, 11, 12]


@pytest.mark.parametrize(
    ("license_name", "allowed"),
    [
        ("CC0", True),
        ("Public domain", True),
        ("CC BY 4.0", True),
        ("CC BY-SA 4.0", False),  # share-alike
        ("GPL", False),
        ("GODL-India", False),
    ],
)
def test_only_permissive_licences_are_redistributed(license_name: str, allowed: bool) -> None:
    assert fixtures.is_allowed_license(license_name) is allowed


def test_selection_caps_each_label_and_skips_share_alike() -> None:
    rows = [
        {"label": "tree_pose", "license": "CC BY-SA 3.0", "file": "a"},
        {"label": "tree_pose", "license": "CC0", "file": "b"},
        {"label": "tree_pose", "license": "CC BY 2.0", "file": "c"},
        {"label": "tree_pose", "license": "CC BY 4.0", "file": "d"},
        {"label": "boat_pose", "license": "Public domain", "file": "e"},
    ]
    picked = fixtures.select_images(rows, per_label=2)
    assert [r["file"] for r in picked] == ["e", "b", "c"]


def test_float32_values_round_trip_exactly() -> None:
    values = np.random.default_rng(2).normal(size=100).astype(np.float32)
    assert np.array_equal(np.asarray(fixtures.f32(values), dtype=np.float32), values)
