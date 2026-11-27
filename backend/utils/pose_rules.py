"""Geometry rules applied on top of the classifier's probabilities.

Upward dog vs cobra. Both are prone backbends with the hands under the
shoulders; upward dog lifts the hips and thighs off the floor, cobra keeps
the pelvis down. The classifier can't learn this: the training set has only
61 genuine upward-dog samples (augmented copies of ~14 photos) against 615
cobra, and even oversampled 8x it got 0-1 of 6 Wikimedia upward-dog photos.
So when the classifier says cobra and the body is clearly lifted, the
prediction becomes upward dog.

The elbow / hip / knee-lift thresholds were fit on the *training* features
only (best upward-dog recall with at most 5% of training cobras flagged).
Elbow angle alone doesn't separate the poses -- real photos of "high cobra"
have straight arms too -- so hip and knee lift carry the rule.

Two limits keep it off Ashwa Sanchalanasana (the Surya Namaskar lunge, hands
down, chest up), which the classifier also tends to call cobra: both knees
must be fairly straight (a lunge's front knee is bent, median 65 degrees), and
the hips can't be higher than any training upward dog (max 0.58 torso
lengths; front-on lunge photos hide the bent leg, but their hips sit at
0.56-0.73). Both were added after a first version flagged Wikimedia lunge
photos, and both are set from training data: on it the rule finds 21/61
upward dogs and flags 27/615 cobras, 0/47 lunges and 0/192 low lunges.

Mirrored in TypeScript by packages/pose-core/src/rules.ts; the thresholds are
exported with the classifier (export_web_artifacts.py).
"""

from __future__ import annotations

from typing import Sequence, Tuple

import numpy as np

from .preprocessing import NUM_KEYPOINTS

__all__ = [
    "UPWARD_DOG_MIN_ELBOW_DEG",
    "UPWARD_DOG_MIN_HIP_LIFT",
    "UPWARD_DOG_MIN_KNEE_LIFT",
    "UPWARD_DOG_MAX_HIP_LIFT",
    "UPWARD_DOG_MIN_KNEE_DEG",
    "prone_lift",
    "min_knee_angle",
    "looks_like_upward_dog",
    "apply_pose_rules",
]

UPWARD_DOG_MIN_ELBOW_DEG = 145.0
UPWARD_DOG_MIN_HIP_LIFT = 0.325
UPWARD_DOG_MIN_KNEE_LIFT = 0.04
UPWARD_DOG_MAX_HIP_LIFT = 0.60
UPWARD_DOG_MIN_KNEE_DEG = 120.0

# (shoulder, elbow, wrist, hip, knee, ankle) per side.
_SIDES = ((5, 7, 9, 11, 13, 15), (6, 8, 10, 12, 14, 16))


def _angle(a: np.ndarray, vertex: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Angle a-vertex-b in degrees, per row."""
    u, v = a - vertex, b - vertex
    cos = (u * v).sum(1) / (np.linalg.norm(u, axis=1) * np.linalg.norm(v, axis=1) + 1e-9)
    return np.degrees(np.arccos(np.clip(cos, -1.0, 1.0)))


def prone_lift(features: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Elbow angle (degrees), hip lift and knee lift, averaged over both sides.

    ``features`` is one ``(34,)`` vector or an ``(n, 34)`` batch from
    ``normalize_keypoints``. The floor is taken as the line through the wrist
    and ankle (both on the floor in either pose); lift is the hip's / knee's
    height above it, in units of that side's shoulder-to-hip length.
    """
    k = np.asarray(features, dtype=np.float64).reshape(-1, NUM_KEYPOINTS, 2)
    elbows, hips, knees = [], [], []
    for sh, el, wr, hip, kn, an in _SIDES:
        elbows.append(_angle(k[:, sh], k[:, el], k[:, wr]))

        floor = k[:, an] - k[:, wr]
        normal = np.stack([floor[:, 1], -floor[:, 0]], axis=1)
        normal /= np.linalg.norm(normal, axis=1, keepdims=True) + 1e-9
        # Point the normal up the image (image y grows downward).
        normal *= np.where(normal[:, 1:2] > 0, -1.0, 1.0)
        torso = np.linalg.norm(k[:, sh] - k[:, hip], axis=1) + 1e-9
        hips.append(((k[:, hip] - k[:, wr]) * normal).sum(1) / torso)
        knees.append(((k[:, kn] - k[:, wr]) * normal).sum(1) / torso)
    return np.mean(elbows, 0), np.mean(hips, 0), np.mean(knees, 0)


def min_knee_angle(features: np.ndarray) -> np.ndarray:
    """The more bent of the two knees (hip-knee-ankle angle, degrees)."""
    k = np.asarray(features, dtype=np.float64).reshape(-1, NUM_KEYPOINTS, 2)
    return np.minimum(_angle(k[:, 11], k[:, 13], k[:, 15]), _angle(k[:, 12], k[:, 14], k[:, 16]))


def looks_like_upward_dog(features: np.ndarray) -> np.ndarray:
    """Boolean per sample: straight-ish arms and legs, hips and knees off the floor."""
    elbow, hip, knee = prone_lift(features)
    return (
        (elbow >= UPWARD_DOG_MIN_ELBOW_DEG)
        & (hip >= UPWARD_DOG_MIN_HIP_LIFT)
        & (hip <= UPWARD_DOG_MAX_HIP_LIFT)
        & (knee >= UPWARD_DOG_MIN_KNEE_LIFT)
        & (min_knee_angle(features) >= UPWARD_DOG_MIN_KNEE_DEG)
    )


def apply_pose_rules(
    features: np.ndarray, probs: np.ndarray, labels: Sequence[str]
) -> np.ndarray:
    """Return ``probs`` with the upward-dog rule applied (input untouched).

    Where cobra is the top class and the body is lifted, the cobra and
    upward-dog probabilities swap places, so upward dog becomes the answer
    with the confidence cobra had and the distribution still sums to 1.
    ``probs`` is ``(C,)`` or ``(n, C)`` in ``labels`` order.
    """
    out = np.array(probs, dtype=np.float32, copy=True)
    if "cobra_pose" not in labels or "upward_dog" not in labels:
        return out
    cobra, updog = list(labels).index("cobra_pose"), list(labels).index("upward_dog")
    batch = out.reshape(-1, len(labels))
    fire = (batch.argmax(1) == cobra) & looks_like_upward_dog(features)
    batch[fire, cobra], batch[fire, updog] = batch[fire, updog], batch[fire, cobra].copy()
    return batch.reshape(out.shape)
