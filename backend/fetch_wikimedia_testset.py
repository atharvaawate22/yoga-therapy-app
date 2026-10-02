"""Build an independent test set from freely licensed Wikimedia Commons photos.

    python fetch_wikimedia_testset.py            # download + dedupe
    python eval_pose_metrics.py --test-root dataset_wikimedia

Why: the original test folder can't score every class (all of upward_dog's
test images were copies of training images, for one), and every training and
test image came from the same scraped sources. Commons photos are a different
source, real photographs, and individually licensed (CC0 / CC BY / CC BY-SA /
public domain) — ATTRIBUTION.csv records each file's author and licence.

It is small (roughly 5-35 photos per pose), so it is a test set, not
training data. Steps:

1. List the files of one hand-picked Commons category per pose (below).
2. Keep JPEG files only — drawings and diagrams on Commons are almost all
   SVG/PNG — and skip files listed in REJECTED (reviewed by hand: artwork,
   variants of the pose, group shots where the pose isn't clear).
3. Download a 1280px rendition via the official API.
4. Drop near-duplicates of training images (difference hash, Hamming
   distance <= NEAR_DUP_BITS) so a resized copy can't be scored as unseen.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Dict, Iterable, List

import cv2
import numpy as np

from utils.dataset import _iter_images, discover_class_dirs
from utils.paths import BASE_DIR

OUT_DIR = BASE_DIR / "dataset_wikimedia"
API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "YogaTherapyApp-testset-builder/1.0 (https://github.com/atharvaawate22/yoga-therapy-app)"
THUMB_WIDTH = 1280
NEAR_DUP_BITS = 5

# One or more Commons categories per classifier label (non-recursive:
# subcategories are mostly pose variants). No usable category exists for
# bridge_pose or hasta_uttanasana.
CATEGORIES: Dict[str, List[str]] = {
    "upward_dog": ["Urdhva Mukha Svanasana"],
    "seated_twist": ["Ardha Matsyendrasana"],
    "cobra_pose": ["Bhujangasana"],
    "butterfly_pose": ["Baddha Konasana"],
    "pranamasana": ["Praṇāmāsana"],
    "ashwa_sanchalanasana": ["Ashwa Sanchalanasana"],
    "ashtanga_namaskara": ["Aṣṭāṅga Namaskāra"],
    "tadasana": ["Tāḍāsana"],
    "downward_dog": ["Adho Mukha Svanasana"],
    "tree_pose": ["Vrikshasana"],
    "warrior_pose": ["Virabhadrasana II"],
    "chair_pose": ["Utkatasana"],
    "triangle_pose": ["Trikoṇāsana"],
    "boat_pose": ["Nāvāsana"],
    "childs_pose": ["Bālāsana"],
    "cat_cow": ["Bitilasana", "Biḍālāsana"],
    "garland_pose": ["Malasana"],
    "plow_pose": ["Halasana"],
    "seated_forward_bend": ["Paschimottanasana"],
    "shoulder_stand": ["Sarvangasana"],
    "forward_bend": ["Uttanasana", "Padahastasana"],
    "low_lunge": ["Anjaneyasana"],
}

# Files removed after reviewing contact sheets of every download: artwork and
# illustrations, crowd and group shots, tiny or cropped figures, and pose
# variants that aren't the classifier's pose (e.g. one-legged shoulder stands,
# arms-raised Tadasana). 120 of 358 downloads.
REJECTED_LIST = BASE_DIR / "wikimedia_rejected.json"
REJECTED: set = set(json.loads(REJECTED_LIST.read_text(encoding="utf-8")))

_SAFE = re.compile(r"[^A-Za-z0-9._-]+")


def api_get(**params) -> dict:
    params.update(format="json", formatversion="2")
    request = urllib.request.Request(
        f"{API}?{urllib.parse.urlencode(params)}", headers={"User-Agent": USER_AGENT}
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def category_files(category: str) -> List[str]:
    titles, cont = [], {}
    while True:
        data = api_get(action="query", list="categorymembers", cmtitle=f"Category:{category}",
                       cmtype="file", cmlimit=500, **cont)
        titles += [m["title"] for m in data["query"]["categorymembers"]]
        if "continue" not in data:
            return titles
        cont = {"cmcontinue": data["continue"]["cmcontinue"]}


def file_infos(titles: List[str]) -> Iterable[dict]:
    for start in range(0, len(titles), 40):
        data = api_get(action="query", prop="imageinfo", titles="|".join(titles[start:start + 40]),
                       iiprop="url|mime|extmetadata", iiurlwidth=THUMB_WIDTH)
        for page in data["query"]["pages"]:
            if page.get("imageinfo"):
                yield {"title": page["title"], **page["imageinfo"][0]}


def _meta(info: dict, key: str) -> str:
    value = info.get("extmetadata", {}).get(key, {}).get("value", "")
    return re.sub(r"<[^>]+>", "", str(value)).strip()


def dhash(image_bgr: np.ndarray, size: int = 8) -> int:
    """64-bit difference hash: robust to resizing and recompression."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, (size + 1, size), interpolation=cv2.INTER_AREA)
    bits = (small[:, 1:] > small[:, :-1]).flatten()
    return int("".join("1" if b else "0" for b in bits), 2)


def training_hashes() -> List[int]:
    hashes = []
    for class_dir in discover_class_dirs():
        for path in _iter_images(class_dir):
            image = cv2.imread(str(path))
            if image is not None:
                hashes.append(dhash(image))
    return hashes


def is_near_duplicate(h: int, known: np.ndarray) -> bool:
    if known.size == 0:
        return False
    xor = np.bitwise_xor(known, np.uint64(h))
    distances = np.array([bin(int(x)).count("1") for x in xor])
    return bool((distances <= NEAR_DUP_BITS).any())


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=OUT_DIR)
    parser.add_argument("--skip-dedupe", action="store_true")
    args = parser.parse_args(argv)

    print("Hashing training images for near-duplicate detection...")
    known = np.array(training_hashes() if not args.skip_dedupe else [], dtype=np.uint64)
    print(f"  {known.size} training hashes")

    rows, counts = [], {}
    for label, categories in CATEGORIES.items():
        titles = sorted({t for c in categories for t in category_files(c)} - REJECTED)
        kept = skipped_type = skipped_dup = 0
        for info in file_infos(titles):
            if info.get("mime") != "image/jpeg":
                skipped_type += 1
                continue
            name = _SAFE.sub("_", info["title"].removeprefix("File:"))
            target = args.out / label / name
            if not target.exists():
                request = urllib.request.Request(info["thumburl"], headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(request, timeout=60) as response:
                    data = response.read()
                image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
                if image is None:
                    continue
                if is_near_duplicate(dhash(image), known):
                    skipped_dup += 1
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
                time.sleep(0.2)  # be polite to the API
            kept += 1
            rows.append({
                "label": label, "file": f"{label}/{name}", "title": info["title"],
                "author": _meta(info, "Artist"), "license": _meta(info, "LicenseShortName"),
                "source": info.get("descriptionurl", ""),
            })
        counts[label] = (kept, skipped_type, skipped_dup)
        print(f"{label:<21} kept {kept:>3}   non-JPEG {skipped_type:>3}   near-dup of training {skipped_dup:>3}")

    args.out.mkdir(parents=True, exist_ok=True)
    with open(args.out / "ATTRIBUTION.csv", "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=["label", "file", "title", "author", "license", "source"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"\n{sum(c[0] for c in counts.values())} photos -> {args.out}  (attribution in ATTRIBUTION.csv)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
