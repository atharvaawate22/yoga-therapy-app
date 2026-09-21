"""Leakage-free train/validation splitting.

Two failure modes this exists to prevent:

1. **Class-block splits.** Features are appended class by class, so the matrix
   is sorted by label. Keras' ``validation_split`` takes the *last* rows
   before shuffling, which carves off whole classes: the model trains on one
   set of poses and is validated on a different set. That produces a huge
   train/val gap that looks like overfitting but is not.

2. **Near-duplicate leakage.** The dataset contains horizontal-flip twins
   (``1.jpg`` / ``1_flipped.jpg``) and consecutive video frames
   (``annotated_000001..N``, ``girl1_warrior046/048/049``). Splitting those at
   random puts near-identical poses on both sides, so validation scores
   memorization rather than generalization.

The split here is therefore **stratified** (every class on both sides) and
**grouped** (related frames never straddle the boundary).
"""

from __future__ import annotations

import logging
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import numpy as np

logger = logging.getLogger(__name__)

__all__ = [
    "DEFAULT_SEQUENCE_CHUNK",
    "SplitReport",
    "infer_group_key",
    "grouped_stratified_split",
]

# Frames whose index falls in the same chunk stay together. Large enough to
# keep a burst of consecutive frames on one side, small enough that a long
# recording still contributes to both splits.
DEFAULT_SEQUENCE_CHUNK = 25

_FLIP_SUFFIX = re.compile(r"_flipped$", re.IGNORECASE)
_TRAILING_NUMBER = re.compile(r"(\d+)$")


def infer_group_key(
    image_path: Path,
    class_label: str,
    chunk: int = DEFAULT_SEQUENCE_CHUNK,
) -> str:
    """Derive a group id so related frames are never split apart.

    ``girl1_warrior046.jpg`` and ``girl1_warrior046_flipped.jpg`` -> same group
    (a mirror of one photo). ``annotated_000001..25`` -> same group
    (consecutive frames of one recording); ``annotated_000026`` starts a new one.

    Grouping is scoped per class, since the same numbering scheme is reused
    across pose folders.
    """
    stem = _FLIP_SUFFIX.sub("", image_path.stem)

    match = _TRAILING_NUMBER.search(stem)
    if match:
        prefix = stem[: match.start()]
        index = int(match.group(1))
    else:
        prefix, index = stem, 0

    bucket = index // chunk if chunk > 0 else 0
    return f"{class_label}|{prefix}|{bucket}"


@dataclass
class SplitReport:
    """What the split actually produced — logged so it can be sanity-checked."""

    train_size: int
    val_size: int
    n_groups: int
    classes_missing_from_val: List[str]
    single_group_classes: List[str]
    per_class: Dict[str, Tuple[int, int]]  # label -> (train_n, val_n)

    @property
    def val_fraction(self) -> float:
        total = self.train_size + self.val_size
        return self.val_size / total if total else 0.0

    def format_table(self) -> str:
        width = max((len(c) for c in self.per_class), default=10)
        lines = [f"{'class'.ljust(width)}  {'train':>6} {'val':>6} {'val%':>6}"]
        lines.append("-" * len(lines[0]))
        for label in sorted(self.per_class):
            tr, va = self.per_class[label]
            pct = va / (tr + va) if (tr + va) else 0.0
            lines.append(f"{label.ljust(width)}  {tr:>6} {va:>6} {pct:>5.0%}")
        lines.append("-" * len(lines[0]))
        lines.append(
            f"{'TOTAL'.ljust(width)}  {self.train_size:>6} {self.val_size:>6} "
            f"{self.val_fraction:>5.0%}"
        )
        return "\n".join(lines)


def grouped_stratified_split(
    y: np.ndarray,
    groups: Sequence[str],
    labels: Sequence[str],
    val_fraction: float = 0.2,
    seed: int = 42,
) -> Tuple[np.ndarray, np.ndarray, SplitReport]:
    """Split indices so that each class appears on both sides and no group does.

    Groups are assigned whole. Within each class its groups are shuffled
    deterministically, then taken into validation until the target fraction of
    that class's samples is reached — so the split is stratified by class and
    grouped by source.

    Returns ``(train_idx, val_idx, report)``.
    """
    if len(groups) != len(y):
        raise ValueError(f"groups/labels length mismatch: {len(groups)} vs {len(y)}")
    if not 0.0 < val_fraction < 1.0:
        raise ValueError(f"val_fraction must be in (0, 1), got {val_fraction}")

    rng = np.random.default_rng(seed)

    # class -> group -> row indices
    by_class: Dict[int, Dict[str, List[int]]] = defaultdict(lambda: defaultdict(list))
    for row, (class_idx, group) in enumerate(zip(y, groups)):
        by_class[int(class_idx)][group].append(row)

    train_idx: List[int] = []
    val_idx: List[int] = []
    per_class: Dict[str, Tuple[int, int]] = {}
    missing_from_val: List[str] = []
    single_group: List[str] = []

    for class_idx in sorted(by_class):
        label = labels[class_idx] if class_idx < len(labels) else str(class_idx)
        group_names = sorted(by_class[class_idx])  # sorted first => seed fully determines order
        rng.shuffle(group_names)

        class_total = sum(len(by_class[class_idx][g]) for g in group_names)
        target_val = class_total * val_fraction

        if len(group_names) == 1:
            # Cannot split without putting the same source on both sides.
            # Keep it in train and say so, rather than leak silently.
            single_group.append(label)

        class_train: List[int] = []
        class_val: List[int] = []
        for group in group_names:
            rows = by_class[class_idx][group]
            # Take groups into val until the quota is met, but never take the
            # last remaining group -- every class must keep training data.
            room_left = len(class_val) < target_val
            would_empty_train = len(class_val) + len(rows) >= class_total
            if room_left and not would_empty_train:
                class_val.extend(rows)
            else:
                class_train.extend(rows)

        if not class_val:
            missing_from_val.append(label)

        train_idx.extend(class_train)
        val_idx.extend(class_val)
        per_class[label] = (len(class_train), len(class_val))

    train_arr = np.array(sorted(train_idx), dtype=np.int64)
    val_arr = np.array(sorted(val_idx), dtype=np.int64)

    report = SplitReport(
        train_size=len(train_arr),
        val_size=len(val_arr),
        n_groups=sum(len(by_class[c]) for c in by_class),
        classes_missing_from_val=missing_from_val,
        single_group_classes=single_group,
        per_class=per_class,
    )

    if missing_from_val:
        logger.warning(
            "%d class(es) have too few independent groups to appear in "
            "validation: %s",
            len(missing_from_val),
            missing_from_val,
        )
    logger.info(
        "Split: %d train / %d val (%.1f%%) across %d groups",
        report.train_size,
        report.val_size,
        report.val_fraction * 100,
        report.n_groups,
    )
    return train_arr, val_arr, report
