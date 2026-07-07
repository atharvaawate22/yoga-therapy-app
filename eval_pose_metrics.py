from pathlib import Path
import json
import numpy as np
import cv2
import tensorflow as tf

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
MOVENET_PATH = MODELS_DIR / "movenet_lightning.tflite"
LABELS_PATH = MODELS_DIR / "pose_labels.json"
MODEL_PATH = MODELS_DIR / "pose_classifier.keras"
TEST_ROOT = BASE_DIR / "yoga_poses" / "test"

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


def load_movenet():
    interpreter = tf.lite.Interpreter(model_path=str(MOVENET_PATH))
    interpreter.allocate_tensors()
    input_details = interpreter.get_input_details()[0]
    output_details = interpreter.get_output_details()[0]
    input_size = int(input_details["shape"][1])
    return interpreter, input_details, output_details, input_size


def movenet_keypoints(interpreter, input_details, output_details, input_size, image_rgb):
    resized = cv2.resize(image_rgb, (input_size, input_size), interpolation=cv2.INTER_AREA)
    expected_dtype = input_details["dtype"]
    if expected_dtype == np.float32:
        input_tensor = np.expand_dims(resized.astype(np.float32), axis=0)
    else:
        input_tensor = np.expand_dims(resized.astype(expected_dtype), axis=0)
    interpreter.set_tensor(input_details["index"], input_tensor)
    interpreter.invoke()
    output = interpreter.get_tensor(output_details["index"])[0, 0, :, :]
    h, w = image_rgb.shape[:2]
    keypoints = np.zeros((17, 3), dtype=np.float32)
    for idx in range(17):
        y, x, score = output[idx]
        keypoints[idx] = np.array([x * w, y * h, score], dtype=np.float32)
    return keypoints


def has_body(keypoints):
    major = [0, 5, 6, 11, 12, 13, 14, 15, 16]
    return all(float(keypoints[idx, 2]) >= MIN_KEYPOINT_SCORE for idx in major)


def normalize_keypoints(keypoints):
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


if __name__ == "__main__":
    labels = json.loads(LABELS_PATH.read_text(encoding="utf-8"))
    label_to_idx = {label: idx for idx, label in enumerate(labels)}

    model = tf.keras.models.load_model(MODEL_PATH, compile=False)
    interpreter, input_details, output_details, input_size = load_movenet()

    x_true = []
    x_pred = []
    skipped = 0

    patterns = ("*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG")
    class_dirs = [d for d in sorted(TEST_ROOT.iterdir()) if d.is_dir()]

    for class_dir in class_dirs:
        label = _normalize_label(class_dir.name)
        if label not in label_to_idx:
            continue
        for pattern in patterns:
            for image_path in class_dir.glob(pattern):
                image_bgr = cv2.imread(str(image_path))
                if image_bgr is None:
                    skipped += 1
                    continue
                image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
                keypoints = movenet_keypoints(interpreter, input_details, output_details, input_size, image_rgb)
                if not has_body(keypoints):
                    skipped += 1
                    continue
                features = normalize_keypoints(keypoints)
                probs = model.predict(np.expand_dims(features, axis=0), verbose=0)[0]
                pred_idx = int(np.argmax(probs))
                x_true.append(label_to_idx[label])
                x_pred.append(pred_idx)

    x_true = np.array(x_true, dtype=np.int32)
    x_pred = np.array(x_pred, dtype=np.int32)

    num_classes = len(labels)
    conf = np.zeros((num_classes, num_classes), dtype=np.int64)
    for t, p in zip(x_true, x_pred):
        conf[t, p] += 1

    supports = conf.sum(axis=1)
    tp = np.diag(conf)
    fp = conf.sum(axis=0) - tp
    fn = conf.sum(axis=1) - tp

    precision = np.divide(tp, tp + fp, out=np.zeros_like(tp, dtype=float), where=(tp + fp) != 0)
    recall = np.divide(tp, tp + fn, out=np.zeros_like(tp, dtype=float), where=(tp + fn) != 0)
    f1 = np.divide(2 * precision * recall, precision + recall, out=np.zeros_like(tp, dtype=float), where=(precision + recall) != 0)

    accuracy = float((x_true == x_pred).mean()) if x_true.size else 0.0

    macro_precision = float(np.mean(precision)) if num_classes else 0.0
    macro_recall = float(np.mean(recall)) if num_classes else 0.0
    macro_f1 = float(np.mean(f1)) if num_classes else 0.0

    weighted_precision = float(np.sum(precision * supports) / max(1, supports.sum()))
    weighted_recall = float(np.sum(recall * supports) / max(1, supports.sum()))
    weighted_f1 = float(np.sum(f1 * supports) / max(1, supports.sum()))

    print("Test root:", TEST_ROOT)
    print("Samples:", int(x_true.size))
    print("Skipped:", int(skipped))
    print("Accuracy:", round(accuracy, 4))
    print("Macro Precision:", round(macro_precision, 4))
    print("Macro Recall:", round(macro_recall, 4))
    print("Macro F1:", round(macro_f1, 4))
    print("Weighted Precision:", round(weighted_precision, 4))
    print("Weighted Recall:", round(weighted_recall, 4))
    print("Weighted F1:", round(weighted_f1, 4))
