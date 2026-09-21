"""MoveNet SinglePose Lightning (TFLite) wrapper.

The server, the trainer and the evaluator all run keypoint extraction through
this one class, so resize interpolation and input dtype handling cannot drift
between them.

TensorFlow is imported lazily inside ``MoveNetRuntime.__init__`` rather than at
module scope. That keeps ``import utils.movenet`` (and therefore importing the
FastAPI app) free of a ~600 MB dependency, so the unit tests run without the ML
runtime installed.
"""

from __future__ import annotations

import logging
import urllib.request
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from .paths import MOVENET_MODEL_PATH, MOVENET_URL, MODELS_DIR

logger = logging.getLogger(__name__)

__all__ = ["MoveNetRuntime", "ensure_movenet_model"]


def ensure_movenet_model(model_path: Path = MOVENET_MODEL_PATH) -> Path:
    """Download the TFLite model on first use if it is not already vendored."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    if model_path.exists():
        return model_path
    logger.info("MoveNet model missing at %s — downloading", model_path)
    urllib.request.urlretrieve(MOVENET_URL, str(model_path))
    logger.info("MoveNet model downloaded (%d bytes)", model_path.stat().st_size)
    return model_path


class MoveNetRuntime:
    """Holds the allocated TFLite interpreter. Construct once, reuse forever."""

    def __init__(self, model_path: Optional[Path] = None) -> None:
        import tensorflow as tf  # noqa: PLC0415 - deliberately lazy, see module docstring

        resolved = ensure_movenet_model(model_path or MOVENET_MODEL_PATH)
        self.interpreter = tf.lite.Interpreter(model_path=str(resolved))
        self.interpreter.allocate_tensors()
        self.input_details = self.interpreter.get_input_details()[0]
        self.output_details = self.interpreter.get_output_details()[0]
        self.input_size = int(self.input_details["shape"][1])
        logger.info(
            "MoveNet ready (input_size=%d, dtype=%s)",
            self.input_size,
            np.dtype(self.input_details["dtype"]).name,
        )

    def infer(self, image_rgb: np.ndarray) -> np.ndarray:
        """Run keypoint detection. Returns the raw ``[17, 3]`` (y, x, score) block.

        Expects an already square-cropped RGB image — see
        ``utils.preprocessing.preprocess_for_movenet``.
        """
        resized = cv2.resize(
            image_rgb,
            (self.input_size, self.input_size),
            interpolation=cv2.INTER_AREA,
        )
        expected_dtype = self.input_details["dtype"]
        input_tensor = np.expand_dims(resized.astype(expected_dtype), axis=0)

        self.interpreter.set_tensor(self.input_details["index"], input_tensor)
        self.interpreter.invoke()
        output = self.interpreter.get_tensor(self.output_details["index"])
        return output[0, 0, :, :]
