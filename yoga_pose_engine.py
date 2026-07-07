"""MoveNet + ML classifier backend for yoga pose analysis."""

from __future__ import annotations

import base64
import json
import urllib.request
from collections import Counter, defaultdict, deque
from pathlib import Path
from typing import Deque, Dict, List, Optional, Tuple

import cv2
import numpy as np
import tensorflow as tf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
MOVENET_MODEL_PATH = MODELS_DIR / "movenet_lightning.tflite"
CLASSIFIER_MODEL_PATH = MODELS_DIR / "pose_classifier.keras"
LABELS_PATH = MODELS_DIR / "pose_labels.json"
MOVENET_URL = "https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/3?lite-format=tflite"
TRAIN_DATASET_DIR = BASE_DIR / "dataset"
LEGACY_TRAIN_DIR = BASE_DIR / "yoga_poses" / "train"

MIN_KEYPOINT_SCORE = 0.25
MIN_CLASS_PROB = 0.70

KEYPOINT_NAMES = [
	"nose",
	"left_eye",
	"right_eye",
	"left_ear",
	"right_ear",
	"left_shoulder",
	"right_shoulder",
	"left_elbow",
	"right_elbow",
	"left_wrist",
	"right_wrist",
	"left_hip",
	"right_hip",
	"left_knee",
	"right_knee",
	"left_ankle",
	"right_ankle",
]

SKELETON_EDGES = [
	(0, 1),
	(0, 2),
	(1, 3),
	(2, 4),
	(0, 5),
	(0, 6),
	(5, 7),
	(7, 9),
	(6, 8),
	(8, 10),
	(5, 6),
	(5, 11),
	(6, 12),
	(11, 12),
	(11, 13),
	(13, 15),
	(12, 14),
	(14, 16),
]


class PoseAnalyzeRequest(BaseModel):
	image_base64: str
	session_id: Optional[str] = None
	source: str = "image"
	crop_confirmed: bool = False
	experience_level: str = "beginner"  # beginner | intermediate | expert


class PoseAnalyzeResponse(BaseModel):
	pose: str
	confidence: float
	corrections: List[str]
	distances: Dict[str, float]
	debug_image_base64: Optional[str] = None
	probabilities: Dict[str, float] = {}


app = FastAPI(title="Yoga Pose Engine", version="2.0.0")
app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

_session_predictions: Dict[str, Deque[str]] = defaultdict(lambda: deque(maxlen=5))


def _ensure_movenet_model() -> None:
	MODELS_DIR.mkdir(parents=True, exist_ok=True)
	if MOVENET_MODEL_PATH.exists():
		return
	urllib.request.urlretrieve(MOVENET_URL, str(MOVENET_MODEL_PATH))


class MoveNetRuntime:
	def __init__(self) -> None:
		_ensure_movenet_model()
		self.interpreter = tf.lite.Interpreter(model_path=str(MOVENET_MODEL_PATH))
		self.interpreter.allocate_tensors()
		self.input_details = self.interpreter.get_input_details()[0]
		self.output_details = self.interpreter.get_output_details()[0]
		self.input_size = int(self.input_details["shape"][1])

	def infer(self, image_rgb: np.ndarray) -> np.ndarray:
		resized = cv2.resize(image_rgb, (self.input_size, self.input_size), interpolation=cv2.INTER_AREA)
		expected_dtype = self.input_details["dtype"]
		if expected_dtype == np.float32:
			input_tensor = np.expand_dims(resized.astype(np.float32), axis=0)
		else:
			input_tensor = np.expand_dims(resized.astype(expected_dtype), axis=0)
		self.interpreter.set_tensor(self.input_details["index"], input_tensor)
		self.interpreter.invoke()
		output = self.interpreter.get_tensor(self.output_details["index"])
		return output[0, 0, :, :]


class ClassifierRuntime:
	def __init__(self) -> None:
		self.model = None
		self.labels: List[str] = []
		if CLASSIFIER_MODEL_PATH.exists() and LABELS_PATH.exists():
			try:
				# compile=False avoids loading optimizer state and improves cross-version compatibility.
				self.model = tf.keras.models.load_model(CLASSIFIER_MODEL_PATH, compile=False)
				self.labels = json.loads(LABELS_PATH.read_text(encoding="utf-8"))
			except Exception as exc:
				print(
					"WARNING: Could not load existing classifier model; "
					"will attempt bootstrap training from dataset. "
					f"Reason: {exc}"
				)
				self.model = None
				self.labels = []

	def ready(self) -> bool:
		return self.model is not None and len(self.labels) > 0

	def predict(self, normalized_flat: np.ndarray) -> Dict[str, float]:
		if not self.ready():
			return {}
		probs = self.model.predict(np.expand_dims(normalized_flat, axis=0), verbose=0)[0]
		return {label: float(probs[idx]) for idx, label in enumerate(self.labels)}

	def set_model(self, model: tf.keras.Model, labels: List[str]) -> None:
		self.model = model
		self.labels = labels


