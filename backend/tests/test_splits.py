"""Train/validation splitting — the guarantees that make the val curve mean something.

Two bugs are pinned here:
  * validation made of classes absent from training (Keras `validation_split`
    on a class-ordered matrix),
  * near-duplicate frames straddling the boundary (flip twins, video runs).
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from utils.splits import (
    DEFAULT_SEQUENCE_CHUNK,
    grouped_stratified_split,
    infer_group_key,
)


# ── Group inference ───────────────────────────────────────────────────────


def test_flip_twin_shares_its_original_group() -> None:
    """`X_flipped` is a mirror of `X`; splitting them apart leaks the pose."""
    original = infer_group_key(Path("girl1_warrior046.jpg"), "warrior_pose")
    flipped = infer_group_key(Path("girl1_warrior046_flipped.jpg"), "warrior_pose")

    assert original == flipped


def test_bare_numeric_flip_twin_groups_together() -> None:
    assert infer_group_key(Path("1.jpg"), "tree_pose") == infer_group_key(
        Path("1_flipped.jpg"), "tree_pose"
    )


def test_adjacent_video_frames_share_a_group() -> None:
    a = infer_group_key(Path("annotated_000001.jpg"), "downward_dog")
    b = infer_group_key(Path("annotated_000009.jpg"), "downward_dog")

    assert a == b


def test_distant_video_frames_separate() -> None:
    """A long recording should still contribute to both splits."""
    a = infer_group_key(Path("annotated_000001.jpg"), "downward_dog")
    z = infer_group_key(Path("annotated_000900.jpg"), "downward_dog")

    assert a != z


def test_chunk_boundary_is_respected() -> None:
    chunk = DEFAULT_SEQUENCE_CHUNK
    inside = infer_group_key(Path(f"seq_{chunk - 1}.jpg"), "c")
    outside = infer_group_key(Path(f"seq_{chunk}.jpg"), "c")

    assert inside != outside


def test_same_filename_in_different_classes_does_not_collide() -> None:
    """Numbering restarts per pose folder, so groups must be class-scoped."""
    assert infer_group_key(Path("1.jpg"), "tree_pose") != infer_group_key(
        Path("1.jpg"), "warrior_pose"
    )


def test_subject_prefixes_separate_groups() -> None:
    assert infer_group_key(Path("girl1_warrior046.jpg"), "w") != infer_group_key(
        Path("guy2_warrior046.jpg"), "w"
    )


# ── Split fixtures ────────────────────────────────────────────────────────


def build_grouped_dataset(n_classes: int = 6, groups_per_class: int = 10, per_group: int = 4):
    """Class-ordered rows, exactly like `build_feature_dataset` produces."""
    y, groups = [], []
    labels = [f"class_{i}" for i in range(n_classes)]
    for class_idx, label in enumerate(labels):
        for g in range(groups_per_class):
            for _ in range(per_group):
                y.append(class_idx)
                groups.append(f"{label}|seq|{g}")
    return np.array(y, dtype=np.int32), groups, labels


# ── The class-block bug ───────────────────────────────────────────────────


def test_keras_style_tail_slice_would_lose_classes() -> None:
    """Demonstrates the original failure mode this module exists to prevent.

    Taking the last 20% of a class-ordered matrix yields a validation set whose
    classes never appear in training — the model cannot possibly score on it,
    which reads as a catastrophic train/val gap.
    """
    y, _, _ = build_grouped_dataset()
    cutoff = int(len(y) * 0.8)

    train_classes = set(y[:cutoff].tolist())
    val_classes = set(y[cutoff:].tolist())

    assert not val_classes <= train_classes, "expected the old split to lose classes"


def test_grouped_split_keeps_every_class_on_both_sides() -> None:
    y, groups, labels = build_grouped_dataset()

    train_idx, val_idx, report = grouped_stratified_split(y, groups, labels)

    assert set(y[train_idx].tolist()) == set(range(len(labels)))
    assert set(y[val_idx].tolist()) == set(range(len(labels)))
    assert report.classes_missing_from_val == []


# ── The leakage bug ───────────────────────────────────────────────────────


def test_no_group_appears_on_both_sides() -> None:
    y, groups, labels = build_grouped_dataset()
    groups_arr = np.array(groups, dtype=object)

    train_idx, val_idx, _ = grouped_stratified_split(y, groups, labels)

    overlap = set(groups_arr[train_idx]) & set(groups_arr[val_idx])
    assert overlap == set(), f"leaked groups: {sorted(overlap)[:5]}"


def test_split_covers_every_row_exactly_once() -> None:
    y, groups, labels = build_grouped_dataset()

    train_idx, val_idx, _ = grouped_stratified_split(y, groups, labels)

    combined = np.concatenate([train_idx, val_idx])
    assert sorted(combined.tolist()) == list(range(len(y)))


# ── Proportions and determinism ───────────────────────────────────────────


def test_validation_fraction_is_approximately_honoured() -> None:
    y, groups, labels = build_grouped_dataset()

    _, val_idx, report = grouped_stratified_split(y, groups, labels, val_fraction=0.2)

    assert 0.1 <= report.val_fraction <= 0.35
    assert len(val_idx) == report.val_size


def test_split_is_deterministic_for_a_seed() -> None:
    y, groups, labels = build_grouped_dataset()

    a_train, a_val, _ = grouped_stratified_split(y, groups, labels, seed=7)
    b_train, b_val, _ = grouped_stratified_split(y, groups, labels, seed=7)

    np.testing.assert_array_equal(a_train, b_train)
    np.testing.assert_array_equal(a_val, b_val)


def test_different_seeds_give_different_splits() -> None:
    y, groups, labels = build_grouped_dataset()

    _, val_a, _ = grouped_stratified_split(y, groups, labels, seed=1)
    _, val_b, _ = grouped_stratified_split(y, groups, labels, seed=99)

    assert not np.array_equal(val_a, val_b)


# ── Degenerate cases ──────────────────────────────────────────────────────


def test_class_with_a_single_group_stays_in_train_and_is_reported() -> None:
    """Cannot split one source without leaking, so it is flagged, not leaked."""
    y = np.array([0] * 8 + [1] * 8, dtype=np.int32)
    groups = ["class_0|seq|0"] * 8 + [f"class_1|seq|{i // 2}" for i in range(8)]
    labels = ["class_0", "class_1"]

    train_idx, val_idx, report = grouped_stratified_split(y, groups, labels)

    assert "class_0" in report.single_group_classes
    assert "class_0" in report.classes_missing_from_val
    assert set(y[val_idx].tolist()) == {1}
    assert 0 in set(y[train_idx].tolist())


def test_every_class_retains_training_data() -> None:
    """A class must never be moved wholesale into validation."""
    y = np.array([0] * 4 + [1] * 20, dtype=np.int32)
    groups = [f"class_0|s|{i}" for i in range(4)] + [f"class_1|s|{i}" for i in range(20)]
    labels = ["class_0", "class_1"]

    train_idx, _, _ = grouped_stratified_split(y, groups, labels, val_fraction=0.5)

    assert set(y[train_idx].tolist()) == {0, 1}


def test_mismatched_lengths_are_rejected() -> None:
    with pytest.raises(ValueError, match="length mismatch"):
        grouped_stratified_split(np.array([0, 1]), ["g"], ["a", "b"])


@pytest.mark.parametrize("bad", [0.0, 1.0, -0.1, 1.5])
def test_invalid_validation_fraction_is_rejected(bad: float) -> None:
    y, groups, labels = build_grouped_dataset()

    with pytest.raises(ValueError, match="val_fraction"):
        grouped_stratified_split(y, groups, labels, val_fraction=bad)
