"""Near-duplicate detection that keeps the Wikimedia test set independent."""

from __future__ import annotations

import cv2
import numpy as np

from fetch_wikimedia_testset import CATEGORIES, dhash, is_near_duplicate
from utils.label_utils import CANONICAL_LABELS


def _photo(seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    image = cv2.GaussianBlur(rng.integers(0, 255, (240, 320, 3), dtype=np.uint8), (31, 31), 0)
    cv2.circle(image, (100 + seed % 50, 120), 60, (255, 255, 255), -1)
    return image


def test_resized_recompressed_copy_is_a_near_duplicate() -> None:
    original = _photo(1)
    small = cv2.resize(original, (160, 120), interpolation=cv2.INTER_AREA)
    ok, jpeg = cv2.imencode(".jpg", small, [cv2.IMWRITE_JPEG_QUALITY, 60])
    copy = cv2.imdecode(jpeg, cv2.IMREAD_COLOR)

    known = np.array([dhash(original)], dtype=np.uint64)

    assert is_near_duplicate(dhash(copy), known)


def test_different_photo_is_not_a_near_duplicate() -> None:
    known = np.array([dhash(_photo(1))], dtype=np.uint64)
    assert not is_near_duplicate(dhash(_photo(7)), known)


def test_every_category_maps_to_a_trained_label() -> None:
    assert set(CATEGORIES) <= CANONICAL_LABELS
