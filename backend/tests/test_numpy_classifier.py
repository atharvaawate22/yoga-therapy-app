"""The TensorFlow-free classifier runs the real trained model."""

from __future__ import annotations

import json

import numpy as np
import pytest

from utils.model import NumpyClassifier, file_sha256
from utils.paths import CLASSIFIER_MODEL_PATH, CLASSIFIER_NPZ_PATH, LABELS_PATH


def test_npz_loads_with_numpy_alone() -> None:
    # Runs without h5py: this is the path the server takes.
    model = NumpyClassifier.from_npz(CLASSIFIER_NPZ_PATH)
    labels = json.loads(LABELS_PATH.read_text(encoding="utf-8"))

    probs = model.predict(np.zeros((1, model.input_dim), dtype=np.float32))

    assert probs.shape == (1, len(labels))


def test_committed_npz_comes_from_the_committed_keras_model() -> None:
    # Fails after the .keras file changes until `python export_classifier_npz.py`
    # is rerun (training does it automatically).
    assert NumpyClassifier.npz_source_sha256(CLASSIFIER_NPZ_PATH) == file_sha256(
        CLASSIFIER_MODEL_PATH
    )


h5py = pytest.importorskip("h5py")


def test_npz_predicts_exactly_what_the_keras_file_does() -> None:
    from_keras = NumpyClassifier.from_keras_file(CLASSIFIER_MODEL_PATH)
    from_npz = NumpyClassifier.from_npz(CLASSIFIER_NPZ_PATH)
    x = np.random.default_rng(2).normal(0, 1.5, size=(64, from_keras.input_dim)).astype(np.float32)

    np.testing.assert_array_equal(from_npz.predict(x), from_keras.predict(x))


def test_npz_round_trip(tmp_path) -> None:
    model = NumpyClassifier.from_keras_file(CLASSIFIER_MODEL_PATH)
    path = tmp_path / "head.npz"
    model.save_npz(path, "abc123")

    reloaded = NumpyClassifier.from_npz(path)

    assert NumpyClassifier.npz_source_sha256(path) == "abc123"
    assert [a for _, _, a in reloaded.layers] == [a for _, _, a in model.layers]
    for (k1, b1, _), (k2, b2, _) in zip(reloaded.layers, model.layers):
        np.testing.assert_array_equal(k1, k2)
        np.testing.assert_array_equal(b1, b2)


def test_loads_the_shipped_model_and_matches_the_label_count() -> None:
    model = NumpyClassifier.from_keras_file(CLASSIFIER_MODEL_PATH)
    labels = json.loads(LABELS_PATH.read_text(encoding="utf-8"))

    probs = model.predict(np.zeros((1, model.input_dim), dtype=np.float32))

    assert probs.shape == (1, len(labels))


def test_outputs_are_probability_distributions() -> None:
    model = NumpyClassifier.from_keras_file(CLASSIFIER_MODEL_PATH)
    x = np.random.default_rng(0).normal(0, 1.5, size=(64, model.input_dim)).astype(np.float32)

    probs = model.predict(x)

    assert np.all(probs >= 0)
    np.testing.assert_allclose(probs.sum(axis=1), 1.0, rtol=1e-5)
