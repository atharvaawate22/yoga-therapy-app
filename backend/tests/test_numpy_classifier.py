"""The TensorFlow-free classifier runs the real trained model."""

from __future__ import annotations

import json

import numpy as np
import pytest

from utils.model import NumpyClassifier
from utils.paths import CLASSIFIER_MODEL_PATH, LABELS_PATH

h5py = pytest.importorskip("h5py")


def test_loads_the_shipped_model_and_matches_the_label_count() -> None:
    model = NumpyClassifier.from_keras_file(CLASSIFIER_MODEL_PATH)
    labels = json.loads(LABELS_PATH.read_text(encoding="utf-8"))

    probs = model.predict(np.zeros((1, 34), dtype=np.float32))

    assert probs.shape == (1, len(labels))


def test_outputs_are_probability_distributions() -> None:
    model = NumpyClassifier.from_keras_file(CLASSIFIER_MODEL_PATH)
    x = np.random.default_rng(0).normal(0, 1.5, size=(64, 34)).astype(np.float32)

    probs = model.predict(x)

    assert np.all(probs >= 0)
    np.testing.assert_allclose(probs.sum(axis=1), 1.0, rtol=1e-5)
