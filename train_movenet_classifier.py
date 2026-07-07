from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple

import cv2
import numpy as np
import tensorflow as tf
from tensorflow import keras

BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "dataset"
LEGACY_DATASET_DIR = BASE_DIR / "yoga_poses" / "train"
MODELS_DIR = BASE_DIR / "models"
MOVENET_PATH = MODELS_DIR / "movenet_lightning.tflite"
LABELS_PATH = MODELS_DIR / "pose_labels.json"
MODEL_PATH = MODELS_DIR / "pose_classifier.keras"

MIN_KEYPOINT_SCORE = 0.25


def _clean_label(raw: str) -> str:
    cleaned = raw.strip().lower().replace("-", "_").replace(" ", "_")
    while "__" in cleaned:
        cleaned = cleaned.replace("__", "_")
    return cleaned


def _normalize_label(label: str) -> str:
    cleaned = _clean_label(label)
    mapping = {
        "no_pose": "unknown",
        "nopose": "unknown",
        "shoudler_stand": "shoulder_stand",
        "traingle": "triangle",
        "dog": "downward_dog",
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


def load_movenet() -> Tuple[tf.lite.Interpreter, int]:
    if not MOVENET_PATH.exists():
        raise FileNotFoundError(f"Missing MoveNet model: {MOVENET_PATH}")

    interpreter = tf.lite.Interpreter(model_path=str(MOVENET_PATH))
    interpreter.allocate_tensors()
    input_details = interpreter.get_input_details()[0]
    input_size = int(input_details["shape"][1])
    return interpreter, input_size


def movenet_keypoints(interpreter: tf.lite.Interpreter, input_size: int, image_rgb: np.ndarray) -> np.ndarray:
    input_details = interpreter.get_input_details()[0]
    output_details = interpreter.get_output_details()[0]

    resized = cv2.resize(image_rgb, (input_size, input_size), interpolation=cv2.INTER_AREA)
    expected_dtype = input_details["dtype"]
    if expected_dtype == np.float32:
        input_tensor = np.expand_dims(resized.astype(np.float32), axis=0)
    else:
        input_tensor = np.expand_dims(resized.astype(expected_dtype), axis=0)

    interpreter.set_tensor(input_details["index"], input_tensor)
    interpreter.invoke()
    output = interpreter.get_tensor(output_details["index"])[0, 0, :, :]  # [17, 3] y,x,score

    h, w = image_rgb.shape[:2]
    keypoints = np.zeros((17, 3), dtype=np.float32)
    for idx in range(17):
        y, x, score = output[idx]
        keypoints[idx] = np.array([x * w, y * h, score], dtype=np.float32)
    return keypoints


def normalize_keypoints(keypoints: np.ndarray) -> np.ndarray:
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


def has_body(keypoints: np.ndarray) -> bool:
    major = [0, 5, 6, 11, 12, 13, 14, 15, 16]
    return all(float(keypoints[idx, 2]) >= MIN_KEYPOINT_SCORE for idx in major)


def build_dataset(interpreter: tf.lite.Interpreter, input_size: int) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    roots = [DATASET_DIR, LEGACY_DATASET_DIR]
    usable_roots: List[Path] = []
    for root in roots:
        if not root.exists():
            continue
        for pattern in ("*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG"):
            if any(root.glob(f"**/{pattern}")):
                usable_roots.append(root)
                break

    if not usable_roots:
        raise FileNotFoundError(f"No dataset images found in {DATASET_DIR} or {LEGACY_DATASET_DIR}")

    class_dirs: List[Path] = []
    for root in usable_roots:
        class_dirs.extend([d for d in sorted(root.iterdir()) if d.is_dir()])

    labels = sorted({_normalize_label(d.name) for d in class_dirs})
    if len(labels) < 2:
        raise RuntimeError("Need at least 2 pose classes across dataset sources")

    label_to_idx = {label: idx for idx, label in enumerate(labels)}
    x: List[np.ndarray] = []
    y: List[int] = []

    for class_dir in class_dirs:
        label = _normalize_label(class_dir.name)
        label_idx = label_to_idx[label]
        image_paths: List[Path] = []
        for pattern in ("*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG"):
            image_paths.extend(sorted(class_dir.glob(pattern)))

        for image_path in image_paths:
            image_bgr = cv2.imread(str(image_path))
            if image_bgr is None:
                continue
            image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
            keypoints = movenet_keypoints(interpreter, input_size, image_rgb)
            if not has_body(keypoints):
                continue
            x.append(normalize_keypoints(keypoints))
            y.append(label_idx)

    if len(x) < 20:
        raise RuntimeError("Not enough valid samples after keypoint extraction")

    return np.array(x, dtype=np.float32), np.array(y, dtype=np.int32), labels


def train_model(x: np.ndarray, y: np.ndarray, num_classes: int) -> keras.Model:
    y_onehot = keras.utils.to_categorical(y, num_classes=num_classes)

    model = keras.Sequential(
        [
            keras.layers.Input(shape=(34,)),
            keras.layers.Dense(64, activation="relu"),
            keras.layers.Dense(32, activation="relu"),
            keras.layers.Dense(num_classes, activation="softmax"),
        ]
    )

    model.compile(optimizer="adam", loss="categorical_crossentropy", metrics=["accuracy"])
    model.fit(x, y_onehot, epochs=50, batch_size=16, validation_split=0.2, verbose=1)
    return model


def main() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    interpreter, input_size = load_movenet()
    x, y, labels = build_dataset(interpreter, input_size)

    model = train_model(x, y, len(labels))
    model.save(MODEL_PATH)
    LABELS_PATH.write_text(json.dumps(labels, indent=2), encoding="utf-8")

    print("Training complete")
    print(f"Samples: {len(x)}")
    print(f"Model: {MODEL_PATH}")
    print(f"Labels: {LABELS_PATH}")


if __name__ == "__main__":
    main()
