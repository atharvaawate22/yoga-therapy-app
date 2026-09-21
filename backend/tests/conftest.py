"""Shared pytest fixtures.

The suite runs without TensorFlow. Both model runtimes are injected as FastAPI
dependencies, so tests substitute deterministic stubs through
``app.dependency_overrides`` and exercise the real routing, validation,
gating, stability and correction logic at unit-test speed.
"""

from __future__ import annotations

import base64
import sys
from pathlib import Path
from typing import Dict, List, Optional

import cv2
import numpy as np
import pytest

# Entry points are run from `backend/` (uvicorn yoga_pose_engine:app), so make
# that importable regardless of where pytest was invoked from.
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient  # noqa: E402

import yoga_pose_engine as engine  # noqa: E402

NUM_KEYPOINTS = 17


# ── Fake MoveNet output builders ──────────────────────────────────────────


def make_movenet_output(
    score: float = 0.9,
    overrides: Optional[Dict[int, tuple]] = None,
) -> np.ndarray:
    """Build a MoveNet-shaped ``[17, 3]`` block of ``(y, x, score)`` in [0, 1].

    Joints are laid out as a plausible upright body so that torso width is
    non-zero and the normalization step is exercised for real.
    """
    # (y, x) roughly: head top, shoulders mid, hips centre, legs below.
    layout = [
        (0.10, 0.50),  # nose
        (0.08, 0.47), (0.08, 0.53),  # eyes
        (0.09, 0.44), (0.09, 0.56),  # ears
        (0.25, 0.38), (0.25, 0.62),  # shoulders
        (0.38, 0.32), (0.38, 0.68),  # elbows
        (0.50, 0.28), (0.50, 0.72),  # wrists
        (0.55, 0.42), (0.55, 0.58),  # hips
        (0.75, 0.41), (0.75, 0.59),  # knees
        (0.92, 0.40), (0.92, 0.60),  # ankles
    ]
    output = np.zeros((NUM_KEYPOINTS, 3), dtype=np.float32)
    for idx, (y, x) in enumerate(layout):
        output[idx] = (y, x, score)
    for idx, value in (overrides or {}).items():
        output[idx] = value
    return output


class StubMoveNet:
    """Stands in for ``MoveNetRuntime``; returns a canned detection."""

    def __init__(self, output: Optional[np.ndarray] = None) -> None:
        self.output = make_movenet_output() if output is None else output
        self.calls = 0

    def infer(self, image_rgb: np.ndarray) -> np.ndarray:
        self.calls += 1
        return self.output


class StubClassifier:
    """Stands in for ``ClassifierRuntime`` with a fixed probability vector."""

    def __init__(self, probabilities: Optional[Dict[str, float]] = None) -> None:
        self.probabilities = (
            {"warrior_pose": 0.95, "tree_pose": 0.03, "chair_pose": 0.02}
            if probabilities is None
            else probabilities
        )
        self.labels: List[str] = list(self.probabilities)

    def ready(self) -> bool:
        return bool(self.probabilities)

    def predict(self, normalized_flat: np.ndarray) -> Dict[str, float]:
        assert normalized_flat.shape == (34,), "classifier expects a 34-vector"
        return dict(self.probabilities)


# ── Fixtures ──────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _reset_engine_state():
    """Clear cached runtimes and per-session vote history between tests."""
    engine.reset_runtimes()
    yield
    engine.reset_runtimes()
    engine.app.dependency_overrides.clear()


@pytest.fixture
def sample_image_base64() -> str:
    """A real, decodable JPEG (content is irrelevant — MoveNet is stubbed)."""
    image = np.full((480, 640, 3), 127, dtype=np.uint8)
    ok, encoded = cv2.imencode(".jpg", image)
    assert ok
    return base64.b64encode(encoded.tobytes()).decode("ascii")


@pytest.fixture
def make_client():
    """Build a TestClient with the given MoveNet/classifier stubs injected."""

    def _make(movenet=None, classifier=None) -> TestClient:
        engine.app.dependency_overrides[engine.get_movenet] = lambda: (
            movenet or StubMoveNet()
        )
        engine.app.dependency_overrides[engine.get_classifier] = lambda: (
            classifier or StubClassifier()
        )
        return TestClient(engine.app)

    return _make


@pytest.fixture
def client(make_client) -> TestClient:
    return make_client()
