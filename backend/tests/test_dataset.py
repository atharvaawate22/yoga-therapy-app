"""Feature-set construction from labelled image folders."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from utils.dataset import build_feature_dataset
from utils.label_utils import UNKNOWN
from utils.preprocessing import FEATURE_DIM

from conftest import StubMoveNet, make_movenet_output


def write_class_dir(root: Path, name: str, filenames) -> Path:
    class_dir = root / name
    class_dir.mkdir(parents=True, exist_ok=True)
    image = np.full((120, 160, 3), 127, dtype=np.uint8)
    for filename in filenames:
        cv2.imwrite(str(class_dir / filename), image)
    return class_dir


def test_excluded_class_directory_is_not_trained(tmp_path: Path) -> None:
    """`no_pose/` must not become a softmax output.

    The body-presence gate already rejects frames without a person, so a
    trained `unknown` class would be an output neuron with no eval coverage.
    """
    write_class_dir(tmp_path, "tree", ["1.jpg", "2.jpg"])
    write_class_dir(tmp_path, "no_pose", ["a.jpg", "b.jpg", "c.jpg"])

    features = build_feature_dataset(StubMoveNet(), roots=[tmp_path])

    assert features.labels == ["tree_pose"]
    assert UNKNOWN not in features.labels
    assert features.stats.skipped_excluded_class == 3


def test_excluded_images_are_still_counted(tmp_path: Path) -> None:
    """Retention accounting should not silently lose the skipped files."""
    write_class_dir(tmp_path, "tree", ["1.jpg"])
    write_class_dir(tmp_path, "no_pose", ["a.jpg", "b.jpg"])

    stats = build_feature_dataset(StubMoveNet(), roots=[tmp_path]).stats

    assert stats.total_images == 3
    assert stats.kept == 1
    assert "excluded" in stats.summary()


def test_features_have_expected_shape_and_groups(tmp_path: Path) -> None:
    write_class_dir(tmp_path, "tree", ["1.jpg", "1_flipped.jpg", "2.jpg"])

    features = build_feature_dataset(StubMoveNet(), roots=[tmp_path])

    assert features.x.shape == (3, FEATURE_DIM)
    assert features.y.tolist() == [0, 0, 0]
    assert len(features.groups) == 3
    # The flip twin shares its original's group, so a split cannot separate them.
    assert features.groups[0] == features.groups[1]


def test_frames_failing_the_body_gate_are_dropped(tmp_path: Path) -> None:
    write_class_dir(tmp_path, "tree", ["1.jpg", "2.jpg"])
    faint = StubMoveNet(make_movenet_output(score=0.05))

    features = build_feature_dataset(faint, roots=[tmp_path])

    assert features.is_empty
    assert features.stats.skipped_no_body == 2


def test_only_excluded_dirs_yields_empty_featureset(tmp_path: Path) -> None:
    write_class_dir(tmp_path, "no_pose", ["a.jpg"])

    features = build_feature_dataset(StubMoveNet(), roots=[tmp_path])

    assert features.is_empty
    assert features.labels == []
