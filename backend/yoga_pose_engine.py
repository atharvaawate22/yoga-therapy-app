"""MoveNet + MLP classifier backend for yoga pose analysis.

Pipeline: base64 frame -> square crop -> MoveNet keypoints -> body-presence
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
import time
from collections import Counter, defaultdict, deque
from typing import Any, Deque, Dict, List, Optional

import cv2
import numpy as np
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from utils.dataset import build_feature_dataset
from utils.label_utils import NO_POSE, UNKNOWN, feedback_pose_alias
from utils.model import load_classifier, load_labels, save_classifier, train_classifier
from utils.movenet import MoveNetRuntime
from utils.paths import CLASSIFIER_MODEL_PATH, LABELS_PATH, MOVENET_MODEL_PATH
from utils.preprocessing import (
    SKELETON_DRAW_MIN_SCORE,
    SKELETON_EDGES,
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
# Live mode only: a pose must win a majority of the recent window to be
# reported, which stops the label flickering during transitions.
STABILITY_WINDOW = 5
STABILITY_MIN_VOTES = 3

# Fallback training, used only when no classifier artifact is present.
BOOTSTRAP_LIMIT_PER_CLASS = 120
BOOTSTRAP_EPOCHS = 25
BOOTSTRAP_BATCH_SIZE = 32
BOOTSTRAP_MIN_SAMPLES = 30

VALID_EXPERIENCE_LEVELS = {"beginner", "intermediate", "expert"}


class PoseAnalyzeRequest(BaseModel):
    image_base64: str = Field(..., description="JPEG/PNG frame, optionally a data URL.")
    session_id: Optional[str] = Field(
        None, description="Stable id per live session; enables the stability filter."
    )
    source: str = Field(
        "image", description="'live' enables temporal smoothing; 'image' is one-shot."
    )
    experience_level: str = Field(
        "beginner", description="beginner | intermediate | expert"
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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_session_predictions: Dict[str, Deque[str]] = defaultdict(
    lambda: deque(maxlen=STABILITY_WINDOW)
)


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
        try:
            model = load_classifier()
            labels = load_labels()
            logger.info("Classifier loaded (%d classes)", len(labels))
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
        _movenet_runtime = MoveNetRuntime()
    return _movenet_runtime


def get_classifier() -> ClassifierRuntime:
    """Lazily load the classifier, bootstrap-training it only as a last resort."""
    global _classifier_runtime
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
    image = cv2.imdecode(np.frombuffer(buffer, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Could not decode image")
    return image


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
    pose = feedback_pose_alias(pose)
    if pose not in {"warrior", "warrior_pose"}:
        return {}
    left_wrist = keypoints[9]
    right_wrist = keypoints[10]
    left_shoulder = keypoints[5]
    right_shoulder = keypoints[6]
    wrist_mid = (left_wrist[:2] + right_wrist[:2]) / 2.0
    shoulder_mid = (left_shoulder[:2] + right_shoulder[:2]) / 2.0
    return {
        "warrior_arm_lateral": float(abs(left_wrist[1] - right_wrist[1])),
        "warrior_arm_vertical": float(abs(wrist_mid[1] - shoulder_mid[1])),
        "warrior_arm_depth": float(abs(left_wrist[0] - right_wrist[0])),
    }


# ── Corrections ───────────────────────────────────────────────────────────


def _generate_corrections(
    pose: str, keypoints: np.ndarray, experience_level: str = "beginner"
) -> List[str]:
    pose = feedback_pose_alias(pose)
    if pose == NO_POSE:
        return [
            "No stable pose detected",
            "Keep your full body visible and hold still for 1 to 2 seconds",
        ]

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

    # Keypoint aliases for readability
    l_shoulder, r_shoulder = keypoints[5], keypoints[6]
    l_elbow,    r_elbow    = keypoints[7], keypoints[8]
    l_wrist,    r_wrist    = keypoints[9], keypoints[10]
    l_hip,      r_hip      = keypoints[11], keypoints[12]
    l_knee,     r_knee     = keypoints[13], keypoints[14]
    l_ankle,    r_ankle    = keypoints[15], keypoints[16]

    corrections: List[str] = []

    # ── 1. Downward-Facing Dog ──
    if pose == "downward_dog":
        if abs(l_shoulder[1] - r_shoulder[1]) > shoulder_tol:
            corrections.append("Level your shoulders — they should be at equal height")
        hip_y = (l_hip[1] + r_hip[1]) / 2
        shoulder_y = (l_shoulder[1] + r_shoulder[1]) / 2
        if hip_y >= shoulder_y:
            corrections.append("Lift your hips higher to form a proper inverted V shape")
        if abs(l_wrist[0] - r_wrist[0]) < 20:
            corrections.append("Spread your hands wider, shoulder-width apart")
        if not corrections:
            corrections.append("Great Downward Dog! Press heels toward the floor and breathe.")

    # ── 2. Low Lunge ──
    elif pose == "low_lunge":
        wrist_y = (l_wrist[1] + r_wrist[1]) / 2
        shoulder_y = (l_shoulder[1] + r_shoulder[1]) / 2
        if wrist_y > shoulder_y + arm_tol:
            corrections.append("Raise your arms fully overhead, reaching toward the sky")
        if abs(l_shoulder[1] - r_shoulder[1]) > shoulder_tol:
            corrections.append("Square your shoulders forward — keep them level")
        if not corrections:
            corrections.append("Good Low Lunge! Sink the hips forward and lift your chest.")

    # ── 3. Seated Spinal Twist ──
    elif pose == "seated_twist":
        if abs(l_shoulder[0] - r_shoulder[0]) < 15:
            corrections.append("Rotate your torso more — twist from the ribcage, not the neck")
        if abs(l_hip[1] - r_hip[1]) > arm_tol:
            corrections.append("Keep both sit bones grounded evenly on the floor")
        if not corrections:
            corrections.append("Nice twist! Lengthen the spine upward on every inhale.")

    # ── 4. Butterfly Pose ──
    elif pose == "butterfly_pose":
        if abs(l_shoulder[1] - r_shoulder[1]) > shoulder_tol:
            corrections.append("Keep shoulders level and relaxed away from ears")
        shoulder_y = (l_shoulder[1] + r_shoulder[1]) / 2
        hip_y = (l_hip[1] + r_hip[1]) / 2
        if shoulder_y < hip_y - 30:
            corrections.append("Sit tall — lengthen your spine upward out of your hips")
        if not corrections:
            corrections.append("Great Butterfly Pose! Let gravity gently open your hips.")

    # ── 5. Child's Pose ──
    elif pose == "childs_pose":
        if abs(l_shoulder[0] - r_shoulder[0]) > 30:
            corrections.append("Keep arms extended evenly, parallel to each other")
        if abs(l_hip[1] - r_hip[1]) > arm_tol:
            corrections.append("Sink hips back evenly toward both heels")
        if not corrections:
            corrections.append("Perfect Child's Pose! Breathe deeply into the back of the body.")

    # ── 6. Cat-Cow ──
    elif pose == "cat_cow":
        if abs(l_shoulder[1] - r_shoulder[1]) > shoulder_tol:
            corrections.append("Keep wrists directly under shoulders — level them out")
        if abs(l_hip[1] - r_hip[1]) > arm_tol:
            corrections.append("Keep knees directly under hips — don't let them sway")
        if not corrections:
            corrections.append("Good Cat-Cow! Sync your breath with each movement.")

    # ── 7. Plow Pose ──
    elif pose == "plow_pose":
        if abs(l_shoulder[1] - r_shoulder[1]) > shoulder_tol:
            corrections.append("Press both shoulders evenly into the floor")
        if abs(l_ankle[0] - r_ankle[0]) > arm_tol:
            corrections.append("Bring feet together behind your head, toes pointing down")
        if not corrections:
            corrections.append("Good Plow Pose! Never turn your head — breathe steadily.")

    # ── 8. Garland Pose ──
    elif pose == "garland_pose":
        if abs(l_shoulder[1] - r_shoulder[1]) > shoulder_tol:
            corrections.append("Keep your chest lifted and shoulders level")
        shoulder_y = (l_shoulder[1] + r_shoulder[1]) / 2
        hip_y = (l_hip[1] + r_hip[1]) / 2
        if hip_y < shoulder_y:
            corrections.append("Squat deeper — lower your hips toward the floor")
        if not corrections:
            corrections.append("Great Garland Pose! Press elbows into knees and lengthen spine.")

    # ── 9. Boat Pose ──
    elif pose == "boat_pose":
        if abs(l_wrist[1] - r_wrist[1]) > arm_tol:
            corrections.append("Keep both arms at equal height, parallel to the floor")
        shoulder_y = (l_shoulder[1] + r_shoulder[1]) / 2
        hip_y = (l_hip[1] + r_hip[1]) / 2
        if shoulder_y > hip_y:
            corrections.append("Lean back slightly more — lift your chest above your hips")
        if strict:
            if abs(l_knee[1] - r_knee[1]) > arm_tol:
                corrections.append("Keep both legs at equal height")
        if not corrections:
            corrections.append("Strong Boat Pose! Keep the spine long, not rounded.")

    # ── 10. Seated Forward Bend ──
    elif pose == "seated_forward_bend":
        if abs(l_shoulder[1] - r_shoulder[1]) > shoulder_tol:
            corrections.append("Keep shoulders level as you fold forward")
        shoulder_y = (l_shoulder[1] + r_shoulder[1]) / 2
        hip_y = (l_hip[1] + r_hip[1]) / 2
        if shoulder_y < hip_y - 20:
            corrections.append("Fold forward more — hinge from your hips, not your waist")
        if not corrections:
            corrections.append("Good Seated Forward Bend! Breathe into the back of the legs.")

    # ── 11. Shoulder Stand ──
    elif pose == "shoulder_stand":
        if abs(l_shoulder[1] - r_shoulder[1]) > shoulder_tol:
            corrections.append("Press both shoulders evenly into the mat")
        if abs(l_ankle[0] - r_ankle[0]) > arm_tol:
            corrections.append("Keep both feet together directly above your hips")
        if not corrections:
            corrections.append("Great Shoulder Stand! Never turn your head — breathe slowly.")

    # ── 12. Bridge Pose ──
    elif pose == "bridge_pose":
        if abs(l_knee[0] - r_knee[0]) > arm_tol * 1.5:
            corrections.append("Keep knees hip-width apart — don't let them fall outward")
        hip_y = (l_hip[1] + r_hip[1]) / 2
        shoulder_y = (l_shoulder[1] + r_shoulder[1]) / 2
        if hip_y >= shoulder_y:
            corrections.append("Lift your hips higher — squeeze your glutes at the top")
        if abs(l_shoulder[1] - r_shoulder[1]) > shoulder_tol:
            corrections.append("Keep both shoulders flat on the mat")
        if not corrections:
            corrections.append("Great Bridge Pose! Keep squeezing the glutes and breathe.")

    # ── 13. Triangle Pose ──
    elif pose == "triangle_pose":
        if abs(l_wrist[1] - r_wrist[1]) < arm_tol and abs(l_wrist[0] - r_wrist[0]) < 20:
            corrections.append("Extend the top arm straight up toward the ceiling")
        if abs(l_shoulder[1] - r_shoulder[1]) < 15:
            corrections.append("Stack your shoulders vertically — open the chest to the sky")
        if not corrections:
            corrections.append("Good Triangle Pose! Keep both legs straight and breathe.")

    # ── 14. Upward-Facing Dog ──
    elif pose == "upward_dog":
        if abs(l_shoulder[1] - r_shoulder[1]) > shoulder_tol:
            corrections.append("Keep shoulders level — draw them down away from ears")
        if abs(l_wrist[0] - r_wrist[0]) < 20:
            corrections.append("Place hands wider, directly under your shoulders")
        if not corrections:
            corrections.append("Nice Upward Dog! Lift the chest high and draw shoulder blades together.")

    # ── 15. Chair Pose ──
    elif pose == "chair_pose":
        wrist_y = (l_wrist[1] + r_wrist[1]) / 2
        shoulder_y = (l_shoulder[1] + r_shoulder[1]) / 2
        if wrist_y > shoulder_y + arm_tol:
            corrections.append("Raise both arms fully overhead alongside your ears")
        if abs(l_knee[0] - r_knee[0]) > arm_tol * 1.5:
            corrections.append("Keep knees together — don't let them splay outward")
        if not corrections:
            corrections.append("Strong Chair Pose! Sit lower and keep chest lifted.")

    # ── 16. Standing Forward Fold ──
    elif pose == "forward_bend":
        if abs(l_shoulder[1] - r_shoulder[1]) > shoulder_tol:
            corrections.append("Keep shoulders level as you fold — don't twist the torso")
        if abs(l_hip[0] - r_hip[0]) > arm_tol:
            corrections.append("Square both hips evenly over both feet")
        if not corrections:
            corrections.append("Good Forward Fold! Let the neck fully relax and breathe deeply.")

    # ── 17. Warrior II ──
    elif pose == "warrior_pose":
        if abs(l_wrist[1] - r_wrist[1]) > arm_tol:
            corrections.append("Keep both arms level — extend equally left and right")
        if abs(l_shoulder[1] - r_shoulder[1]) > shoulder_tol:
            corrections.append("Keep shoulders relaxed and level — don't shrug")
        if strict:
            if abs(l_knee[0] - l_ankle[0]) > arm_tol:
                corrections.append("Align front knee directly over the ankle")
        if not corrections:
            corrections.append("Powerful Warrior Two! Sink the front knee deeper and gaze forward.")

    # ── 18. Tree Pose ──
    elif pose == "tree_pose":
        if abs(l_shoulder[1] - r_shoulder[1]) > shoulder_tol:
            corrections.append("Level your shoulders — open the chest and broaden it")
        if abs(l_hip[1] - r_hip[1]) > arm_tol:
            corrections.append("Keep hips level — don't let the standing-leg hip push out")
        wrist_y = (l_wrist[1] + r_wrist[1]) / 2
        shoulder_y = (l_shoulder[1] + r_shoulder[1]) / 2
        if wrist_y > shoulder_y + arm_tol:
            corrections.append("Raise arms overhead or keep hands at heart center")
        if not corrections:
            corrections.append("Beautiful Tree Pose! Fix your gaze on a still point and breathe.")

    # Fallback
    else:
        if experience_level == "expert":
            corrections.append("Excellent form! Maintain precise alignment and steady breath.")
        elif experience_level == "intermediate":
            corrections.append("Good alignment. Focus on deepening the pose with each exhale.")
        else:
            corrections.append("Great job! Keep breathing steadily and hold the pose.")

    if len(corrections) > 1 and experience_level == "expert" and strict:
        corrections = corrections[:2]  # experts get max 2 precise cues

    return corrections


def _apply_stability(session_id: Optional[str], source: str, pose: str) -> str:
    if source != "live" or not session_id:
        return pose
    history = _session_predictions[session_id]
    history.append(pose)
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
        "movenet_path": str(MOVENET_MODEL_PATH),
        "classifier_path": str(CLASSIFIER_MODEL_PATH),
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
    skeleton_base64 = _draw_skeleton_base64(cropped_bgr, keypoints)

    logger.debug("keypoints=%s", np.round(keypoints, 3).tolist())

    if skeleton_base64 is None or not has_body(keypoints):
        logger.info(
            "source=%s pose=%s reason=no_body latency_ms=%.0f",
            payload.source,
            NO_POSE,
            (time.perf_counter() - started) * 1000,
        )
        return _response_for_nopose("No full-body skeleton detected", skeleton_base64)

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

    candidate_pose = best_pose if best_prob >= MIN_CLASS_PROB else NO_POSE
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