_movenet = MoveNetRuntime()
_classifier = ClassifierRuntime()



def _normalize_label(label: str) -> str:
	cleaned = label.strip().lower().replace("-", "_").replace(" ", "_")
	while "__" in cleaned:
		cleaned = cleaned.replace("__", "_")
	mapping = {
		"no_pose": "unknown",
		"nopose": "unknown",
		# Legacy typo fixes
		"shoudler_stand": "shoulder_stand",
		"traingle": "triangle",
		"dog": "downward_dog",
		# Alternate label names -> canonical 18-pose IDs
		"downward_facing_dog": "downward_dog",
		"adho_mukha_svanasana": "adho_mukha_svanasana",
		"anjaneyasana": "low_lunge",
		"low_lunge": "low_lunge",
		"ardha_matsyendrasana": "seated_twist",
		"seated_twist": "seated_twist",
		"baddha_konasana": "butterfly_pose",
		"butterfly": "butterfly_pose",
		"balasana": "childs_pose",
		"childs_pose": "childs_pose",
		"bitilasana": "cat_cow",
		"cat_cow": "cat_cow",
		"halasana": "plow_pose",
		"plow": "plow_pose",
		"malasana": "garland_pose",
		"garland": "garland_pose",
		"navasana": "boat_pose",
		"boat": "boat_pose",
		"paschimottanasana": "seated_forward_bend",
		"seated_forward_bend": "seated_forward_bend",
		"salamba_sarvangasana": "shoulder_stand",
		"sarvangasana": "shoulder_stand",
		"shoulder_stand": "shoulder_stand",
		"setu_bandha_sarvangasana": "bridge_pose",
		"setu_bandha": "bridge_pose",
		"bridge": "bridge_pose",
		"trikonasana": "triangle_pose",
		"triangle": "triangle_pose",
		"urdhva_mukha_svanasana": "upward_dog",
		"urdhva_mukha_svsnssana": "upward_dog",
		"upward_dog": "upward_dog",
		"utkatasana": "chair_pose",
		"chair": "chair_pose",
		"uttanasana": "uttanasana",
		"forward_bend": "forward_bend",
		"virabhadrasana": "warrior_pose",
		"virabhadrasana_two": "warrior_pose",
		"warrior": "warrior_pose",
		"warrior_two": "warrior_pose",
		"vrksasana": "tree_pose",
		"tree": "tree_pose",
		"bhujangasana": "bhujangasana",
		"cobra": "cobra_pose",
		"pranamasana": "pranamasana",
		"hastauttanasana": "hasta_uttanasana",
		"hasta_uttanasana": "hasta_uttanasana",
		"hastapadasana": "hasta_padasana",
		"hasta_padasana": "hasta_padasana",
		"ashwa_sanchalanasana": "ashwa_sanchalanasana",
		"dandasana": "dandasana",
		"ashtanga_namaskara": "ashtanga_namaskara",
		"tadasana": "tadasana",
	}
	return mapping.get(cleaned, cleaned)


def _feedback_pose_alias(pose: str) -> str:
	alias = {
		"adho_mukha_svanasana": "downward_dog",
		"bhujangasana": "cobra_pose",
		"uttanasana": "forward_bend",
		"ashwa_sanchalanasana": "low_lunge",
	}
	return alias.get(pose, pose)


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


def _center_crop_square(image_bgr: np.ndarray) -> np.ndarray:
	h, w = image_bgr.shape[:2]
	side = min(h, w)
	y0 = (h - side) // 2
	x0 = (w - side) // 2
	return image_bgr[y0 : y0 + side, x0 : x0 + side]


def _extract_keypoints_pixels(output: np.ndarray, width: int, height: int) -> np.ndarray:
	# MoveNet outputs [y, x, score] normalized to [0,1].
	keypoints = np.zeros((17, 3), dtype=np.float32)
	for idx in range(17):
		y, x, score = output[idx]
		keypoints[idx] = np.array([x * width, y * height, score], dtype=np.float32)
	return keypoints


