"""Turn recorded pose videos into labelled training/test frames.

    python extract_video_frames.py --test-people riya,arjun
    python extract_video_frames.py --dry-run          # show the plan, write nothing

Clips are named ``<person>_<pose>_<anything>.<ext>`` (e.g.
``riya_seatedtwist_side.mp4``); see docs/RECORDING_GUIDE.md. One frame is
taken every ``--interval`` seconds, capped at ``--max-per-clip`` so a long clip
can't dominate a class.

Frames of the people named in ``--test-people`` go to ``dataset_test/`` and
everyone else's to ``dataset/`` (a training root). Holding out whole people is
the honest test for this app: the model is scored on bodies, rooms and
clothes it has never seen. Evaluate with
``python eval_pose_metrics.py --test-root dataset_test``.

Frame names keep person, pose and clip, and frames of one clip share a group
key (see ``utils.splits.infer_group_key``), so the trainer never splits a clip
across training and validation.
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Sequence

import cv2

from utils.label_utils import CANONICAL_LABELS, normalize_label
from utils.paths import BASE_DIR, TRAIN_DATASET_DIR

VIDEO_DIR = BASE_DIR / "videos"
OWN_TEST_DIR = BASE_DIR / "dataset_test"
VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".avi", ".mkv", ".3gp", ".webm"}
MAX_FRAME_SIDE = 1280

# Friendly spellings people will use in file names -> canonical label.
# Anything else goes through utils.label_utils.normalize_label.
POSE_ALIASES: Dict[str, str] = {
    "updog": "upward_dog",
    "upwarddog": "upward_dog",
    "seatedtwist": "seated_twist",
    "twist": "seated_twist",
    "cobra": "cobra_pose",
    "butterfly": "butterfly_pose",
    "prayer": "pranamasana",
    "raisedarms": "hasta_uttanasana",
    "equestrian": "ashwa_sanchalanasana",
    "eightlimbed": "ashtanga_namaskara",
    "eightlimb": "ashtanga_namaskara",
    "downdog": "downward_dog",
    "childs": "childs_pose",
    "child": "childs_pose",
    "tree": "tree_pose",
    "warrior": "warrior_pose",
    "chair": "chair_pose",
    "triangle": "triangle_pose",
    "bridge": "bridge_pose",
    "boat": "boat_pose",
    "garland": "garland_pose",
    "lunge": "low_lunge",
    "lowlunge": "low_lunge",
    "forwardfold": "forward_bend",
    "forwardbend": "forward_bend",
    "plow": "plow_pose",
}
# Every canonical label also matches with its underscores removed
# ("seatedforwardbend", "catcow", "ashwasanchalanasana", ...).
POSE_ALIASES.update({label.replace("_", ""): label for label in CANONICAL_LABELS})

_SAFE = re.compile(r"[^a-z0-9]+")


@dataclass(frozen=True)
class Clip:
    path: Path
    person: str
    label: str
    pose_token: str
    rest: str


def parse_clip_name(path: Path) -> Clip:
    """``riya_seatedtwist_side.mp4`` -> person ``riya``, label ``seated_twist``.

    Raises ``ValueError`` with a readable message for a name that doesn't fit.
    """
    parts = [p for p in re.split(r"[_\-\s]+", path.stem.lower()) if p]
    if len(parts) < 2:
        raise ValueError(f"{path.name}: expected <person>_<pose>_<anything>{path.suffix}")
    person = parts[0]
    # The pose may be written as several words ("seated_twist", "upward_dog"):
    # take the longest run of words after the person that names a pose.
    for end in range(len(parts), 1, -1):
        pose_token = "".join(parts[1:end])
        label = POSE_ALIASES.get(pose_token) or normalize_label("_".join(parts[1:end]))
        if label in CANONICAL_LABELS:
            rest = "_".join(parts[end:]) or "clip"
            return Clip(path, _SAFE.sub("", person), label, _SAFE.sub("", pose_token),
                        _SAFE.sub("", rest))
    raise ValueError(
        f"{path.name}: unknown pose '{parts[1]}'. "
        f"Use one of: {', '.join(sorted(set(POSE_ALIASES)))}"
    )


def find_clips(video_dir: Path) -> List[Path]:
    return sorted(p for p in video_dir.rglob("*") if p.suffix.lower() in VIDEO_EXTENSIONS)


def extract_frames(
    clip: Clip,
    out_dir: Path,
    interval_sec: float = 0.5,
    max_frames: int = 24,
    overwrite: bool = False,
) -> int:
    """Write sampled frames of one clip as JPEGs; returns how many were written.

    OpenCV applies the video's rotation metadata when decoding, so portrait
    phone clips come out upright.
    """
    capture = cv2.VideoCapture(str(clip.path))
    if not capture.isOpened():
        raise ValueError(f"{clip.path.name}: could not open video")
    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    step = max(1, int(round(fps * interval_sec)))

    out_dir.mkdir(parents=True, exist_ok=True)
    prefix = f"{clip.person}_{clip.pose_token}_{clip.rest}"
    written = index = 0
    try:
        while written < max_frames:
            ok, frame = capture.read()
            if not ok:
                break
            if index % step == 0:
                target = out_dir / f"{prefix}_f{written:04d}.jpg"
                if overwrite or not target.exists():
                    height, width = frame.shape[:2]
                    scale = MAX_FRAME_SIDE / max(height, width)
                    if scale < 1:
                        frame = cv2.resize(frame, (int(width * scale), int(height * scale)),
                                           interpolation=cv2.INTER_AREA)
                    cv2.imwrite(str(target), frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
                written += 1
            index += 1
    finally:
        capture.release()
    return written


def plan_output_dir(clip: Clip, test_people: Sequence[str],
                    train_root: Path = TRAIN_DATASET_DIR,
                    test_root: Path = OWN_TEST_DIR) -> Path:
    root = test_root if clip.person in test_people else train_root
    return root / clip.label


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--videos", type=Path, default=VIDEO_DIR, help="folder of clips")
    parser.add_argument("--test-people", default="",
                        help="comma-separated people held out entirely as the test set")
    parser.add_argument("--interval", type=float, default=0.5, help="seconds between frames")
    parser.add_argument("--max-per-clip", type=int, default=24)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    test_people = [p.strip().lower() for p in args.test_people.split(",") if p.strip()]
    paths = find_clips(args.videos)
    if not paths:
        print(f"No videos found in {args.videos}")
        return 1

    clips, problems = [], []
    for path in paths:
        try:
            clips.append(parse_clip_name(path))
        except ValueError as exc:
            problems.append(str(exc))
    for problem in problems:
        print(f"SKIP  {problem}")

    people = sorted({c.person for c in clips})
    unknown_test = sorted(set(test_people) - set(people))
    if unknown_test:
        print(f"Warning: no clips for test people {unknown_test} (people found: {people})")
    if not test_people:
        print("Note: no --test-people given, so every frame goes to training and "
              "there is no held-out evaluation on unseen people.")

    counts: Counter = Counter()
    for clip in clips:
        out_dir = plan_output_dir(clip, test_people)
        split = "test " if clip.person in test_people else "train"
        if args.dry_run:
            print(f"{split} {clip.label:<22} <- {clip.path.name}")
            counts[(split, clip.label)] += 1
            continue
        try:
            n = extract_frames(clip, out_dir, args.interval, args.max_per_clip, args.overwrite)
        except ValueError as exc:
            print(f"SKIP  {exc}")
            continue
        print(f"{split} {clip.label:<22} {n:>3} frames <- {clip.path.name}")
        counts[(split, clip.label)] += n

    unit = "clips" if args.dry_run else "frames"
    print(f"\nPer pose ({unit}):")
    for label in sorted({label for _, label in counts}):
        print(f"  {label:<22} train {counts[('train', label)]:>4}   test {counts[('test ', label)]:>4}")
    if not args.dry_run:
        print("\nNext:\n  python train_movenet_classifier.py --rebuild-cache --augment-mirror\n"
              "  python eval_pose_metrics.py --test-root dataset_test")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
