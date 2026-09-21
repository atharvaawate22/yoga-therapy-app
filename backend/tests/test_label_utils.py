"""Label normalization — the contract between dataset folders and the model."""

from __future__ import annotations

import pytest

from utils.label_utils import (
    CANONICAL_LABELS,
    EXCLUDED_LABELS,
    NO_POSE,
    UNKNOWN,
    clean_label,
    feedback_pose_alias,
    is_excluded_label,
    normalize_label,
)


# ── String cleaning ───────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Adho Mukha Svanasana", "adho_mukha_svanasana"),
        ("ADHO-MUKHA-SVANASANA", "adho_mukha_svanasana"),
        ("  Warrior  Two  ", "warrior_two"),
        ("cat--cow", "cat_cow"),
        ("cat___cow", "cat_cow"),
        ("_tree_", "tree"),
        ("Tree", "tree"),
    ],
)
def test_clean_label_canonicalizes_separators(raw: str, expected: str) -> None:
    assert clean_label(raw) == expected


# ── Casing, spacing and hyphens survive the full mapping ──────────────────


@pytest.mark.parametrize(
    "raw",
    ["Vrksasana", "vrksasana", "VRKSASANA", " Vrksasana ", "vrksasana"],
)
def test_normalize_is_case_and_whitespace_insensitive(raw: str) -> None:
    assert normalize_label(raw) == "tree_pose"


@pytest.mark.parametrize(
    "raw",
    ["Setu Bandha Sarvangasana", "setu-bandha-sarvangasana", "SETU_BANDHA_SARVANGASANA"],
)
def test_hyphens_and_spaces_are_equivalent(raw: str) -> None:
    assert normalize_label(raw) == "bridge_pose"


# ── Sanskrit / English aliases ────────────────────────────────────────────


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Anjaneyasana", "low_lunge"),
        ("Ardha Matsyendrasana", "seated_twist"),
        ("Baddha Konasana", "butterfly_pose"),
        ("Balasana", "childs_pose"),
        ("Bitilasana", "cat_cow"),
        ("Halasana", "plow_pose"),
        ("Malasana", "garland_pose"),
        ("Navasana", "boat_pose"),
        ("Paschimottanasana", "seated_forward_bend"),
        ("Salamba Sarvangasana", "shoulder_stand"),
        ("Trikonasana", "triangle_pose"),
        ("Urdhva Mukha Svanasana", "upward_dog"),
        ("Utkatasana", "chair_pose"),
        ("Virabhadrasana Two", "warrior_pose"),
        ("Vrksasana", "tree_pose"),
        ("hastauttanasana", "hasta_uttanasana"),
        ("hastapadasana", "hasta_padasana"),
    ],
)
def test_sanskrit_maps_to_canonical_english(raw: str, expected: str) -> None:
    assert normalize_label(raw) == expected


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("dog", "downward_dog"),
        ("downward_facing_dog", "downward_dog"),
        ("butterfly", "butterfly_pose"),
        ("plow", "plow_pose"),
        ("boat", "boat_pose"),
        ("bridge", "bridge_pose"),
        ("chair", "chair_pose"),
        ("warrior", "warrior_pose"),
        ("warrior_two", "warrior_pose"),
        ("tree", "tree_pose"),
        ("cobra", "cobra_pose"),
    ],
)
def test_informal_english_maps_to_canonical(raw: str, expected: str) -> None:
    assert normalize_label(raw) == expected


# ── Historical typos ──────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "typo,expected",
    [
        ("shoudler_stand", "shoulder_stand"),
        ("Urdhva Mukha Svsnssana", "upward_dog"),
    ],
)
def test_dataset_typos_are_corrected(typo: str, expected: str) -> None:
    assert normalize_label(typo) == expected


# ── The triangle merge ────────────────────────────────────────────────────


@pytest.mark.parametrize("raw", ["triangle", "Triangle", "traingle", "Trikonasana"])
def test_all_triangle_spellings_collapse_to_one_class(raw: str) -> None:
    """`traingle` previously landed on its own `triangle` class.

    That split one pose's training signal across two labels. Every spelling
    must now resolve to the single canonical `triangle_pose`.
    """
    assert normalize_label(raw) == "triangle_pose"


def test_triangle_is_not_a_canonical_label() -> None:
    assert "triangle" not in CANONICAL_LABELS
    assert "triangle_pose" in CANONICAL_LABELS


# ── Sanskrit/English same-pose merges ─────────────────────────────────────


