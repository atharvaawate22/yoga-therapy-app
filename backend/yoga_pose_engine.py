"""MoveNet + MLP classifier backend for yoga pose analysis.

Pipeline: base64 frame -> padded square -> MoveNet keypoints -> body-presence
gate -> normalized 34-vector -> MLP -> confidence gate -> temporal stability
filter -> rule-based corrections.

Preprocessing, label handling and the MoveNet wrapper live in ``utils/`` and are
shared with the trainer and evaluator, so training and serving cannot drift.

Model runtimes are loaded lazily and injected as FastAPI dependencies, which
keeps import cheap and lets tests substitute stubs via
``app.dependency_overrides``.
"""

from __future__ import annotations

import base64
import logging
import os
import threading
import time
from collections import Counter, OrderedDict, deque
from typing import Any, Deque, Dict, List, Optional

import cv2
import numpy as np
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from utils.dataset import build_feature_dataset
from utils.label_utils import NO_POSE, UNKNOWN, feedback_pose_alias
from utils.model import (
    NumpyClassifier,
    load_classifier,
    load_labels,
    save_classifier,
    train_classifier,
)
from utils.movenet import MoveNetRuntime
from utils.paths import CLASSIFIER_MODEL_PATH, LABELS_PATH, MOVENET_MODEL_PATH
from utils.preprocessing import (
    CORE_KEYPOINTS,
    KEYPOINT_NAMES,
    MAJOR_KEYPOINTS,
    SKELETON_DRAW_MIN_SCORE,
    MAX_DECODE_SIDE,
    SKELETON_EDGES,
    decode_image,
    extract_keypoints_pixels,
    has_body,
    normalize_keypoints,
    preprocess_for_movenet,
)

# `basicConfig` is a no-op when a handler is already installed (e.g. by
# uvicorn's logging config), so this only supplies a sane default.
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)-8s %(name)s | %(message)s",
)
logger = logging.getLogger("yoga_pose_engine")

# ── Decision thresholds ───────────────────────────────────────────────────
# Below this softmax probability we decline to name a pose rather than guess.
MIN_CLASS_PROB = 0.70
# Live frames also pass the stability vote below, which filters one-off wrong
# frames, so they can use a lower cutoff. On out-of-fold predictions (5-fold
# grouped CV) 0.60 vs 0.70 with the vote kept report precision ~95% while
# poses were reported in 55% vs 47% of windows (seated twist: 21% vs 7%).
# Single images have no vote and keep the stricter cutoff.
MIN_CLASS_PROB_LIVE = 0.60
# Live mode only: a pose must win a majority of the recent window to be
# reported, which stops the label flickering during transitions.
STABILITY_WINDOW = 5
STABILITY_MIN_VOTES = 3
# Vote histories are kept per session id; cap how many are remembered so a
# long-running server doesn't grow without bound (oldest idle ones go first).
MAX_TRACKED_SESSIONS = 1000

# Fallback training, used only when no classifier artifact is present.
BOOTSTRAP_LIMIT_PER_CLASS = 120
BOOTSTRAP_EPOCHS = 25
BOOTSTRAP_BATCH_SIZE = 32
BOOTSTRAP_MIN_SAMPLES = 30

VALID_EXPERIENCE_LEVELS = {"beginner", "intermediate", "expert"}

MAX_IMAGE_BASE64_CHARS = 4_000_000


class PoseAnalyzeRequest(BaseModel):
    # ~3 MB of JPEG. The app sends frames resized to 960px (a few hundred KB);
    # anything far larger is a misbehaving client, and the public endpoint
    # shouldn't spend Lambda time decoding it.
    image_base64: str = Field(
        ...,
        max_length=MAX_IMAGE_BASE64_CHARS,
        description="JPEG/PNG frame, optionally a data URL.",
    )
    session_id: Optional[str] = Field(
        None, description="Stable id per live session; enables the stability filter."
    )
    source: str = Field(
        "image", description="'live' enables temporal smoothing; 'image' is one-shot."
    )
    experience_level: str = Field(
        "beginner", description="beginner | intermediate | expert"
    )
    include_debug_image: bool = Field(
        False,
        description="Return the skeleton overlay JPEG. Off by default: the app "
        "never displays it and it multiplied every live response's size.",
    )


