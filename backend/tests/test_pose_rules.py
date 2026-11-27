"""Upward dog vs cobra geometry rule (utils.pose_rules)."""

from __future__ import annotations

import numpy as np

from utils.pose_rules import apply_pose_rules, looks_like_upward_dog, prone_lift

LABELS = ["cobra_pose", "tree_pose", "upward_dog"]


def side_view(elbow, hip, knee) -> np.ndarray:
    """Prone body seen from the side, both sides overlapping. Image y grows down."""
    k = np.zeros((17, 2), dtype=np.float32)
    k[[5, 6]] = (0.0, -2.0)    # shoulders above the hands
    k[[7, 8]] = elbow
    k[[9, 10]] = (0.0, 0.0)    # wrists on the floor
    k[[11, 12]] = hip
    k[[13, 14]] = knee
    k[[15, 16]] = (6.0, 0.0)   # ankles on the floor
    k[0] = (-0.3, -2.6)
    return k.reshape(-1)


UPWARD_DOG = side_view(elbow=(0.0, -1.0), hip=(3.0, -1.3), knee=(4.5, -0.6))
COBRA = side_view(elbow=(0.6, -1.0), hip=(3.0, 0.0), knee=(4.5, 0.0))
# Straight arms but pelvis down: a "high cobra", which must stay cobra.
HIGH_COBRA = side_view(elbow=(0.0, -1.0), hip=(3.0, -0.2), knee=(4.5, 0.0))


def test_prone_lift_measures_straight_arms_and_lifted_hips() -> None:
    elbow, hip, knee = prone_lift(UPWARD_DOG)
    assert elbow[0] > 175
    assert hip[0] > 0.35 and knee[0] > 0.1

    elbow, hip, knee = prone_lift(COBRA)
    assert elbow[0] < 145
    assert abs(hip[0]) < 1e-6 and abs(knee[0]) < 1e-6


def test_lift_rule_needs_the_hips_and_knees_off_the_floor() -> None:
    batch = np.stack([UPWARD_DOG, COBRA, HIGH_COBRA])
    assert looks_like_upward_dog(batch).tolist() == [True, False, False]


def test_lift_rule_is_mirror_invariant() -> None:
    from utils.preprocessing import mirror_features

    assert looks_like_upward_dog(mirror_features(UPWARD_DOG)).tolist() == [True]


def test_cobra_answer_becomes_upward_dog_when_lifted() -> None:
    probs = np.array([0.8, 0.05, 0.15], dtype=np.float32)

    out = apply_pose_rules(UPWARD_DOG, probs, LABELS)

    np.testing.assert_allclose(out, [0.15, 0.05, 0.8])
    np.testing.assert_allclose(probs, [0.8, 0.05, 0.15])  # input untouched


def test_rule_leaves_other_answers_and_real_cobras_alone() -> None:
    tree_top = np.array([0.3, 0.6, 0.1], dtype=np.float32)
    cobra_top = np.array([0.8, 0.05, 0.15], dtype=np.float32)

    np.testing.assert_allclose(apply_pose_rules(UPWARD_DOG, tree_top, LABELS), tree_top)
    np.testing.assert_allclose(apply_pose_rules(HIGH_COBRA, cobra_top, LABELS), cobra_top)


def test_rule_applies_per_row_in_a_batch() -> None:
    probs = np.array([[0.8, 0.05, 0.15], [0.8, 0.05, 0.15]], dtype=np.float32)

    out = apply_pose_rules(np.stack([UPWARD_DOG, COBRA]), probs, LABELS)

    assert out.argmax(1).tolist() == [2, 0]


def lunge() -> np.ndarray:
    """Ashwa Sanchalanasana: hands down, chest up, front knee sharply bent."""
    k = UPWARD_DOG.reshape(17, 2).copy()
    k[13] = (1.0, -2.0)   # left knee pulled forward and up
    k[15] = (0.8, 0.0)    # left foot beside the hands
    return k.reshape(-1)


def test_rule_skips_a_lunge_and_lunge_high_hips() -> None:
    from utils.pose_rules import min_knee_angle

    assert min_knee_angle(lunge())[0] < 120
    high_hips = side_view(elbow=(0.0, -1.0), hip=(3.0, -2.6), knee=(4.5, -1.3))
    assert prone_lift(high_hips)[1][0] > 0.6
    assert looks_like_upward_dog(np.stack([lunge(), high_hips])).tolist() == [False, False]