def _normalize_keypoints(keypoints: np.ndarray) -> np.ndarray:
	left_hip = keypoints[11, :2]
	right_hip = keypoints[12, :2]
	hip_mid = (left_hip + right_hip) / 2.0

	left_shoulder = keypoints[5, :2]
	right_shoulder = keypoints[6, :2]
	torso = max(
		float(np.linalg.norm(left_shoulder - right_shoulder)),
		float(np.linalg.norm(left_hip - right_hip)),
	)

	if torso < 1e-6:
		xy = keypoints[:, :2]
		span = np.max(xy, axis=0) - np.min(xy, axis=0)
		torso = float(max(span[0], span[1], 1.0))

	normalized = (keypoints[:, :2] - hip_mid) / torso
	return normalized.astype(np.float32).reshape(-1)



def _build_training_set() -> Tuple[np.ndarray, np.ndarray, List[str]]:
	candidate_roots = [TRAIN_DATASET_DIR, LEGACY_TRAIN_DIR]
	roots: List[Path] = []
	for candidate in candidate_roots:
		if not candidate.exists():
			continue
		for pattern in ("*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG"):
			if any(candidate.glob(f"**/{pattern}")):
				roots.append(candidate)
				break

	if not roots:
		return np.array([], dtype=np.float32), np.array([], dtype=np.int32), []

	class_dirs: List[Path] = []
	for root in roots:
		class_dirs.extend([d for d in sorted(root.iterdir()) if d.is_dir()])
	if not class_dirs:
		return np.array([], dtype=np.float32), np.array([], dtype=np.int32), []

	label_names = sorted({_normalize_label(d.name) for d in class_dirs})
	label_to_idx = {label: idx for idx, label in enumerate(label_names)}

	x_data: List[np.ndarray] = []
	y_data: List[int] = []

	for class_dir in class_dirs:
		label = _normalize_label(class_dir.name)
		label_idx = label_to_idx[label]
		image_paths: List[Path] = []
		for pattern in ("*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG"):
			image_paths.extend(sorted(class_dir.glob(pattern)))

		for image_path in image_paths[:120]:
			image_bgr = cv2.imread(str(image_path))
			if image_bgr is None:
				continue
			crop = _center_crop_square(image_bgr)
			image_rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
			output = _movenet.infer(image_rgb)
			keypoints = _extract_keypoints_pixels(output, image_rgb.shape[1], image_rgb.shape[0])
			if not _has_body(keypoints):
				continue
			x_data.append(_normalize_keypoints(keypoints))
			y_data.append(label_idx)

	if len(x_data) < 30 or len(set(y_data)) < 2:
		return np.array([], dtype=np.float32), np.array([], dtype=np.int32), []

	inv_labels = [None] * len(label_to_idx)
	for label, idx in label_to_idx.items():
		inv_labels[idx] = label

	return np.array(x_data, dtype=np.float32), np.array(y_data, dtype=np.int32), inv_labels  # type: ignore[arg-type]


def _train_bootstrap_classifier() -> None:
	if _classifier.ready():
		return

	x_data, y_data, labels = _build_training_set()
	if x_data.size == 0 or y_data.size == 0 or len(labels) < 2:
		return

	y_onehot = tf.keras.utils.to_categorical(y_data, num_classes=len(labels))
	model = tf.keras.Sequential(
		[
			tf.keras.layers.Input(shape=(34,)),
			tf.keras.layers.Dense(64, activation="relu"),
			tf.keras.layers.Dense(32, activation="relu"),
			tf.keras.layers.Dense(len(labels), activation="softmax"),
		]
	)
	model.compile(optimizer="adam", loss="categorical_crossentropy", metrics=["accuracy"])
	model.fit(x_data, y_onehot, epochs=25, batch_size=32, validation_split=0.2, verbose=0)

	MODELS_DIR.mkdir(parents=True, exist_ok=True)
	model.save(CLASSIFIER_MODEL_PATH)
	LABELS_PATH.write_text(json.dumps(labels, indent=2), encoding="utf-8")
	_classifier.set_model(model, labels)


def _has_body(keypoints: np.ndarray) -> bool:
	major = [0, 5, 6, 11, 12, 13, 14, 15, 16]
	core = [5, 6, 11, 12]
	core_visible = all(keypoints[idx, 2] >= 0.20 for idx in core)
	major_visible_count = sum(keypoints[idx, 2] >= 0.15 for idx in major)
	return bool(core_visible and major_visible_count >= 7)


