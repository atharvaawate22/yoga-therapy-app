"""Canonical pose-label handling.

Dataset folders arrive with inconsistent names — mixed casing, spaces, hyphens,
Sanskrit or English, and a few historical typos. Every consumer (server,
trainer, evaluator) must agree on the mapping from folder name to class label,
otherwise the trainer builds a label space the server cannot address.

This module is the single source of that mapping.
"""

from __future__ import annotations

from typing import Dict, FrozenSet

__all__ = [
    "CANONICAL_LABELS",
    "EXCLUDED_LABELS",
    "NO_POSE",
    "UNKNOWN",
    "clean_label",
    "is_excluded_label",
    "normalize_label",
    "feedback_pose_alias",
]

# Sentinel labels.
#
# UNKNOWN is where the dataset's `no_pose/` folder lands. It is NOT trained:
# the body-presence gate in `utils.preprocessing` already rejects frames with
# no visible person, long before the classifier runs, so those images were
# almost entirely filtered out anyway (400 raw -> 25 surviving, with zero test
# coverage). Keeping it as a class meant an output neuron that could never be
# evaluated.
#
# NO_POSE is what the API reports when it declines to commit to a prediction.
# The two are deliberately distinct.
UNKNOWN = "unknown"
NO_POSE = "nopose"

# Every label the pipeline may emit. Used by tests to assert that the alias
# table cannot introduce a class the rest of the system does not know about.
CANONICAL_LABELS: FrozenSet[str] = frozenset(
    {
        "ashtanga_namaskara",
        "ashwa_sanchalanasana",
        "boat_pose",
        "bridge_pose",
        "butterfly_pose",
        "cat_cow",
        "chair_pose",
        "childs_pose",
        "cobra_pose",
        "dandasana",
        "downward_dog",
        "forward_bend",
        "garland_pose",
        "hasta_padasana",
        "hasta_uttanasana",
        "low_lunge",
        "plow_pose",
        "pranamasana",
        "seated_forward_bend",
        "seated_twist",
        "shoulder_stand",
        "tadasana",
        "tree_pose",
        "triangle_pose",
        "upward_dog",
        "warrior_pose",
    }
)

# Labels that are recognized but deliberately not trained. Feature extraction
# skips these folders entirely, so they never become a softmax output.
EXCLUDED_LABELS: FrozenSet[str] = frozenset({UNKNOWN})


def is_excluded_label(label: str) -> bool:
    """Whether a normalized label should be dropped instead of trained."""
    return label in EXCLUDED_LABELS

# Folder name (after `clean_label`) -> canonical label.
# Only non-identity mappings live here; anything already canonical passes
# through untouched.
_ALIASES: Dict[str, str] = {
    # ── Sentinels ──
    "no_pose": UNKNOWN,
    "nopose": UNKNOWN,
    # ── Historical dataset typos ──
    "shoudler_stand": "shoulder_stand",
    "traingle": "triangle_pose",
    "urdhva_mukha_svsnssana": "upward_dog",
    # ── Same pose, two folder names ──
    # These were previously trained as separate classes, splitting one pose's
    # signal across two labels that then competed in the softmax. The English
    # name wins because the correction rules are keyed on it.
    "adho_mukha_svanasana": "downward_dog",
    "bhujangasana": "cobra_pose",
    "uttanasana": "forward_bend",
    # ── Sanskrit -> English canonical ──
    "anjaneyasana": "low_lunge",
    "ardha_matsyendrasana": "seated_twist",
    "baddha_konasana": "butterfly_pose",
    "balasana": "childs_pose",
    "bitilasana": "cat_cow",
    "halasana": "plow_pose",
    "malasana": "garland_pose",
    "navasana": "boat_pose",
    "paschimottanasana": "seated_forward_bend",
    "salamba_sarvangasana": "shoulder_stand",
    "sarvangasana": "shoulder_stand",
    "setu_bandha_sarvangasana": "bridge_pose",
    "setu_bandha": "bridge_pose",
    "trikonasana": "triangle_pose",
    "urdhva_mukha_svanasana": "upward_dog",
    "utkatasana": "chair_pose",
    "virabhadrasana": "warrior_pose",
    "virabhadrasana_two": "warrior_pose",
    "vrksasana": "tree_pose",
    "hastauttanasana": "hasta_uttanasana",
    "hastapadasana": "hasta_padasana",
    # ── Informal / shorthand English ──
    "dog": "downward_dog",
    "downward_facing_dog": "downward_dog",
    "butterfly": "butterfly_pose",
    "plow": "plow_pose",
    "garland": "garland_pose",
    "boat": "boat_pose",
    "bridge": "bridge_pose",
    "triangle": "triangle_pose",
    "chair": "chair_pose",
    "warrior": "warrior_pose",
    "warrior_two": "warrior_pose",
    "tree": "tree_pose",
    "cobra": "cobra_pose",
}


def clean_label(raw: str) -> str:
    """Lowercase, collapse separators to single underscores, strip edges.

    ``"  Adho Mukha  Svanasana "`` -> ``"adho_mukha_svanasana"``
    """
    cleaned = raw.strip().lower().replace("-", "_").replace(" ", "_")
    while "__" in cleaned:
        cleaned = cleaned.replace("__", "_")
    return cleaned.strip("_")


def normalize_label(label: str) -> str:
    """Map a raw dataset folder name to its canonical class label.

    Unrecognized names pass through cleaned but unmapped, so adding a new pose
    folder does not require touching this table before it can be trained.
    """
    return _ALIASES.get(clean_label(label), clean_label(label))


# Maps a predicted label onto the pose whose correction rules apply to it.
#
# `ashwa_sanchalanasana` (the Sun Salutation lunge, hands on the floor) stays a
# class of its own — it is a genuinely different shape from Anjaneyasana, it
# just shares the same alignment cues.
#
# The three Sanskrit entries below are *not* reachable from a model trained
# after the label merge, since `normalize_label` now folds them away at
# training time. They remain so that a classifier saved before the merge still
# resolves to the right rules instead of falling through to generic feedback.
_FEEDBACK_ALIASES: Dict[str, str] = {
    "ashwa_sanchalanasana": "low_lunge",
    # Legacy (pre-merge) label space:
    "adho_mukha_svanasana": "downward_dog",
    "bhujangasana": "cobra_pose",
    "uttanasana": "forward_bend",
}


def feedback_pose_alias(pose: str) -> str:
    """Map a predicted class label onto the correction-rule namespace."""
    return _FEEDBACK_ALIASES.get(pose, pose)
