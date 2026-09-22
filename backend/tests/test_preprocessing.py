"""The shared image -> feature pipeline.

These tests pin the behaviour that training and serving must agree on. If
someone reintroduces a preprocessing difference, this is what should fail.
"""

from __future__ import annotations

import numpy as np
import pytest

from utils.preprocessing import (
    FEATURE_DIM,
    extract_keypoints_pixels,
    has_body,
    normalize_keypoints,
    pad_to_square,
    preprocess_for_movenet,
)

from conftest import make_movenet_output


def keypoints_from(output: np.ndarray, width: int = 640, height: int = 640) -> np.ndarray:
    return extract_keypoints_pixels(output, width, height)


# ── Padding ───────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "shape,expected_side",
    [((480, 640, 3), 640), ((640, 480, 3), 640), ((300, 300, 3), 300)],
)
def test_pad_to_square_produces_a_square(shape, expected_side: int) -> None:
    padded = pad_to_square(np.zeros(shape, dtype=np.uint8))

    assert padded.shape[0] == padded.shape[1] == expected_side


def test_pad_to_square_preserves_every_source_pixel() -> None:
    image = np.zeros((100, 200, 3), dtype=np.uint8)
    image[:, :] = 255  # solid white source image

    padded = pad_to_square(image)

    assert padded.shape[:2] == (200, 200)
    # The original content lands, unmodified, at the vertical offset the
    # padding added -- nothing from the source frame is cropped away.
    assert np.all(padded[50:150, :] == 255)
    # The padding itself is a distinct fill color, not more source content.
    assert np.all(padded[0, :] != 255)
    assert np.all(padded[199, :] != 255)


def test_preprocess_returns_matching_bgr_and_rgb_squares() -> None:
    image = np.zeros((480, 640, 3), dtype=np.uint8)
    image[:, :, 2] = 255  # pure red in BGR

    padded_bgr, padded_rgb = preprocess_for_movenet(image)

    assert padded_bgr.shape == padded_rgb.shape == (640, 640, 3)
    # Channel order really was swapped, so overlays and tensors agree on pixels.
    # Row 0 is padding, so check a row known to still hold source content.
    top_pad = (640 - 480) // 2
    assert padded_bgr[top_pad, 0, 2] == 255
    assert padded_rgb[top_pad, 0, 0] == 255


# ── Keypoint extraction ───────────────────────────────────────────────────


def test_extract_swaps_movenet_yx_into_xy_pixels() -> None:
    output = np.zeros((17, 3), dtype=np.float32)
    output[0] = (0.25, 0.75, 0.9)  # (y, x, score)

    keypoints = extract_keypoints_pixels(output, width=640, height=480)

    assert keypoints[0, 0] == pytest.approx(0.75 * 640)  # x
    assert keypoints[0, 1] == pytest.approx(0.25 * 480)  # y
    assert keypoints[0, 2] == pytest.approx(0.9)


# ── Normalization invariants ──────────────────────────────────────────────


def test_feature_vector_has_expected_shape() -> None:
    features = normalize_keypoints(keypoints_from(make_movenet_output()))

    assert features.shape == (FEATURE_DIM,)
    assert features.dtype == np.float32


def test_features_are_translation_invariant() -> None:
    """The same pose in a different part of the frame must give the same vector."""
    base = keypoints_from(make_movenet_output())
    shifted = base.copy()
    shifted[:, :2] += np.array([120.0, -45.0], dtype=np.float32)

    np.testing.assert_allclose(
        normalize_keypoints(base), normalize_keypoints(shifted), atol=1e-5
    )


def test_features_are_scale_invariant() -> None:
    """Standing closer to the camera must not change the classification input."""
    base = keypoints_from(make_movenet_output())
    scaled = base.copy()
    scaled[:, :2] *= 2.5

    np.testing.assert_allclose(
        normalize_keypoints(base), normalize_keypoints(scaled), atol=1e-5
    )


def test_features_are_not_rotation_invariant() -> None:
    """Sanity check: orientation is signal, not noise — it must survive."""
    base = keypoints_from(make_movenet_output())
    flipped = base.copy()
    flipped[:, 1] = -flipped[:, 1]  # mirror vertically

    assert not np.allclose(normalize_keypoints(base), normalize_keypoints(flipped))


def test_degenerate_torso_does_not_divide_by_zero() -> None:
    """Shoulders and hips collapsed to a point — must fall back, not explode."""
    keypoints = np.zeros((17, 3), dtype=np.float32)
    keypoints[:, 2] = 0.9
    keypoints[0, :2] = (10.0, 20.0)  # one joint away from the origin

    features = normalize_keypoints(keypoints)

    assert np.all(np.isfinite(features))


# ── Body-presence gate ────────────────────────────────────────────────────


def test_full_body_passes_the_gate() -> None:
    assert has_body(keypoints_from(make_movenet_output(score=0.9))) is True


def test_uniformly_faint_detection_is_rejected() -> None:
    assert has_body(keypoints_from(make_movenet_output(score=0.05))) is False


def test_missing_core_torso_is_rejected() -> None:
    """Limbs alone are not enough — shoulders and hips anchor normalization."""
    faded_core = {idx: (0.5, 0.5, 0.10) for idx in (5, 6, 11, 12)}
    output = make_movenet_output(score=0.95, overrides=faded_core)

    assert has_body(keypoints_from(output)) is False


def test_a_few_faint_limbs_still_pass() -> None:
    """The serving gate tolerates partial occlusion; training now does too."""
    faded_ankles = {idx: (0.9, 0.5, 0.05) for idx in (15, 16)}
    output = make_movenet_output(score=0.9, overrides=faded_ankles)

    assert has_body(keypoints_from(output)) is True
