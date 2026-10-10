"""Exports consumed by the web app (export_web_artifacts.py, export_lab_fixtures.py)."""

from __future__ import annotations

import json

import numpy as np
import pytest

from utils.model import NumpyClassifier
from utils.paths import BASE_DIR, CLASSIFIER_MODEL_PATHS

pytest.importorskip("h5py")
pytest.importorskip("PIL")

import export_lab_fixtures as fixtures  # noqa: E402
import export_web_artifacts as artifacts  # noqa: E402

ARTIFACT_DIR = BASE_DIR.parent / "packages" / "pose-core" / "models"
VARIANTS = sorted(CLASSIFIER_MODEL_PATHS)


@pytest.mark.parametrize("variant", VARIANTS)
def test_artifact_reproduces_the_classifier(variant: str) -> None:
    artifact = artifacts.build_artifact(variant)
    served = NumpyClassifier.from_keras_file(CLASSIFIER_MODEL_PATHS[variant])
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


@pytest.mark.parametrize("variant", VARIANTS)
def test_committed_artifact_is_current(variant: str) -> None:
    # Fails after retraining until `python export_web_artifacts.py` is rerun.
    path = ARTIFACT_DIR / f"classifier.{variant}.json"
    assert json.loads(path.read_text(encoding="utf-8")) == artifacts.build_artifact(variant)


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


# ── Golden parity fixtures (export_parity_fixtures.py) ─────────────────────

import gzip  # noqa: E402

import export_parity_fixtures as parity  # noqa: E402

PARITY_FIXTURE = BASE_DIR.parent / "packages" / "pose-core" / "fixtures" / "parity.json.gz"


def test_parity_fixtures_are_current() -> None:
    # Fails when the pose logic or models change until
    # `python export_parity_fixtures.py` is rerun (pose-core replays them).
    committed = json.loads(gzip.decompress(PARITY_FIXTURE.read_bytes()))
    assert committed["sources"] == {path: parity.source_hash(path) for path in parity.SOURCES}


def test_parity_generation_is_deterministic_and_complete() -> None:
    first = parity.build(seed=7, correction_count=5, pipeline_count=6, vote_count=4)
    second = parity.build(seed=7, correction_count=5, pipeline_count=6, vote_count=4)
    # Vote cases use random session ids internally but the same outputs.
    assert first == second
    poses = first["poses"]
    case = first["correctionCases"][0]
    assert len(case["corrections"]) == len(poses)
    assert all(len(per_pose) == len(parity.LEVELS) for per_pose in case["corrections"])
    assert set(first["pipelineCases"]) == {"thunder", "lightning"}


def test_hashes_ignore_line_endings(tmp_path, monkeypatch) -> None:
    (tmp_path / "a.py").write_bytes(b"x = 1\r\ny = 2\r\n")
    (tmp_path / "b.py").write_bytes(b"x = 1\ny = 2\n")
    monkeypatch.setattr(parity, "REPO", tmp_path)
    assert parity.source_hash("a.py") == parity.source_hash("b.py")