class PoseAnalyzeResponse(BaseModel):
    pose: str
    confidence: float
    corrections: List[str]
    distances: Dict[str, float]
    debug_image_base64: Optional[str] = None
    probabilities: Dict[str, float] = {}


app = FastAPI(title="Yoga Pose Engine", version="2.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    # No cookies or auth are used; credentials with a wildcard origin is an
    # invalid CORS combination anyway.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_session_predictions: "OrderedDict[str, Deque[str]]" = OrderedDict()
_session_lock = threading.Lock()
# FastAPI runs sync endpoints on a thread pool; guard lazy model loading so
# concurrent first requests don't each build a runtime.
_runtime_lock = threading.Lock()


# ── Model runtimes ────────────────────────────────────────────────────────


class ClassifierRuntime:
    """The MLP head plus its label ordering."""

    def __init__(self, model: Any = None, labels: Optional[List[str]] = None) -> None:
        self.model = model
        self.labels: List[str] = list(labels or [])

    @classmethod
    def load(cls) -> "ClassifierRuntime":
        if not (CLASSIFIER_MODEL_PATH.exists() and LABELS_PATH.exists()):
            logger.warning(
                "Classifier artifacts missing (%s / %s)",
                CLASSIFIER_MODEL_PATH,
                LABELS_PATH,
            )
            return cls()
        labels = load_labels()
        # numpy inference first: no TensorFlow import, so a cold start doesn't
        # pay for it. Keras is only the fallback (e.g. an unsupported layer).
        try:
            model = NumpyClassifier.from_keras_file(CLASSIFIER_MODEL_PATH)
            logger.info("Classifier loaded with numpy (%d classes)", len(labels))
            return cls(model, labels)
        except Exception:
            logger.exception("numpy classifier load failed; trying Keras")
        try:
            model = load_classifier()
            logger.info("Classifier loaded with Keras (%d classes)", len(labels))
            return cls(model, labels)
        except Exception:
            logger.exception("Could not load classifier; will try bootstrap training")
            return cls()

    def ready(self) -> bool:
        return self.model is not None and len(self.labels) > 0

    def predict(self, normalized_flat: np.ndarray) -> Dict[str, float]:
        if not self.ready():
            return {}
        probs = self.model.predict(np.expand_dims(normalized_flat, axis=0), verbose=0)[0]
        return {label: float(probs[idx]) for idx, label in enumerate(self.labels)}


_movenet_runtime: Optional[MoveNetRuntime] = None
_classifier_runtime: Optional[ClassifierRuntime] = None


def get_movenet() -> MoveNetRuntime:
    """Lazily construct the shared MoveNet runtime (FastAPI dependency)."""
    global _movenet_runtime
    if _movenet_runtime is None:
        with _runtime_lock:
            if _movenet_runtime is None:
                _movenet_runtime = MoveNetRuntime()
    return _movenet_runtime


def get_classifier() -> ClassifierRuntime:
    """Lazily load the classifier, bootstrap-training it only as a last resort."""
    global _classifier_runtime
    if _classifier_runtime is None:
        with _runtime_lock:
            if _classifier_runtime is None:
                runtime = ClassifierRuntime.load()
                if not runtime.ready():
                    bootstrapped = _bootstrap_classifier()
                    if bootstrapped is not None:
                        runtime = bootstrapped
                _classifier_runtime = runtime
    return _classifier_runtime


def reset_runtimes() -> None:
    """Drop cached runtimes. Used by tests; harmless in production."""
    global _movenet_runtime, _classifier_runtime
    _movenet_runtime = None
    _classifier_runtime = None
    with _session_lock:
        _session_predictions.clear()


def _bootstrap_classifier() -> Optional[ClassifierRuntime]:
    """Train a classifier from local images when no saved model exists.

    A serving container normally ships with trained artifacts and never reaches
    this path — the Docker image does not even include the dataset. It exists
    so a fresh checkout with images on disk can serve without a manual step.
    """
    logger.warning("No usable classifier; attempting bootstrap training from disk")
    try:
        features = build_feature_dataset(
            get_movenet(), limit_per_class=BOOTSTRAP_LIMIT_PER_CLASS
        )
    except Exception:
        logger.exception("Bootstrap feature extraction failed")
        return None

    labels = features.labels
    stats = features.stats
    if features.is_empty or len(labels) < 2 or stats.kept < BOOTSTRAP_MIN_SAMPLES:
        logger.error(
            "Bootstrap aborted: need >=%d samples across >=2 classes, got %s",
            BOOTSTRAP_MIN_SAMPLES,
            stats.summary(),
        )
        return None

    try:
        # No validation split here: this is a degraded-mode fallback, not a
        # tuned run. `train_movenet_classifier.py` is the real training path.
        model, _ = train_classifier(
            features.x,
            features.y,
            num_classes=len(labels),
            epochs=BOOTSTRAP_EPOCHS,
            batch_size=BOOTSTRAP_BATCH_SIZE,
            patience=None,
            verbose=0,
        )
        save_classifier(model, labels)
    except Exception:
        logger.exception("Bootstrap training failed")
        return None

    logger.info("Bootstrap training complete (%d classes)", len(labels))
    return ClassifierRuntime(model, labels)


# ── Image helpers ─────────────────────────────────────────────────────────


def _decode_base64_image(image_b64: str) -> np.ndarray:
    if "," in image_b64:
        image_b64 = image_b64.split(",", 1)[1]
    try:
        buffer = base64.b64decode(image_b64, validate=False)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 image payload") from exc
    # Shared with training feature extraction (EXIF rotation + downscale).
    try:
        return decode_image(buffer)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Could not decode image") from exc


def _describe_gate_failure(keypoints: np.ndarray) -> str:
    """Compact, human-readable dump of why ``has_body`` rejected a frame (logs only)."""
    core_scores = ", ".join(
        f"{KEYPOINT_NAMES[idx]}={keypoints[idx, 2]:.2f}" for idx in CORE_KEYPOINTS
    )
    major_visible = sum(1 for idx in MAJOR_KEYPOINTS if keypoints[idx, 2] >= 0.15)
    return f"core: {core_scores} | major_visible: {major_visible}/9"


def _draw_skeleton_base64(image_bgr: np.ndarray, keypoints: np.ndarray) -> Optional[str]:
    overlay = image_bgr.copy()
    drew_any = False
    for a, b in SKELETON_EDGES:
        if (
            keypoints[a, 2] >= SKELETON_DRAW_MIN_SCORE
            and keypoints[b, 2] >= SKELETON_DRAW_MIN_SCORE
        ):
            cv2.line(
                overlay,
                tuple(np.int32(keypoints[a, :2])),
                tuple(np.int32(keypoints[b, :2])),
                (40, 220, 120),
                2,
            )
            drew_any = True
    for idx in range(len(keypoints)):
        if keypoints[idx, 2] >= SKELETON_DRAW_MIN_SCORE:
            cv2.circle(overlay, tuple(np.int32(keypoints[idx, :2])), 3, (255, 90, 40), -1)
            drew_any = True
    if not drew_any:
        return None
    ok, encoded = cv2.imencode(".jpg", overlay)
    if not ok:
        return None
    return base64.b64encode(encoded.tobytes()).decode("ascii")


def _distance_metrics(keypoints: np.ndarray, pose: str) -> Dict[str, float]:
    """Warrior II arm geometry, in percent of torso length (see _to_torso_units)."""
    pose = feedback_pose_alias(pose)
    if pose not in {"warrior", "warrior_pose"}:
        return {}
    kp = _to_torso_units(keypoints)
    left_wrist, right_wrist = kp[9], kp[10]
    wrist_mid_y = (left_wrist[1] + right_wrist[1]) / 2.0
    shoulder_mid_y = (kp[5][1] + kp[6][1]) / 2.0
    return {
        # Horizontal distance between the wrists: how far the arms reach out.
        "warrior_arm_span": round(float(abs(left_wrist[0] - right_wrist[0])), 1),
        # Wrists relative to shoulder height (arms should be level with them).
        "warrior_arm_height_offset": round(float(abs(wrist_mid_y - shoulder_mid_y)), 1),
        # Height difference between the two wrists (arms level with each other).
        "warrior_wrist_height_diff": round(float(abs(left_wrist[1] - right_wrist[1])), 1),
    }


# ── Corrections ───────────────────────────────────────────────────────────

# A rule only runs when every keypoint it measures was detected at least this
# confidently; a guessed position (e.g. an ankle out of frame) otherwise
# produces confident-sounding but meaningless cues.
RULE_MIN_KEYPOINT_SCORE = 0.30

# Shoulder width above this (percent of torso length) means the person faces
# the camera. Side-on, the shoulders overlap and left/right spacing checks
# (hands shoulder-width apart, etc.) can't be judged.
FRONT_FACING_MIN_SHOULDER_WIDTH = 35

NOT_VISIBLE_CUE = "Make sure your whole body is clearly visible so your alignment can be checked"

LS, RS, LE, RE, LW, RW, LH, RH, LK, RK, LA, RA = 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16


def _to_torso_units(keypoints: np.ndarray) -> np.ndarray:
    """Rescale keypoint x/y so 100 units = the person's torso length.

    The correction thresholds used to be raw pixels of the uploaded image, so
    a 30px tolerance meant 15% of the frame on a small photo and under 1% on a
    12MP one: the same pose got different feedback depending on the phone and
    how far away the person stood. Torso length (shoulder midpoint to hip
    midpoint) is used rather than shoulder width because it stays stable from
    a side view, where the two shoulders overlap.
    """
    shoulder_mid = (keypoints[LS, :2] + keypoints[RS, :2]) / 2.0
    hip_mid = (keypoints[LH, :2] + keypoints[RH, :2]) / 2.0
    torso = float(np.linalg.norm(shoulder_mid - hip_mid))
    if torso < 1e-6:
        span = np.max(keypoints[:, :2], axis=0) - np.min(keypoints[:, :2], axis=0)
        torso = float(max(span[0], span[1], 1.0)) / 3.0
    scaled = keypoints.astype(np.float32).copy()
    scaled[:, :2] = keypoints[:, :2] / torso * 100.0
    return scaled


def _joint_angle(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    """Angle at ``b`` in degrees for the chain a-b-c (180 = straight)."""
    v1 = a[:2] - b[:2]
    v2 = c[:2] - b[:2]
    denom = float(np.linalg.norm(v1) * np.linalg.norm(v2))
    if denom < 1e-6:
        return 180.0
    cos = float(np.clip(np.dot(v1, v2) / denom, -1.0, 1.0))
    return float(np.degrees(np.arccos(cos)))


def _generate_corrections(
    pose: str, keypoints: np.ndarray, experience_level: str = "beginner"
) -> List[str]:
    pose = feedback_pose_alias(pose)
    if pose == NO_POSE:
        return [
            "No stable pose detected",
            "Keep your full body visible and hold still for 1 to 2 seconds",
        ]

    # All distances below are in percent of torso length (see _to_torso_units).
    keypoints = _to_torso_units(keypoints)

    # Tolerance thresholds per experience level
    if experience_level == "expert":
        arm_tol = 8
        shoulder_tol = 10
        strict = True
    elif experience_level == "intermediate":
        arm_tol = 15
        shoulder_tol = 18
        strict = False
    else:  # beginner
        arm_tol = 30
        shoulder_tol = 25
        strict = False

    checks_run = 0

    def seen(*indices: int) -> bool:
        """Whether every listed keypoint is reliable enough to measure."""
        nonlocal checks_run
        ok = all(float(keypoints[i, 2]) >= RULE_MIN_KEYPOINT_SCORE for i in indices)
        if ok:
            checks_run += 1
        return ok

    # Keypoint aliases for readability
    l_shoulder, r_shoulder = keypoints[LS], keypoints[RS]
    l_wrist,    r_wrist    = keypoints[LW], keypoints[RW]
    l_hip,      r_hip      = keypoints[LH], keypoints[RH]
    l_knee,     r_knee     = keypoints[LK], keypoints[RK]
    l_ankle,    r_ankle    = keypoints[LA], keypoints[RA]

    shoulder_y = (l_shoulder[1] + r_shoulder[1]) / 2
    hip_y = (l_hip[1] + r_hip[1]) / 2
    wrist_y = (l_wrist[1] + r_wrist[1]) / 2
    knee_y = (l_knee[1] + r_knee[1]) / 2
    shoulders_level = abs(l_shoulder[1] - r_shoulder[1]) <= shoulder_tol
    facing_camera = (
        float(keypoints[LS, 2]) >= RULE_MIN_KEYPOINT_SCORE
        and float(keypoints[RS, 2]) >= RULE_MIN_KEYPOINT_SCORE
        and abs(l_shoulder[0] - r_shoulder[0]) > FRONT_FACING_MIN_SHOULDER_WIDTH
    )

    corrections: List[str] = []
    praise: Optional[str] = None

    # ── 1. Downward-Facing Dog ──
    if pose == "downward_dog":
        if seen(LS, RS) and not shoulders_level:
            corrections.append("Level your shoulders — they should be at equal height")
        if seen(LS, RS, LH, RH) and hip_y >= shoulder_y:
            corrections.append("Lift your hips higher to form a proper inverted V shape")
        if facing_camera and seen(LW, RW) and abs(l_wrist[0] - r_wrist[0]) < 20:
            corrections.append("Spread your hands wider, shoulder-width apart")
        praise = "Great Downward Dog! Press heels toward the floor and breathe."

    # ── 2. Low Lunge ──
    elif pose == "low_lunge":
        if seen(LW, RW, LS, RS) and wrist_y > shoulder_y + arm_tol:
            corrections.append("Raise your arms fully overhead, reaching toward the sky")
        if seen(LS, RS) and not shoulders_level:
            corrections.append("Square your shoulders forward — keep them level")
        praise = "Good Low Lunge! Sink the hips forward and lift your chest."

    # ── 3. Seated Spinal Twist ──
    elif pose == "seated_twist":
        if seen(LS, RS) and abs(l_shoulder[0] - r_shoulder[0]) < 15:
            corrections.append("Rotate your torso more — twist from the ribcage, not the neck")
        if seen(LH, RH) and abs(l_hip[1] - r_hip[1]) > arm_tol:
            corrections.append("Keep both sit bones grounded evenly on the floor")
        praise = "Nice twist! Lengthen the spine upward on every inhale."

    # ── 4. Butterfly Pose ──
    elif pose == "butterfly_pose":
        if seen(LS, RS) and not shoulders_level:
            corrections.append("Keep shoulders level and relaxed away from ears")
        # Upright, the shoulders sit a full torso length above the hips; less
        # than ~80% of that means the spine is slumping or leaning.
        if seen(LS, RS, LH, RH) and hip_y - shoulder_y < 80:
            corrections.append("Sit tall — lengthen your spine upward out of your hips")
        praise = "Great Butterfly Pose! Let gravity gently open your hips."

    # ── 5. Child's Pose ──
    elif pose == "childs_pose":
        # Arms stretched forward on the mat should rest at the same height.
        if seen(LW, RW) and abs(l_wrist[1] - r_wrist[1]) > shoulder_tol:
            corrections.append("Keep arms extended evenly, parallel to each other")
        if seen(LH, RH) and abs(l_hip[1] - r_hip[1]) > arm_tol:
            corrections.append("Sink hips back evenly toward both heels")
        praise = "Perfect Child's Pose! Breathe deeply into the back of the body."

    # ── 6. Cat-Cow ──
    elif pose == "cat_cow":
        if seen(LS, RS) and not shoulders_level:
            corrections.append("Keep your shoulders level — press evenly through both hands")
        if seen(LH, RH) and abs(l_hip[1] - r_hip[1]) > arm_tol:
            corrections.append("Keep your hips level over both knees — don't let them sway")
        praise = "Good Cat-Cow! Sync your breath with each movement."

    # ── 7. Plow Pose ──
    elif pose == "plow_pose":
        if seen(LS, RS) and not shoulders_level:
            corrections.append("Press both shoulders evenly into the floor")
        if seen(LA, RA) and abs(l_ankle[0] - r_ankle[0]) > arm_tol:
            corrections.append("Bring feet together behind your head, toes pointing down")
        praise = "Good Plow Pose! Never turn your head — breathe steadily."

    # ── 8. Garland Pose ──
    elif pose == "garland_pose":
        if seen(LS, RS) and not shoulders_level:
            corrections.append("Keep your chest lifted and shoulders level")
        # In a full squat the hips drop to around knee height.
        if seen(LH, RH, LK, RK) and knee_y - hip_y > 30:
            corrections.append("Squat deeper — lower your hips toward the floor")
        praise = "Great Garland Pose! Press elbows into knees and lengthen spine."

    # ── 9. Boat Pose ──
    elif pose == "boat_pose":
        if seen(LW, RW) and abs(l_wrist[1] - r_wrist[1]) > arm_tol:
            corrections.append("Keep both arms at equal height, parallel to the floor")
        if seen(LS, RS, LH, RH) and shoulder_y > hip_y:
            corrections.append("Lean back slightly more — lift your chest above your hips")
        if strict and seen(LK, RK) and abs(l_knee[1] - r_knee[1]) > arm_tol:
            corrections.append("Keep both legs at equal height")
        praise = "Strong Boat Pose! Keep the spine long, not rounded."

    # ── 10. Seated Forward Bend ──
    elif pose == "seated_forward_bend":
        if seen(LS, RS) and not shoulders_level:
            corrections.append("Keep shoulders level as you fold forward")
        if seen(LS, RS, LH, RH) and shoulder_y < hip_y - 20:
            corrections.append("Fold forward more — hinge from your hips, not your waist")
        praise = "Good Seated Forward Bend! Breathe into the back of the legs."

    # ── 11. Shoulder Stand ──
    elif pose == "shoulder_stand":
        if seen(LS, RS) and not shoulders_level:
            corrections.append("Press both shoulders evenly into the mat")
        if seen(LA, RA) and abs(l_ankle[0] - r_ankle[0]) > arm_tol:
            corrections.append("Keep both feet together directly above your hips")
        praise = "Great Shoulder Stand! Never turn your head — breathe slowly."

    # ── 12. Bridge Pose ──
    elif pose == "bridge_pose":
        if seen(LK, RK) and abs(l_knee[0] - r_knee[0]) > arm_tol * 1.5:
            corrections.append("Keep knees hip-width apart — don't let them fall outward")
        if seen(LS, RS, LH, RH) and hip_y >= shoulder_y:
            corrections.append("Lift your hips higher — squeeze your glutes at the top")
        if seen(LS, RS) and not shoulders_level:
            corrections.append("Keep both shoulders flat on the mat")
        praise = "Great Bridge Pose! Keep squeezing the glutes and breathe."

    # ── 13. Triangle Pose ──
    elif pose == "triangle_pose":
        if seen(LW, RW) and abs(l_wrist[1] - r_wrist[1]) < arm_tol and abs(l_wrist[0] - r_wrist[0]) < 20:
            corrections.append("Extend the top arm straight up toward the ceiling")
        if seen(LS, RS) and abs(l_shoulder[1] - r_shoulder[1]) < 15:
            corrections.append("Stack your shoulders vertically — open the chest to the sky")
        praise = "Good Triangle Pose! Keep both legs straight and breathe."

    # ── 14. Upward-Facing Dog ──
    elif pose == "upward_dog":
        if seen(LS, RS) and not shoulders_level:
            corrections.append("Keep shoulders level — draw them down away from ears")
        if facing_camera and seen(LW, RW) and abs(l_wrist[0] - r_wrist[0]) < 20:
            corrections.append("Place hands wider, directly under your shoulders")
        praise = "Nice Upward Dog! Lift the chest high and draw shoulder blades together."

    # ── 15. Chair Pose ──
    elif pose == "chair_pose":
        if seen(LW, RW, LS, RS) and wrist_y > shoulder_y + arm_tol:
            corrections.append("Raise both arms fully overhead alongside your ears")
        if seen(LK, RK) and abs(l_knee[0] - r_knee[0]) > arm_tol * 1.5:
            corrections.append("Keep knees together — don't let them splay outward")
        praise = "Strong Chair Pose! Sit lower and keep chest lifted."

    # ── 16. Standing Forward Fold ──
    elif pose == "forward_bend":
        if seen(LS, RS) and not shoulders_level:
            corrections.append("Keep shoulders level as you fold — don't twist the torso")
        if seen(LH, RH) and abs(l_hip[0] - r_hip[0]) > arm_tol:
            corrections.append("Square both hips evenly over both feet")
        praise = "Good Forward Fold! Let the neck fully relax and breathe deeply."

    # ── 17. Warrior II ──
    elif pose == "warrior_pose":
        if seen(LW, RW) and abs(l_wrist[1] - r_wrist[1]) > arm_tol:
            corrections.append("Keep both arms level — extend equally left and right")
        if seen(LS, RS) and not shoulders_level:
            corrections.append("Keep shoulders relaxed and level — don't shrug")
        if strict and seen(LH, RH, LK, RK, LA, RA):
            # The front leg is the bent one; it may be either side.
            left_bend = _joint_angle(l_hip, l_knee, l_ankle)
            right_bend = _joint_angle(r_hip, r_knee, r_ankle)
            front_knee, front_ankle = (
                (l_knee, l_ankle) if left_bend <= right_bend else (r_knee, r_ankle)
            )
            if abs(front_knee[0] - front_ankle[0]) > arm_tol:
                corrections.append("Align front knee directly over the ankle")
        praise = "Powerful Warrior Two! Sink the front knee deeper and gaze forward."

    # ── 18. Tree Pose ──
    elif pose == "tree_pose":
        if seen(LS, RS) and not shoulders_level:
            corrections.append("Level your shoulders — open the chest and broaden it")
        if seen(LH, RH) and abs(l_hip[1] - r_hip[1]) > arm_tol:
            corrections.append("Keep hips level — don't let the standing-leg hip push out")
        # Hands overhead or pressed together at the chest are both correct;
        # only arms hanging apart below the shoulders get a cue.
        if seen(LW, RW, LS, RS):
            hands_apart = abs(l_wrist[0] - r_wrist[0]) > 40
            if wrist_y > shoulder_y + arm_tol and hands_apart:
                corrections.append("Raise arms overhead or keep hands at heart center")
        praise = "Beautiful Tree Pose! Fix your gaze on a still point and breathe."

    # Fallback: poses without specific rules (e.g. the Surya Namaskar steps)
    else:
        if experience_level == "expert":
            corrections.append("Excellent form! Maintain precise alignment and steady breath.")
        elif experience_level == "intermediate":
            corrections.append("Good alignment. Focus on deepening the pose with each exhale.")
        else:
            corrections.append("Great job! Keep breathing steadily and hold the pose.")

    if not corrections:
        # Only praise form that was actually checked.
        corrections.append(praise if checks_run else NOT_VISIBLE_CUE)

    if len(corrections) > 1 and experience_level == "expert" and strict:
        corrections = corrections[:2]  # experts get max 2 precise cues

    return corrections


def _apply_stability(session_id: Optional[str], source: str, pose: str) -> str:
    if source != "live" or not session_id:
        return pose
    with _session_lock:
        history = _session_predictions.pop(session_id, None)
        if history is None:
            history = deque(maxlen=STABILITY_WINDOW)
        history.append(pose)
        _session_predictions[session_id] = history  # most recently used last
        while len(_session_predictions) > MAX_TRACKED_SESSIONS:
            _session_predictions.popitem(last=False)
        stable_pose, stable_count = Counter(history).most_common(1)[0]
    if stable_count >= STABILITY_MIN_VOTES:
        return stable_pose
    return NO_POSE


def _response_for_nopose(
    message: str, debug_image_base64: Optional[str]
) -> PoseAnalyzeResponse:
    return PoseAnalyzeResponse(
        pose=NO_POSE,
        confidence=0.0,
        corrections=[message],
        distances={},
        debug_image_base64=debug_image_base64,
        probabilities={},
    )


def _format_top_k(probabilities: Dict[str, float], k: int = 3) -> str:
    """Compact log line: the k most likely classes, not the full distribution."""
    top = sorted(probabilities.items(), key=lambda kv: kv[1], reverse=True)[:k]
    return ", ".join(f"{label}={prob:.3f}" for label, prob in top)


# ── Routes ────────────────────────────────────────────────────────────────


@app.get("/health")
def health() -> dict:
    """Liveness and model-availability probe.

    Deliberately cheap: it reports whether artifacts are loaded or present on
    disk without forcing a load, so probing does not pull ~9 MB of model into
    memory or trigger bootstrap training.
    """
    loaded = _classifier_runtime is not None and _classifier_runtime.ready()
    artifacts_present = CLASSIFIER_MODEL_PATH.exists() and LABELS_PATH.exists()
    return {
        "status": "ok",
        "service": "yoga-pose-engine",
        "classifier_ready": bool(loaded or artifacts_present),
        "classifier_loaded": bool(loaded),
        "movenet_present": MOVENET_MODEL_PATH.exists(),
    }


@app.post("/analyze-pose", response_model=PoseAnalyzeResponse)
def analyze_pose(
    payload: PoseAnalyzeRequest,
    movenet: MoveNetRuntime = Depends(get_movenet),
    classifier: ClassifierRuntime = Depends(get_classifier),
) -> PoseAnalyzeResponse:
    started = time.perf_counter()

    if not payload.image_base64.strip():
        raise HTTPException(status_code=400, detail="image_base64 is required")

    # Unknown levels fall back to the most forgiving thresholds rather than
    # rejecting the request: this runs in a live loop where a hard failure
    # would interrupt the user's practice.
    experience = (
        payload.experience_level
        if payload.experience_level in VALID_EXPERIENCE_LEVELS
        else "beginner"
    )

    image_bgr = _decode_base64_image(payload.image_base64)
    cropped_bgr, image_rgb = preprocess_for_movenet(image_bgr)

    output = movenet.infer(image_rgb)
    keypoints = extract_keypoints_pixels(output, image_rgb.shape[1], image_rgb.shape[0])
    drawable = bool(np.any(keypoints[:, 2] >= SKELETON_DRAW_MIN_SCORE))
    skeleton_base64 = (
        _draw_skeleton_base64(cropped_bgr, keypoints)
        if payload.include_debug_image
        else None
    )

    logger.debug("keypoints=%s", np.round(keypoints, 3).tolist())

    if not drawable or not has_body(keypoints):
        diagnostic = _describe_gate_failure(keypoints)
        logger.info(
            "source=%s pose=%s reason=no_body latency_ms=%.0f %s",
            payload.source,
            NO_POSE,
            (time.perf_counter() - started) * 1000,
            diagnostic,
        )
        # The keypoint scores stay in the log line above. The user-facing text
        # must be stable: the app speaks corrections[0] aloud and only skips
        # repeats, so a per-frame number dump was read out every second.
        return _response_for_nopose(
            "No full-body skeleton detected. Step back so your whole body is in frame.",
            skeleton_base64,
        )

    normalized = normalize_keypoints(keypoints)
    logger.debug("normalized=%s", np.round(normalized, 4).tolist())

    if not classifier.ready():
        logger.error("Classifier unavailable — cannot classify request")
        return PoseAnalyzeResponse(
            pose=NO_POSE,
            confidence=0.0,
            corrections=[
                "Classifier model not found. Train and save "
                "models/pose_classifier.keras and models/pose_labels.json",
            ],
            distances={},
            debug_image_base64=skeleton_base64,
            probabilities={},
        )

    probabilities = classifier.predict(normalized)
    if not probabilities:
        logger.error("Classifier returned an empty distribution")
        return _response_for_nopose("Classifier prediction failed", skeleton_base64)

    best_pose = max(probabilities, key=probabilities.get)
    best_prob = float(probabilities[best_pose])

    is_live = payload.source == "live" and bool(payload.session_id)
    min_prob = MIN_CLASS_PROB_LIVE if is_live else MIN_CLASS_PROB
    candidate_pose = best_pose if best_prob >= min_prob else NO_POSE
    if best_pose in {UNKNOWN, NO_POSE}:
        candidate_pose = NO_POSE

    final_pose = _apply_stability(payload.session_id, payload.source, candidate_pose)
    final_confidence = best_prob if final_pose != NO_POSE else 0.0
    corrections = _generate_corrections(final_pose, keypoints, experience)
    distances = _distance_metrics(keypoints, final_pose)

    logger.info(
        "source=%s level=%s pose=%s conf=%.3f top=[%s] corrections=%d latency_ms=%.0f",
        payload.source,
        experience,
        final_pose,
        final_confidence,
        _format_top_k(probabilities),
        len(corrections),
        (time.perf_counter() - started) * 1000,
    )

    return PoseAnalyzeResponse(
        pose=final_pose,
        confidence=round(float(final_confidence), 3),
        corrections=corrections,
        distances=distances,
        debug_image_base64=skeleton_base64,
        probabilities={k: round(v, 4) for k, v in probabilities.items()},
    )
