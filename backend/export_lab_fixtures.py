"""Export images and reference MoveNet outputs for the web inference lab.

    python export_lab_fixtures.py            # writes ../web/public/lab/fixtures/

The web app runs MoveNet in the browser. To check it reproduces the server,
both must analyse the *same image bytes*. This script picks a few freely
licensed photos per pose from the Wikimedia test set (fetch_wikimedia_testset.py),
re-encodes each one small, then runs that saved file through the server's own
pipeline (decode -> pad to square -> MoveNet -> features -> classifier) for
both MoveNet variants. The browser repeats the work on the same files and the
two sets of outputs are compared (score_web_parity.py).

Only licences that allow redistribution without share-alike terms are used
(public domain, CC0, CC BY), and every image is credited in ATTRIBUTION.md.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import logging
from collections import defaultdict
from pathlib import Path
from typing import Dict, List

import numpy as np
from PIL import Image

from utils.model import NumpyClassifier, load_labels
from utils.movenet import MoveNetRuntime
from utils.paths import BASE_DIR, CLASSIFIER_MODEL_PATHS, MOVENET_VARIANTS
from utils.preprocessing import (
    decode_image,
    extract_keypoints_pixels,
    has_body,
    normalize_keypoints,
    preprocess_for_movenet,
)

logger = logging.getLogger("lab_fixtures")

WIKIMEDIA_DIR = BASE_DIR / "dataset_wikimedia"
DEFAULT_OUT = BASE_DIR.parent / "web" / "public" / "lab" / "fixtures"

# Redistributable without share-alike obligations.
ALLOWED_LICENSES = ("Public domain", "CC0", "CC BY 2.0", "CC BY 3.0", "CC BY 4.0")
MAX_SIDE = 512
JPEG_QUALITY = 85


def is_allowed_license(license_name: str) -> bool:
    return license_name.strip() in ALLOWED_LICENSES


def select_images(rows: List[Dict[str, str]], per_label: int) -> List[Dict[str, str]]:
    """Up to `per_label` allowed images per pose, in attribution-file order."""
    picked: Dict[str, List[Dict[str, str]]] = defaultdict(list)
    for row in rows:
        if is_allowed_license(row["license"]) and len(picked[row["label"]]) < per_label:
            picked[row["label"]].append(row)
    return [row for label in sorted(picked) for row in picked[label]]


def reencode(source: Path) -> bytes:
    """Upright, longest side <= MAX_SIDE, baseline JPEG without metadata."""
    with Image.open(source) as image:
        from PIL import ImageOps  # noqa: PLC0415

        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=JPEG_QUALITY)
        return buffer.getvalue()


def f32(values: np.ndarray) -> list:
    """Values that round-trip exactly to float32 (9 significant digits)."""
    return [float(f"{v:.9g}") for v in np.asarray(values, dtype=np.float32).reshape(-1)]


def analyse(data: bytes, movenet: MoveNetRuntime, classifier: NumpyClassifier, labels: List[str]) -> dict:
    """The server's pipeline on one image, keeping every intermediate."""
    _, padded_rgb = preprocess_for_movenet(decode_image(data))
    raw = movenet.infer(padded_rgb)  # [17, 3] (y, x, score) in [0, 1] of the padded square
    # Normalized coordinates (side 1) are enough: features are scale-invariant.
    keypoints = extract_keypoints_pixels(raw, 1, 1)
    features = normalize_keypoints(keypoints)
    probs = classifier.predict(features[None, :])[0]
    best = int(np.argmax(probs))
    return {
        "raw": f32(raw),
        "hasBody": bool(has_body(keypoints)),
        "features": f32(features),
        "label": labels[best],
        "prob": float(f"{probs[best]:.9g}"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--per-label", type=int, default=2)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    with open(WIKIMEDIA_DIR / "ATTRIBUTION.csv", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    selected = select_images(rows, args.per_label)
    logger.info("Selected %d images under %s", len(selected), ", ".join(ALLOWED_LICENSES))

    labels = load_labels()
    # Each variant's keypoints go through that variant's own classifier head.
    classifiers = {
        name: NumpyClassifier.from_keras_file(CLASSIFIER_MODEL_PATHS[name]) for name in MOVENET_VARIANTS
    }
    runtimes = {name: MoveNetRuntime(path) for name, (path, _url) in MOVENET_VARIANTS.items()}

    args.out.mkdir(parents=True, exist_ok=True)
    images = []
    credits = []
    for index, row in enumerate(selected):
        data = reencode(WIKIMEDIA_DIR / row["file"])
        name = f"{index:02d}-{row['label']}.jpg"
        (args.out / name).write_bytes(data)
        width, height = Image.open(io.BytesIO(data)).size
        images.append(
            {
                "file": name,
                "label": row["label"],
                "width": width,
                "height": height,
                "expected": {
                    variant: analyse(data, runtime, classifiers[variant], labels)
                    for variant, runtime in runtimes.items()
                },
            }
        )
        credits.append(
            f"| `{name}` | [{row['title']}]({row['source']}) | {row['author']} | {row['license']} |"
        )

    manifest = {
        "description": "Reference outputs of the server pipeline (backend/export_lab_fixtures.py).",
        "inputSize": {name: runtime.input_size for name, runtime in runtimes.items()},
        "padValue": 114,
        "labels": labels,
        "images": images,
    }
    (args.out / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8")
    (args.out / "ATTRIBUTION.md").write_text(
        "# Lab fixture images\n\n"
        "Photos from Wikimedia Commons, resized and re-encoded (longest side "
        f"{MAX_SIDE}px) by `backend/export_lab_fixtures.py`. Each remains under "
        "its original licence.\n\n"
        "| File | Original | Author | Licence |\n|---|---|---|---|\n" + "\n".join(credits) + "\n",
        encoding="utf-8",
    )
    logger.info("Wrote %d fixtures to %s", len(images), args.out)


if __name__ == "__main__":
    main()
