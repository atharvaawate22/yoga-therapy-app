"""Evaluate the trained classifier on the held-out test split.

    python eval_pose_metrics.py

Reports per-class precision/recall/F1 plus macro and support-weighted averages.
Metrics are computed from a confusion matrix built by hand rather than pulled
from scikit-learn, to keep the serving image's dependency set minimal.

Feature extraction goes through ``utils.dataset``, so evaluation sees exactly
the preprocessing the server applies.
"""

from __future__ import annotations

import argparse
import logging
import sys
from typing import List, Tuple

import numpy as np

from utils.dataset import build_feature_dataset
from utils.model import load_classifier, load_labels
from utils.movenet import MoveNetRuntime
from utils.paths import TEST_DATASET_DIR

logger = logging.getLogger("eval")


def align_to_trained_labels(
    y_extracted: np.ndarray,
    extracted_labels: List[str],
    trained_labels: List[str],
) -> Tuple[np.ndarray, np.ndarray, int]:
    """Remap test-set class indices onto the trained model's label ordering.

    The extractor numbers classes by what it found on disk; the model's softmax
    is ordered by ``pose_labels.json``. Comparing the two directly would score
    a correct model as wrong. Samples whose class was never trained are
    dropped and counted.
    """
    trained_index = {label: idx for idx, label in enumerate(trained_labels)}
    keep_mask = []
    remapped = []
    for idx in y_extracted:
        label = extracted_labels[int(idx)]
        target = trained_index.get(label)
        keep_mask.append(target is not None)
        remapped.append(target if target is not None else -1)

    mask = np.array(keep_mask, dtype=bool)
    aligned = np.array(remapped, dtype=np.int32)[mask]
    return mask, aligned, int((~mask).sum())


def confusion_metrics(
    y_true: np.ndarray, y_pred: np.ndarray, num_classes: int
) -> dict:
    conf = np.zeros((num_classes, num_classes), dtype=np.int64)
    for t, p in zip(y_true, y_pred):
        conf[t, p] += 1

    supports = conf.sum(axis=1)
    tp = np.diag(conf)
    fp = conf.sum(axis=0) - tp
    fn = conf.sum(axis=1) - tp

    precision = np.divide(
        tp, tp + fp, out=np.zeros_like(tp, dtype=float), where=(tp + fp) != 0
    )
    recall = np.divide(
        tp, tp + fn, out=np.zeros_like(tp, dtype=float), where=(tp + fn) != 0
    )
    f1 = np.divide(
        2 * precision * recall,
        precision + recall,
        out=np.zeros_like(tp, dtype=float),
        where=(precision + recall) != 0,
    )

    total_support = max(1, int(supports.sum()))
    return {
        "confusion": conf,
        "supports": supports,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "accuracy": float((y_true == y_pred).mean()) if y_true.size else 0.0,
        "macro_precision": float(np.mean(precision)) if num_classes else 0.0,
        "macro_recall": float(np.mean(recall)) if num_classes else 0.0,
        "macro_f1": float(np.mean(f1)) if num_classes else 0.0,
        "weighted_precision": float(np.sum(precision * supports) / total_support),
        "weighted_recall": float(np.sum(recall * supports) / total_support),
        "weighted_f1": float(np.sum(f1 * supports) / total_support),
    }


def print_report(labels: List[str], metrics: dict, evaluated: int, skew: dict) -> None:
    print(f"\nTest root : {TEST_DATASET_DIR}")
    print(f"Evaluated : {evaluated} samples")
    print(f"Skipped   : {skew['no_body']} no-body, {skew['unreadable']} unreadable, "
          f"{skew['untrained_class']} in untrained classes")
    print(f"\nAccuracy  : {metrics['accuracy']:.4f}\n")

    name_width = max((len(label) for label in labels), default=10)
    header = f"{'class'.ljust(name_width)}  {'prec':>6} {'rec':>6} {'f1':>6} {'n':>6}"
    print(header)
    print("-" * len(header))
    for idx, label in enumerate(labels):
        print(
            f"{label.ljust(name_width)}  "
            f"{metrics['precision'][idx]:>6.3f} "
            f"{metrics['recall'][idx]:>6.3f} "
            f"{metrics['f1'][idx]:>6.3f} "
            f"{int(metrics['supports'][idx]):>6}"
        )
    print("-" * len(header))
    print(
        f"{'macro avg'.ljust(name_width)}  "
        f"{metrics['macro_precision']:>6.3f} "
        f"{metrics['macro_recall']:>6.3f} "
        f"{metrics['macro_f1']:>6.3f}"
    )
    print(
        f"{'weighted avg'.ljust(name_width)}  "
        f"{metrics['weighted_precision']:>6.3f} "
        f"{metrics['weighted_recall']:>6.3f} "
        f"{metrics['weighted_f1']:>6.3f}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit-per-class", type=int, default=None)
    parser.add_argument("--log-level", default="INFO")
    args = parser.parse_args()

    logging.basicConfig(
        level=args.log_level.upper(),
        format="%(asctime)s %(levelname)-8s %(name)s | %(message)s",
    )

    trained_labels = load_labels()
    model = load_classifier()
    movenet = MoveNetRuntime()

    features = build_feature_dataset(
        movenet, roots=[TEST_DATASET_DIR], limit_per_class=args.limit_per_class
    )
    if features.is_empty:
        logger.error("No usable test samples found under %s", TEST_DATASET_DIR)
        return 1

    stats = features.stats
    mask, y_true, untrained = align_to_trained_labels(
        features.y, features.labels, trained_labels
    )
    x = features.x[mask]
    if x.size == 0:
        logger.error("No test samples belong to a trained class")
        return 1

    probs = model.predict(x, verbose=0)
    y_pred = np.argmax(probs, axis=1).astype(np.int32)

    metrics = confusion_metrics(y_true, y_pred, len(trained_labels))
    print_report(
        trained_labels,
        metrics,
        evaluated=int(y_true.size),
        skew={
            "no_body": stats.skipped_no_body,
            "unreadable": stats.skipped_unreadable,
            "untrained_class": untrained,
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
