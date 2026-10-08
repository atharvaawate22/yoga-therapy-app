"""Golden fixtures that hold the TypeScript port (packages/pose-core) to this server.

    python export_parity_fixtures.py     # writes ../packages/pose-core/fixtures/parity.json.gz

Everything after MoveNet is logic: the body gate, features, classifier,
confidence cutoffs, the live stability vote and the correction rules. This
script runs the server's own functions on thousands of inputs and records
what they return; pose-core's tests must reproduce every output.

- Correction cases: keypoint sets derived from the real lab-fixture skeletons
  (random scale, shift, rotation, jitter, mirroring, hidden joints, collapsed
  torsos), each run through `_generate_corrections` for every pose name and
  experience level, plus `_distance_metrics`.
- Pipeline cases: raw MoveNet outputs (real and perturbed) through the
  post-MoveNet part of `/analyze-pose`, for each MoveNet variant's classifier.
- Vote cases: label sequences through `_apply_stability`.

Python computes in float32 and TypeScript in float64. A case whose result
flips under a 1e-5 nudge sits on a decision boundary, where the two can
legitimately disagree, so it is resampled rather than recorded.

The header records hashes of every source this depends on, so pose-core's
tests fail when the Python changes and the fixtures weren't regenerated.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import uuid
from pathlib import Path
from typing import Dict, List, Optional, Sequence

import numpy as np

import yoga_pose_engine as engine
from utils.label_utils import NO_POSE, UNKNOWN
from utils.model import NumpyClassifier, load_labels
from utils.paths import BASE_DIR, CLASSIFIER_MODEL_PATHS
from utils.preprocessing import (
    MIRROR_PAIRS,
    SKELETON_DRAW_MIN_SCORE,
    extract_keypoints_pixels,
    has_body,
    normalize_keypoints,
)

REPO = BASE_DIR.parent
DEFAULT_OUT = REPO / "packages" / "pose-core" / "fixtures" / "parity.json.gz"
LAB_MANIFEST = REPO / "web" / "public" / "lab" / "fixtures" / "manifest.json"

# Hashed into the fixture header (text files with line endings normalized,
# so a Windows checkout hashes the same as CI).
SOURCES = [
    "backend/yoga_pose_engine.py",
    "backend/utils/preprocessing.py",
    "backend/utils/label_utils.py",
    "backend/models/pose_labels.json",
    "backend/models/pose_classifier.keras",
    "backend/models/pose_classifier_lightning.keras",
    "backend/export_parity_fixtures.py",
    "web/public/lab/fixtures/manifest.json",
]

LEVELS = ["beginner", "intermediate", "expert"]
# Legacy labels exercise feedback_pose_alias; the last one has no rules.
EXTRA_POSES = ["adho_mukha_svanasana", "bhujangasana", "uttanasana", "not_a_real_pose"]
NUDGE = 1e-5
NO_BODY_MESSAGE = "No full-body skeleton detected. Step back so your whole body is in frame."


def source_hash(relative: str) -> str:
    data = (REPO / relative).read_bytes()
    if not relative.endswith(".keras"):
        data = data.replace(b"\r\n", b"\n")
    return hashlib.sha256(data).hexdigest()


class Strings:
    """Correction texts are stored once and referenced by index."""

    def __init__(self) -> None:
        self.items: List[str] = []
        self.index: Dict[str, int] = {}

    def ids(self, texts: Sequence[str]) -> List[int]:
        out = []
        for text in texts:
            if text not in self.index:
                self.index[text] = len(self.items)
                self.items.append(text)
            out.append(self.index[text])
        return out


def quantize(keypoints: np.ndarray) -> np.ndarray:
    """4-decimal coordinates and 3-decimal scores: exact in JSON, kept off thresholds."""
    out = keypoints.astype(np.float64).copy()
    out[:, :2] = np.round(out[:, :2], 4)
    out[:, 2] = np.clip(np.round(out[:, 2], 3), 0.0, 1.0)
    return out


def mirror_keypoints(keypoints: np.ndarray) -> np.ndarray:
    out = keypoints.copy()
    for a, b in MIRROR_PAIRS:
        out[[a, b]] = out[[b, a]]
    out[:, 0] = 1.0 - out[:, 0]
    return out


def perturb(base: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """A plausible new skeleton near a real one."""
    kp = base.copy()
    if rng.random() < 0.5:
        kp = mirror_keypoints(kp)
    centre = kp[:, :2].mean(axis=0)
    angle = np.deg2rad(rng.uniform(-15, 15))
    rot = np.array([[np.cos(angle), -np.sin(angle)], [np.sin(angle), np.cos(angle)]])
    scale = rng.uniform(0.6, 1.4)
    kp[:, :2] = (kp[:, :2] - centre) @ rot.T * scale + centre + rng.uniform(-0.15, 0.15, 2)
    kp[:, :2] += rng.normal(0, rng.choice([0.005, 0.02, 0.05]), kp[:, :2].shape)
    kp[:, 2] = np.clip(kp[:, 2] + rng.normal(0, 0.1, 17), 0, 1)
    if rng.random() < 0.35:  # hide some joints (rules must skip them)
        hidden = rng.choice(17, size=rng.integers(1, 6), replace=False)
        kp[hidden, 2] = rng.uniform(0, 0.29, hidden.size)
    return kp


def corrections_for_all(keypoints: np.ndarray, poses: Sequence[str]) -> List[List[List[str]]]:
    kp = keypoints.astype(np.float32)
    return [[engine._generate_corrections(pose, kp, level) for level in LEVELS] for pose in poses]


def distances(keypoints: np.ndarray) -> Dict[str, float]:
    return engine._distance_metrics(keypoints.astype(np.float32), "warrior_pose")


def stable(fn, keypoints: np.ndarray, rng: np.random.Generator) -> bool:
    """Same result after two tiny random nudges of the coordinates?"""
    reference = fn(keypoints)
    for _ in range(2):
        nudged = keypoints.copy()
        nudged[:, :2] += rng.uniform(-NUDGE, NUDGE, nudged[:, :2].shape)
        if fn(nudged) != reference:
            return False
    return True


def correction_cases(bases: List[np.ndarray], poses: List[str], count: int, strings: Strings, rng) -> list:
    cases, rejected = [], 0
    while len(cases) < count:
        kp = quantize(perturb(bases[rng.integers(len(bases))], rng))
        if not stable(lambda k: corrections_for_all(k, poses), kp, rng) or not stable(
            lambda k: {key: round(v, 1) for key, v in distances(k).items()}, kp, rng
        ):
            rejected += 1
            continue
        cases.append(
            {
                "kp": kp.reshape(-1).tolist(),
                "corrections": [[strings.ids(c) for c in per_pose] for per_pose in corrections_for_all(kp, poses)],
                "distances": distances(kp),
            }
        )
    # Collapsed torsos take the fallback scale. Shoulders and hips coincide,
    # so comparisons between them are exact ties, identical in both languages.
    for base in bases[:8]:
        kp = quantize(base.copy())
        kp[[5, 6, 11, 12], :2] = kp[5, :2]
        case = {
            "kp": kp.reshape(-1).tolist(),
            "corrections": [[strings.ids(c) for c in per_pose] for per_pose in corrections_for_all(kp, poses)],
            "exact": True,
        }
        # The rounded distances aren't exact ties, so they still need the
        # boundary check; drop them where float32 rounding is fragile.
        if stable(lambda k: {key: round(v, 1) for key, v in distances(k).items()}, kp, rng):
            case["distances"] = distances(kp)
        cases.append(case)
    print(f"  correction cases: {len(cases)} ({rejected} boundary cases resampled)")
    return cases


def analyse_raw(raw: np.ndarray, classifier: NumpyClassifier, labels: List[str]) -> dict:
    """The post-MoveNet part of /analyze-pose for one frame, image mode."""
    keypoints = extract_keypoints_pixels(raw.astype(np.float32), 1, 1)
    drawable = bool(np.any(keypoints[:, 2] >= SKELETON_DRAW_MIN_SCORE))
    if not drawable or not has_body(keypoints):
        return {"body": False}
    probs = classifier.predict(normalize_keypoints(keypoints)[None, :])[0]
    best = int(np.argmax(probs))
    second = float(np.sort(probs)[-2])
    return {"body": True, "best": labels[best], "prob": float(probs[best]), "margin": float(probs[best]) - second}


def pipeline_cases(raws: List[np.ndarray], variant: str, count: int, strings: Strings, rng) -> list:
    classifier = NumpyClassifier.from_keras_file(CLASSIFIER_MODEL_PATHS[variant])
    labels = load_labels()
    thresholds = (engine.MIN_CLASS_PROB, engine.MIN_CLASS_PROB_LIVE)
    cases, rejected = [], 0
    candidates = [(raw, True) for raw in raws]
    while len(cases) < count:
        if candidates:
            raw, real = candidates.pop()
        else:
            base = raws[rng.integers(len(raws))]
            kp = perturb(base[:, [1, 0, 2]], rng)  # perturb works on (x, y, score)
            raw, real = kp[:, [1, 0, 2]], False
        raw = quantize(raw[:, [1, 0, 2]])[:, [1, 0, 2]]  # quantize in (x, y, score) layout

        result = analyse_raw(raw, classifier, labels)
        fragile = result["body"] and (
            result["margin"] < 1e-4 or any(abs(result["prob"] - t) < 1e-4 for t in thresholds)
        )
        if fragile or not stable(lambda r: analyse_raw(r[:, [1, 0, 2]], classifier, labels).get("best", "-"), raw[:, [1, 0, 2]], rng):
            rejected += 1
            continue

        keypoints = extract_keypoints_pixels(raw.astype(np.float32), 1, 1)
        case = {"raw": raw.reshape(-1).tolist(), "real": real, "body": result["body"]}
        if result["body"]:
            case["best"] = result["best"]
            case["prob"] = result["prob"]
            served = result["best"] if result["prob"] >= engine.MIN_CLASS_PROB else NO_POSE
            if result["best"] in {UNKNOWN, NO_POSE}:
                served = NO_POSE
            case["imagePose"] = served
            # Live mode uses the lower cutoff, then the stability vote (voteCases).
            live = result["best"] if result["prob"] >= engine.MIN_CLASS_PROB_LIVE else NO_POSE
            case["liveCandidate"] = NO_POSE if result["best"] in {UNKNOWN, NO_POSE} else live
            case["corrections"] = [
                strings.ids(engine._generate_corrections(served, keypoints, level)) for level in LEVELS
            ]
        else:
            case["corrections"] = [strings.ids([NO_BODY_MESSAGE])] * len(LEVELS)
        cases.append(case)
    print(f"  pipeline cases ({variant}): {len(cases)} ({rejected} boundary cases resampled)")
    return cases


def vote_cases(labels: List[str], count: int, rng) -> list:
    alphabet = labels[:4] + [NO_POSE]
    cases = []
    for _ in range(count):
        session = f"parity-{uuid.uuid4()}"
        length = int(rng.integers(1, 16))
        # Runs of the same label, like real frames.
        sequence: List[str] = []
        while len(sequence) < length:
            sequence += [str(rng.choice(alphabet))] * int(rng.integers(1, 5))
        sequence = sequence[:length]
        outputs = [engine._apply_stability(session, "live", pose) for pose in sequence]
        cases.append({"sequence": sequence, "outputs": outputs})
    return cases


def build(seed: int, correction_count: int, pipeline_count: int, vote_count: int) -> dict:
    rng = np.random.default_rng(seed)
    manifest = json.loads(LAB_MANIFEST.read_text(encoding="utf-8"))
    labels = load_labels()
    poses = labels + EXTRA_POSES + [NO_POSE]
    strings = Strings()

    raws: Dict[str, List[np.ndarray]] = {"thunder": [], "lightning": []}
    for image in manifest["images"]:
        for variant in raws:
            raws[variant].append(np.asarray(image["expected"][variant]["raw"], dtype=np.float64).reshape(17, 3))
    bases = [raw[:, [1, 0, 2]] for variant_raws in raws.values() for raw in variant_raws]

    print("Generating parity fixtures")
    fixture = {
        "description": "Golden outputs of the server's pose logic (backend/export_parity_fixtures.py). Do not edit.",
        "seed": seed,
        "sources": {path: source_hash(path) for path in SOURCES},
        "levels": LEVELS,
        "poses": poses,
        "thresholds": {
            "minClassProb": engine.MIN_CLASS_PROB,
            "minClassProbLive": engine.MIN_CLASS_PROB_LIVE,
            "stabilityWindow": engine.STABILITY_WINDOW,
            "stabilityMinVotes": engine.STABILITY_MIN_VOTES,
        },
        "noBodyMessage": NO_BODY_MESSAGE,
        "correctionCases": correction_cases(bases, poses, correction_count, strings, rng),
        "pipelineCases": {
            variant: pipeline_cases(raws[variant], variant, pipeline_count, strings, rng) for variant in raws
        },
        "voteCases": vote_cases(labels, vote_count, rng),
    }
    fixture["strings"] = strings.items
    return fixture


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--seed", type=int, default=20261008)
    parser.add_argument("--corrections", type=int, default=1000)
    parser.add_argument("--pipeline", type=int, default=500)
    parser.add_argument("--votes", type=int, default=300)
    args = parser.parse_args()

    fixture = build(args.seed, args.corrections, args.pipeline, args.votes)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(fixture, separators=(",", ":")).encode("utf-8")
    # mtime=0: the same fixture always gzips to the same bytes.
    args.out.write_bytes(gzip.compress(payload, mtime=0))
    print(f"Wrote {args.out} ({args.out.stat().st_size // 1024} KB gzipped, {len(payload) // 1024} KB raw)")


if __name__ == "__main__":
    main()
