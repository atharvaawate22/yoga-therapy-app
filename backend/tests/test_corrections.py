"""Rule-based corrections: scale invariance and the individual pose rules."""

from __future__ import annotations

import numpy as np
import pytest

import yoga_pose_engine as engine

# Pixel-space (x, y) for an upright person in a 400x400 frame. Torso length
# (shoulder midpoint to hip midpoint) is 100px.
UPRIGHT = {
    0: (200, 60),
    1: (195, 55), 2: (205, 55), 3: (190, 58), 4: (210, 58),
    5: (170, 100), 6: (230, 100),  # shoulders
    7: (160, 150), 8: (240, 150),  # elbows
    9: (155, 200), 10: (245, 200),  # wrists
    11: (180, 200), 12: (220, 200),  # hips
    13: (180, 280), 14: (220, 280),  # knees
    15: (180, 360), 16: (220, 360),  # ankles
}


def keypoints(overrides=None, scale: float = 1.0) -> np.ndarray:
    points = dict(UPRIGHT)
    points.update(overrides or {})
    kp = np.zeros((17, 3), dtype=np.float32)
    for idx, (x, y) in points.items():
        kp[idx] = (x * scale, y * scale, 0.9)
    return kp


@pytest.mark.parametrize("pose", ["tree_pose", "warrior_pose", "chair_pose", "downward_dog"])
@pytest.mark.parametrize("level", ["beginner", "intermediate", "expert"])
def test_feedback_does_not_depend_on_image_resolution(pose: str, level: str) -> None:
    """A 12MP photo and a small frame of the same pose must get the same cues."""
    tilted = keypoints({5: (170, 92), 9: (155, 190)})

    small = engine._generate_corrections(pose, tilted, level)
    large = engine._generate_corrections(pose, tilted * np.array([10, 10, 1], dtype=np.float32), level)

    assert small == large


def test_butterfly_upright_spine_is_not_told_to_sit_tall() -> None:
    cues = engine._generate_corrections("butterfly_pose", keypoints(), "beginner")
    assert not any("Sit tall" in c for c in cues)


def test_butterfly_slumped_spine_is_told_to_sit_tall() -> None:
    # Leaning forward: shoulders about half a torso length above the hips.
    slumped = keypoints({5: (80, 150), 6: (140, 150)})
    cues = engine._generate_corrections("butterfly_pose", slumped, "beginner")
    assert any("Sit tall" in c for c in cues)


def test_tree_hands_at_heart_center_get_no_arm_cue() -> None:
    heart_center = keypoints({9: (198, 140), 10: (202, 140)})
    cues = engine._generate_corrections("tree_pose", heart_center, "beginner")
    assert not any("Raise arms" in c for c in cues)


def test_tree_arms_hanging_at_sides_get_arm_cue() -> None:
    cues = engine._generate_corrections("tree_pose", keypoints(), "beginner")
    assert any("Raise arms" in c for c in cues)


def test_garland_shallow_squat_is_told_to_go_deeper() -> None:
    cues = engine._generate_corrections("garland_pose", keypoints(), "beginner")
    assert any("Squat deeper" in c for c in cues)


def test_garland_deep_squat_is_not_told_to_go_deeper() -> None:
    deep = keypoints({11: (180, 280), 12: (220, 280), 13: (150, 275), 14: (250, 275),
                      5: (170, 180), 6: (230, 180)})
    cues = engine._generate_corrections("garland_pose", deep, "beginner")
    assert not any("Squat deeper" in c for c in cues)


def _warrior(front: str) -> np.ndarray:
    """Warrior II with the given leg bent in front, knee drifting past the ankle.

    The back leg is straight and vertical (knee exactly over ankle), so a rule
    that always inspected the left knee would stay silent for a right-front pose.
    """
    arms = {9: (60, 100), 10: (340, 100), 7: (115, 100), 8: (285, 100)}
    if front == "right":
        legs = {13: (180, 280), 15: (180, 360), 14: (300, 240), 16: (270, 360)}
    else:
        legs = {14: (220, 280), 16: (220, 360), 13: (100, 240), 15: (130, 360)}
    return keypoints({**arms, **legs})


@pytest.mark.parametrize("front", ["left", "right"])
def test_warrior_checks_whichever_knee_is_in_front(front: str) -> None:
    cues = engine._generate_corrections("warrior_pose", _warrior(front), "expert")
    assert any("Align front knee" in c for c in cues)


def test_cat_cow_cues_describe_what_was_measured() -> None:
    uneven = keypoints({5: (170, 60), 11: (180, 160)})
    cues = engine._generate_corrections("cat_cow", uneven, "beginner")
    assert any("shoulders level" in c for c in cues)
    assert any("hips level" in c for c in cues)