def _draw_skeleton_base64(image_bgr: np.ndarray, keypoints: np.ndarray) -> Optional[str]:
	overlay = image_bgr.copy()
	drew_any = False
	for a, b in SKELETON_EDGES:
		if keypoints[a, 2] >= MIN_KEYPOINT_SCORE and keypoints[b, 2] >= MIN_KEYPOINT_SCORE:
			pt1 = tuple(np.int32(keypoints[a, :2]))
			pt2 = tuple(np.int32(keypoints[b, :2]))
			cv2.line(overlay, pt1, pt2, (40, 220, 120), 2)
			drew_any = True
	for idx in range(17):
		if keypoints[idx, 2] >= MIN_KEYPOINT_SCORE:
			pt = tuple(np.int32(keypoints[idx, :2]))
			cv2.circle(overlay, pt, 3, (255, 90, 40), -1)
			drew_any = True
	if not drew_any:
		return None
	ok, encoded = cv2.imencode(".jpg", overlay)
	if not ok:
		return None
	return base64.b64encode(encoded.tobytes()).decode("ascii")


def _distance_metrics(keypoints: np.ndarray, pose: str) -> Dict[str, float]:
	pose = _feedback_pose_alias(pose)
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


def _generate_corrections(pose: str, keypoints: np.ndarray, experience_level: str = "beginner") -> List[str]:
	pose = _feedback_pose_alias(pose)
	if pose == "nopose":
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
	counts = Counter(history)
	stable_pose, stable_count = counts.most_common(1)[0]
	if stable_count >= 3:
		return stable_pose
	return "nopose"


def _response_for_nopose(message: str, debug_image_base64: Optional[str]) -> PoseAnalyzeResponse:
	return PoseAnalyzeResponse(
		pose="nopose",
		confidence=0.0,
		corrections=[message],
		distances={},
		debug_image_base64=debug_image_base64,
		probabilities={},
	)


_train_bootstrap_classifier()


@app.get("/health")
def health() -> dict:
	return {
		"status": "ok",
		"service": "yoga-pose-engine",
		"classifier_ready": _classifier.ready(),
		"movenet_path": str(MOVENET_MODEL_PATH),
		"classifier_path": str(CLASSIFIER_MODEL_PATH),
	}


@app.post("/analyze-pose", response_model=PoseAnalyzeResponse)
def analyze_pose(payload: PoseAnalyzeRequest) -> PoseAnalyzeResponse:
	if not payload.image_base64.strip():
		raise HTTPException(status_code=400, detail="image_base64 is required")

	if not payload.crop_confirmed:
		return _response_for_nopose(
			"Crop not confirmed. Use Capture -> Crop -> Confirm before detection.",
			None,
		)

	image_bgr = _decode_base64_image(payload.image_base64)
	cropped_bgr = _center_crop_square(image_bgr)
	image_rgb = cv2.cvtColor(cropped_bgr, cv2.COLOR_BGR2RGB)

	output = _movenet.infer(image_rgb)
	keypoints = _extract_keypoints_pixels(output, image_rgb.shape[1], image_rgb.shape[0])
	skeleton_base64 = _draw_skeleton_base64(cropped_bgr, keypoints)

	print("keypoints:", np.round(keypoints, 3).tolist())

	if skeleton_base64 is None or not _has_body(keypoints):
		return _response_for_nopose("No full-body skeleton detected", skeleton_base64)

	normalized = _normalize_keypoints(keypoints)
	print("normalized:", np.round(normalized, 4).tolist())

	if not _classifier.ready():
		return PoseAnalyzeResponse(
			pose="nopose",
			confidence=0.0,
			corrections=[
				"Classifier model not found. Train and save models/pose_classifier.keras and models/pose_labels.json",
			],
			distances={},
			debug_image_base64=skeleton_base64,
			probabilities={},
		)

	probabilities = _classifier.predict(normalized)
	print("probabilities:", probabilities)
	if not probabilities:
		return _response_for_nopose("Classifier prediction failed", skeleton_base64)

	best_pose = max(probabilities, key=probabilities.get)
	best_prob = float(probabilities[best_pose])

	candidate_pose = best_pose if best_prob >= MIN_CLASS_PROB else "nopose"
	if best_pose in {"unknown", "nopose"}:
		candidate_pose = "nopose"

	final_pose = _apply_stability(payload.session_id, payload.source, candidate_pose)
	print("final_pose:", final_pose)

	final_confidence = best_prob if final_pose != "nopose" else 0.0
	experience = payload.experience_level if payload.experience_level in {"beginner", "intermediate", "expert"} else "beginner"
	corrections = _generate_corrections(final_pose, keypoints, experience)
	distances = _distance_metrics(keypoints, final_pose)

	return PoseAnalyzeResponse(
		pose=final_pose,
		confidence=round(float(final_confidence), 3),
		corrections=corrections,
		distances=distances,
		debug_image_base64=skeleton_base64,
		probabilities={k: round(v, 4) for k, v in probabilities.items()},
	)