@pytest.mark.parametrize(
    "raw,expected",
    [
        # Adho Mukha Svanasana *is* Downward-Facing Dog.
        ("Adho Mukha Svanasana", "downward_dog"),
        ("adho_mukha_svanasana", "downward_dog"),
        ("dog", "downward_dog"),
        ("downward_facing_dog", "downward_dog"),
        # Bhujangasana *is* Cobra Pose.
        ("Bhujangasana", "cobra_pose"),
        ("bhujangasana", "cobra_pose"),
        ("cobra", "cobra_pose"),
        # Uttanasana *is* the Standing Forward Fold.
        ("Uttanasana", "forward_bend"),
        ("uttanasana", "forward_bend"),
        ("forward_bend", "forward_bend"),
    ],
)
def test_duplicate_pose_names_collapse_to_one_class(raw: str, expected: str) -> None:
    """One physical pose must not be trained as two competing classes."""
    assert normalize_label(raw) == expected


@pytest.mark.parametrize("merged", ["adho_mukha_svanasana", "bhujangasana", "uttanasana"])
def test_merged_sanskrit_names_are_no_longer_canonical(merged: str) -> None:
    assert merged not in CANONICAL_LABELS


def test_equestrian_lunge_stays_a_separate_class() -> None:
    """Not a duplicate: hands-down Sun Salutation lunge vs. arms-up Anjaneyasana.

    They share correction cues but are different shapes, so they stay distinct
    classes and are collapsed only for rule lookup.
    """
    assert normalize_label("Ashwa Sanchalanasana") == "ashwa_sanchalanasana"
    assert "ashwa_sanchalanasana" in CANONICAL_LABELS
    assert feedback_pose_alias("ashwa_sanchalanasana") == "low_lunge"


# ── Sentinels and passthrough ─────────────────────────────────────────────


@pytest.mark.parametrize("raw", ["no_pose", "No Pose", "nopose", "NOPOSE"])
def test_no_pose_folders_normalize_to_the_excluded_label(raw: str) -> None:
    """`unknown` is recognized but not trained; `nopose` is an API verdict."""
    assert normalize_label(raw) == UNKNOWN
    assert UNKNOWN != NO_POSE


def test_unknown_is_excluded_not_canonical() -> None:
    """The body gate already rejects no-person frames before the classifier.

    Training a class for that case produced an output neuron with zero
    validation and zero test coverage, so it is dropped from the label space.
    """
    assert UNKNOWN in EXCLUDED_LABELS
    assert UNKNOWN not in CANONICAL_LABELS
    assert is_excluded_label(UNKNOWN)


@pytest.mark.parametrize("label", sorted(CANONICAL_LABELS))
def test_no_trainable_label_is_excluded(label: str) -> None:
    assert not is_excluded_label(label)


def test_unrecognized_labels_pass_through_cleaned() -> None:
    """Adding a new pose folder should not require editing the alias table."""
    assert normalize_label("Brand New Pose") == "brand_new_pose"


def test_normalization_is_idempotent() -> None:
    for label in CANONICAL_LABELS:
        assert normalize_label(label) == label, f"{label} is not a fixed point"


def test_every_alias_target_is_known() -> None:
    """Guards against a typo in the alias table inventing a phantom class."""
    samples = [
        "Trikonasana", "dog", "Balasana", "warrior", "cobra", "no_pose",
        "shoudler_stand", "traingle", "hastapadasana", "Utkatasana",
    ]
    known = CANONICAL_LABELS | EXCLUDED_LABELS
    for raw in samples:
        assert normalize_label(raw) in known


# ── Correction-rule aliases ───────────────────────────────────────────────


def test_feedback_alias_routes_distinct_pose_to_shared_rules() -> None:
    """Correction rules are written against the English name only."""
    assert feedback_pose_alias("ashwa_sanchalanasana") == "low_lunge"


@pytest.mark.parametrize(
    "legacy,expected",
    [
        ("adho_mukha_svanasana", "downward_dog"),
        ("bhujangasana", "cobra_pose"),
        ("uttanasana", "forward_bend"),
    ],
)
def test_pre_merge_labels_still_resolve_to_rules(legacy: str, expected: str) -> None:
    """A classifier saved before the label merge must not lose its cues.

    `normalize_label` folds these away at training time, so a retrained model
    never emits them — but a stale `pose_classifier.keras` still can.
    """
    assert feedback_pose_alias(legacy) == expected


def test_feedback_alias_leaves_other_labels_untouched() -> None:
    assert feedback_pose_alias("tree_pose") == "tree_pose"
    assert feedback_pose_alias(NO_POSE) == NO_POSE
