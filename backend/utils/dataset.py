"""Turn folders of labelled images into a feature matrix.

Used by the trainer, the evaluator and the server's bootstrap fallback, so the
feature extraction applied to training images is byte-for-byte the same code
the server applies to a camera frame.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

import cv2
import numpy as np

from .label_utils import is_excluded_label, normalize_label
from .paths import IMAGE_PATTERNS, LEGACY_TRAIN_DIR, TRAIN_DATASET_DIR
from .preprocessing import (
    extract_keypoints_pixels,
    has_body,
    normalize_keypoints,
    preprocess_for_movenet,
)
from .splits import DEFAULT_SEQUENCE_CHUNK, infer_group_key

logger = logging.getLogger(__name__)

__all__ = [
    "DatasetStats",
    "FeatureSet",
    "discover_class_dirs",
    "build_feature_dataset",
]


@dataclass
class DatasetStats:
    """Retention accounting — how much of the raw data survived extraction."""

    total_images: int = 0
    kept: int = 0
    skipped_unreadable: int = 0
    skipped_no_body: int = 0
    skipped_excluded_class: int = 0
    per_class_kept: Dict[str, int] = field(default_factory=dict)

    @property
    def retention_rate(self) -> float:
        return self.kept / self.total_images if self.total_images else 0.0

    def summary(self) -> str:
        parts = [
            f"{self.kept}/{self.total_images} samples kept "
            f"({self.retention_rate:.1%})",
            f"{self.skipped_no_body} no-body",
            f"{self.skipped_unreadable} unreadable",
        ]
        if self.skipped_excluded_class:
            parts.append(f"{self.skipped_excluded_class} in excluded classes")
        return f"{parts[0]}; " + ", ".join(parts[1:])


@dataclass
class FeatureSet:
    """Extracted features plus everything needed to split them safely."""

    x: np.ndarray  # [n, 34]
    y: np.ndarray  # [n] class indices into `labels`
    labels: List[str]
    groups: np.ndarray  # [n] source-group id per row, for leakage-free splits
    stats: "DatasetStats"

    def __len__(self) -> int:
        return int(self.x.shape[0])

    @property
    def is_empty(self) -> bool:
        return self.x.size == 0


def _iter_images(class_dir: Path) -> List[Path]:
    paths: List[Path] = []
    for pattern in IMAGE_PATTERNS:
        paths.extend(sorted(class_dir.glob(pattern)))
    # Case-insensitive filesystems (Windows/macOS) match e.g. *.jpg and *.JPG
    # against the same file, which would duplicate every sample.
    unique = sorted({p.resolve() for p in paths})
    return unique


def _root_has_images(root: Path) -> bool:
    return any(any(root.glob(f"**/{pattern}")) for pattern in IMAGE_PATTERNS)


def discover_class_dirs(roots: Optional[Sequence[Path]] = None) -> List[Path]:
    """Find per-class subdirectories under the first roots that contain images."""
    candidates = list(roots) if roots is not None else [TRAIN_DATASET_DIR, LEGACY_TRAIN_DIR]
    class_dirs: List[Path] = []
    for root in candidates:
        if not root.exists() or not _root_has_images(root):
            continue
        class_dirs.extend(d for d in sorted(root.iterdir()) if d.is_dir())
    return class_dirs


def build_feature_dataset(
    movenet,
    roots: Optional[Sequence[Path]] = None,
    limit_per_class: Optional[int] = None,
    log_every: int = 500,
    sequence_chunk: int = DEFAULT_SEQUENCE_CHUNK,
) -> FeatureSet:
    """Extract normalized keypoint features for every labelled image.

    ``movenet`` is any object exposing ``infer(image_rgb) -> [17, 3]`` — the
    real runtime in production, a stub in tests.

    Each row carries a group id derived from its filename so the caller can
    split without putting flip-twins or adjacent video frames on both sides.
    """
    class_dirs = discover_class_dirs(roots)
    stats = DatasetStats()

    def _empty(labels: Optional[List[str]] = None) -> FeatureSet:
        return FeatureSet(
            x=np.empty((0, 0), np.float32),
            y=np.empty((0,), np.int32),
            labels=labels or [],
            groups=np.empty((0,), dtype=object),
            stats=stats,
        )

    if not class_dirs:
        logger.warning("No class directories found under %s", roots or "default roots")
        return _empty()

    # Folder names are normalized first, so `triangle/` and `traingle/` collapse
    # into a single class instead of training two competing ones. Excluded
    # labels (e.g. `no_pose`) are dropped here so they never reach the softmax.
    excluded_dirs = [d for d in class_dirs if is_excluded_label(normalize_label(d.name))]
    if excluded_dirs:
        logger.info(
            "Skipping %d excluded class dir(s): %s",
            len(excluded_dirs),
            [d.name for d in excluded_dirs],
        )
        for class_dir in excluded_dirs:
            skipped = len(_iter_images(class_dir))
            stats.total_images += skipped
            stats.skipped_excluded_class += skipped
        class_dirs = [d for d in class_dirs if d not in excluded_dirs]

    if not class_dirs:
        logger.warning("Every discovered class directory was excluded")
        return _empty()

    labels = sorted({normalize_label(d.name) for d in class_dirs})
    label_to_idx = {label: idx for idx, label in enumerate(labels)}

    x_data: List[np.ndarray] = []
    y_data: List[int] = []
    group_data: List[str] = []

    for class_dir in class_dirs:
        label = normalize_label(class_dir.name)
        label_idx = label_to_idx[label]
        image_paths = _iter_images(class_dir)
        if limit_per_class is not None:
            image_paths = image_paths[:limit_per_class]

        for image_path in image_paths:
            stats.total_images += 1
            image_bgr = cv2.imread(str(image_path))
            if image_bgr is None:
                stats.skipped_unreadable += 1
                continue

            # Identical to the serving path — this is the skew fix.
            _, image_rgb = preprocess_for_movenet(image_bgr)
            output = movenet.infer(image_rgb)
            keypoints = extract_keypoints_pixels(
                output, image_rgb.shape[1], image_rgb.shape[0]
            )
            if not has_body(keypoints):
                stats.skipped_no_body += 1
                continue

            x_data.append(normalize_keypoints(keypoints))
            y_data.append(label_idx)
            group_data.append(infer_group_key(image_path, label, sequence_chunk))
            stats.kept += 1
            stats.per_class_kept[label] = stats.per_class_kept.get(label, 0) + 1

            if log_every and stats.total_images % log_every == 0:
                logger.info("Extracted %s", stats.summary())

    logger.info("Feature extraction complete: %s", stats.summary())

    if not x_data:
        return _empty(labels)

    return FeatureSet(
        x=np.array(x_data, dtype=np.float32),
        y=np.array(y_data, dtype=np.int32),
        labels=labels,
        groups=np.array(group_data, dtype=object),
        stats=stats,
    )
