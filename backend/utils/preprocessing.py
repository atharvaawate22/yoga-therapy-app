"""Image -> feature vector. Shared by the server, the trainer and the evaluator.

This module exists to eliminate train/serve skew. Every step between a decoded
image and the 34-value vector handed to the classifier lives here exactly once,
so the trainer physically cannot preprocess differently from the server.

Deliberately free of TensorFlow: only numpy and OpenCV. That keeps the unit
tests fast and lets the API be imported without the ML runtime present.
"""

from __future__ import annotations

from typing import Tuple

import cv2
import numpy as np

__all__ = [
    "FEATURE_DIM",
    "NUM_KEYPOINTS",
    "KEYPOINT_NAMES",
    "SKELETON_EDGES",
    "SKELETON_DRAW_MIN_SCORE",
    "pad_to_square",
    "preprocess_for_movenet",
    "extract_keypoints_pixels",
    "normalize_keypoints",
    "has_body",
]

NUM_KEYPOINTS = 17
FEATURE_DIM = NUM_KEYPOINTS * 2  # (x, y) per keypoint, flattened -> 34

KEYPOINT_NAMES = (
    "nose",
    "left_eye",
    "right_eye",
    "left_ear",
    "right_ear",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
    "left_ankle",
    "right_ankle",
)

# Named indices, so the geometry below reads as anatomy rather than magic numbers.
LEFT_SHOULDER, RIGHT_SHOULDER = 5, 6
LEFT_HIP, RIGHT_HIP = 11, 12

SKELETON_EDGES = (
    (0, 1), (0, 2), (1, 3), (2, 4), (0, 5), (0, 6),
    (5, 7), (7, 9), (6, 8), (8, 10), (5, 6), (5, 11),
    (6, 12), (11, 12), (11, 13), (13, 15), (12, 14), (14, 16),
)

# Visualization only: which joints/limbs are confident enough to draw.
SKELETON_DRAW_MIN_SCORE = 0.25

# ── Body-presence gate ────────────────────────────────────────────────────
# A single gate for training and inference. Previously the trainer demanded all
# nine major keypoints at >=0.25 while the server accepted a looser set, so the
# model was fit on pristine detections and then served noisier ones.
#
# The looser (serving) gate won: training data must reflect what the model will
# actually be asked to classify in production. Tightening these values makes
# both training and inference stricter together — they can no longer diverge.
CORE_KEYPOINTS = (LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP)
MAJOR_KEYPOINTS = (0, 5, 6, 11, 12, 13, 14, 15, 16)
CORE_MIN_SCORE = 0.20
MAJOR_MIN_SCORE = 0.15
MIN_MAJOR_VISIBLE = 7


def pad_to_square(image: np.ndarray) -> np.ndarray:
    """Pad the image to the smallest centered square, preserving every pixel.

    MoveNet wants a square input. A full-body photo shot in portrait (the
    normal way to frame a standing pose on a phone) fills nearly the entire
    vertical frame, so center-*cropping* to a square reliably chopped off
    the head and/or feet before MoveNet ever saw them -- the classifier's
    body-presence gate then rejected the frame outright. Padding instead of
    cropping keeps the full body in view. Downstream keypoint normalization
    is translation- and scale-invariant (relative to the hip midpoint and
    torso width), so it is unaffected by the extra border.
    """
    height, width = image.shape[:2]
    side = max(height, width)
    pad_vertical = side - height
    pad_horizontal = side - width
    top = pad_vertical // 2
    bottom = pad_vertical - top
    left = pad_horizontal // 2
    right = pad_horizontal - left
    return cv2.copyMakeBorder(
        image, top, bottom, left, right, cv2.BORDER_CONSTANT, value=(114, 114, 114)
    )


def preprocess_for_movenet(image_bgr: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    """Take a decoded BGR image to the exact tensor-ready RGB square.

    Returns ``(padded_bgr, padded_rgb)`` — the BGR copy is what skeleton
    overlays get drawn on, so debug images line up with the analyzed pixels.

    Call this from every entry point. It is the anti-skew contract.
    """
    padded_bgr = pad_to_square(image_bgr)
    padded_rgb = cv2.cvtColor(padded_bgr, cv2.COLOR_BGR2RGB)
    return padded_bgr, padded_rgb


def extract_keypoints_pixels(output: np.ndarray, width: int, height: int) -> np.ndarray:
    """Convert MoveNet's ``[17, 3]`` output to pixel-space ``[x, y, score]``.

    MoveNet emits ``(y, x, score)`` normalized to [0, 1]; the axis swap here is
    a frequent source of silent bugs, so it happens in one place only.
    """
    keypoints = np.zeros((NUM_KEYPOINTS, 3), dtype=np.float32)
    for idx in range(NUM_KEYPOINTS):
        y, x, score = output[idx]
        keypoints[idx] = np.array([x * width, y * height, score], dtype=np.float32)
    return keypoints


def normalize_keypoints(keypoints: np.ndarray) -> np.ndarray:
    """Flatten keypoints into a translation- and scale-invariant 34-vector.

    Origin is the hip midpoint and the unit is torso width, so the same pose
    yields the same features regardless of where the person stands in frame or
    how far they are from the camera.
    """
    left_hip = keypoints[LEFT_HIP, :2]
    right_hip = keypoints[RIGHT_HIP, :2]
    hip_mid = (left_hip + right_hip) / 2.0

    left_shoulder = keypoints[LEFT_SHOULDER, :2]
    right_shoulder = keypoints[RIGHT_SHOULDER, :2]
    torso = max(
        float(np.linalg.norm(left_shoulder - right_shoulder)),
        float(np.linalg.norm(left_hip - right_hip)),
    )

    # Degenerate case (person facing exactly sideways, or a bad detection):
    # fall back to the keypoint bounding box so we never divide by ~0.
    if torso < 1e-6:
        xy = keypoints[:, :2]
        span = np.max(xy, axis=0) - np.min(xy, axis=0)
        torso = float(max(span[0], span[1], 1.0))

    normalized = (keypoints[:, :2] - hip_mid) / torso
    return normalized.astype(np.float32).reshape(-1)


def has_body(keypoints: np.ndarray) -> bool:
    """Whether enough of a body is visible to be worth classifying.

    Requires a confident torso (both shoulders and both hips) plus a majority
    of the major landmarks. Rejecting here is much cheaper than letting the
    classifier produce a confident-looking answer from half a person.
    """
    core_visible = all(
        float(keypoints[idx, 2]) >= CORE_MIN_SCORE for idx in CORE_KEYPOINTS
    )
    major_visible = sum(
        float(keypoints[idx, 2]) >= MAJOR_MIN_SCORE for idx in MAJOR_KEYPOINTS
    )
    return bool(core_visible and major_visible >= MIN_MAJOR_VISIBLE)
