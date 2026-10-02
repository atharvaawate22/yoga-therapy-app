"""Train the pose classifier head on MoveNet keypoints.

    python train_movenet_classifier.py                 # extract, split, train
    python train_movenet_classifier.py --legacy-split   # reproduce the old bug

Feature extraction is delegated to ``utils.dataset``, which is the same code
the server runs on a live camera frame — including the square crop and the
body-presence gate. Training on anything else reintroduces train/serve skew.

The train/validation split is stratified by class and grouped by source frame
(see ``utils.splits``). A plain random split leaks flip-twins and adjacent
video frames across the boundary; Keras' ``validation_split`` is worse still,
because the feature matrix is class-ordered and it slices off the tail.

Extracted features are cached to disk so repeat runs skip the ~10 minutes of
MoveNet inference.
"""

from __future__ import annotations

import argparse
import logging
import sys
from typing import Optional

import numpy as np

from utils.dataset import FeatureSet, build_feature_dataset
from utils.dataset import DatasetStats
from utils.model import (
    DEFAULT_BATCH_SIZE,
    DEFAULT_DROPOUT,
    DEFAULT_EPOCHS,
    DEFAULT_L2,
    DEFAULT_PATIENCE,
    DEFAULT_VALIDATION_SPLIT,
    balanced_class_weights,
    save_classifier,
    train_classifier,
)
from utils.movenet import MoveNetRuntime
from utils.paths import CLASSIFIER_MODEL_PATH, LABELS_PATH, MODELS_DIR, MOVENET_VARIANT
from utils.preprocessing import mirror_features
from utils.splits import grouped_stratified_kfold, grouped_stratified_split

logger = logging.getLogger("train")

MIN_SAMPLES = 20
MIN_CLASSES = 2
# Features depend on the keypoint model, so each variant has its own cache.
FEATURE_CACHE = MODELS_DIR / f"feature_cache_{MOVENET_VARIANT}.npz"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--validation-split", type=float, default=DEFAULT_VALIDATION_SPLIT)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--dropout", type=float, default=DEFAULT_DROPOUT)
    parser.add_argument("--l2", type=float, default=DEFAULT_L2)
    parser.add_argument(
        "--patience",
        type=int,
        default=DEFAULT_PATIENCE,
        help="Early-stopping patience on val_loss; 0 disables.",
    )
    parser.add_argument(
        "--class-weight",
        action="store_true",
        help="Weight classes by inverse frequency (13x imbalance in this dataset).",
    )
    parser.add_argument(
        "--augment-mirror",
        action="store_true",
        help="Add a left-right mirrored copy of every training sample (the same "
             "pose done to the other side). Applied after the split, so "
             "validation stays unaugmented.",
    )
    parser.add_argument(
        "--cv",
        type=int,
        default=0,
        metavar="K",
        help="Report grouped K-fold cross-validation metrics for every class "
             "instead of training the shipped model (writes nothing).",
    )
    parser.add_argument("--limit-per-class", type=int, default=None)
    parser.add_argument(
        "--legacy-split",
        action="store_true",
        help="Use Keras validation_split on class-ordered rows — reproduces the "
             "original broken split for comparison. Never use for a real model.",
    )
    parser.add_argument("--no-save", action="store_true", help="Skip writing artifacts.")
    parser.add_argument("--rebuild-cache", action="store_true")
    parser.add_argument("--log-level", default="INFO")
    return parser.parse_args()


def load_or_extract(rebuild: bool, limit_per_class: Optional[int]) -> FeatureSet:
    """Extract features, caching them so experiments do not re-run MoveNet."""
    if FEATURE_CACHE.exists() and not rebuild and limit_per_class is None:
        cached = np.load(FEATURE_CACHE, allow_pickle=True)
        logger.info("Loaded cached features from %s", FEATURE_CACHE)
        stats = DatasetStats(
            total_images=int(cached["total_images"]),
            kept=int(cached["x"].shape[0]),
            skipped_unreadable=int(cached["skipped_unreadable"]),
            skipped_no_body=int(cached["skipped_no_body"]),
            skipped_label_conflict=int(cached["skipped_label_conflict"])
            if "skipped_label_conflict" in cached else 0,
            skipped_duplicate=int(cached["skipped_duplicate"])
            if "skipped_duplicate" in cached else 0,
            per_class_kept=dict(cached["per_class_kept"].item()),
        )
        return FeatureSet(
            x=cached["x"],
            y=cached["y"],
            labels=[str(v) for v in cached["labels"]],
            groups=cached["groups"],
            stats=stats,
        )

    features = build_feature_dataset(MoveNetRuntime(), limit_per_class=limit_per_class)
    if not features.is_empty and limit_per_class is None:
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(
            FEATURE_CACHE,
            x=features.x,
            y=features.y,
            labels=np.array(features.labels, dtype=object),
            groups=features.groups,
            total_images=features.stats.total_images,
            skipped_unreadable=features.stats.skipped_unreadable,
            skipped_no_body=features.stats.skipped_no_body,
            skipped_label_conflict=features.stats.skipped_label_conflict,
            skipped_duplicate=features.stats.skipped_duplicate,
            per_class_kept=np.array(features.stats.per_class_kept, dtype=object),
        )
        logger.info("Cached features -> %s", FEATURE_CACHE)
    return features


def print_class_report(features: FeatureSet) -> None:
    counts = np.bincount(features.y, minlength=len(features.labels))
    width = max(len(c) for c in features.labels)
    print("\nPer-class samples after the body-presence gate")
    print(f"{'class'.ljust(width)}  {'kept':>6} {'raw':>6} {'kept%':>6}")
    print("-" * (width + 22))
    raw = features.stats.per_class_kept
    for idx, label in enumerate(features.labels):
        kept = int(counts[idx])
        print(f"{label.ljust(width)}  {kept:>6} {raw.get(label, kept):>6} ", end="")
        print(f"{'':>6}" if label not in raw else f"{kept / max(1, raw[label]):>5.0%}")
    print("-" * (width + 22))
    nonzero = counts[counts > 0]
    print(
        f"{'TOTAL'.ljust(width)}  {int(counts.sum()):>6}   "
        f"min={int(nonzero.min())} max={int(nonzero.max())} "
        f"imbalance={nonzero.max() / max(1, nonzero.min()):.1f}x"
    )


def print_curve(history, every: int = 5) -> None:
    h = history.history
    if "val_loss" not in h:
        print("\n(no validation data — curve unavailable)")
        return

    n = len(h["loss"])
    best = int(np.argmin(h["val_loss"]))
    print("\nTraining curve")
    print(f"{'epoch':>6} {'loss':>8} {'acc':>7} {'val_loss':>9} {'val_acc':>8} {'gap':>7}")
    print("-" * 50)
    marks = sorted({0, best, n - 1} | set(range(every - 1, n, every)))
    for e in marks:
        gap = h["accuracy"][e] - h["val_accuracy"][e]
        star = "  <- best" if e == best else ""
        print(
            f"{e + 1:>6} {h['loss'][e]:>8.4f} {h['accuracy'][e]:>7.3f} "
            f"{h['val_loss'][e]:>9.4f} {h['val_accuracy'][e]:>8.3f} {gap:>7.3f}{star}"
        )
    print("-" * 50)
    print(
        f"best epoch {best + 1}: val_loss={h['val_loss'][best]:.4f} "
        f"val_acc={h['val_accuracy'][best]:.3f} "
        f"train_acc={h['accuracy'][best]:.3f} "
        f"gap={h['accuracy'][best] - h['val_accuracy'][best]:+.3f}"
    )


# Mirrors yoga_pose_engine.MIN_CLASS_PROB (single images; live frames use a
# lower cutoff behind the stability vote): below it the API reports "nopose".
SERVING_MIN_CLASS_PROB = 0.70


def cross_validate(features: FeatureSet, args: argparse.Namespace) -> np.ndarray:
    """Out-of-fold predictions for every sample, scored per class.

    The official test folder can't score every class (some classes' test images
    are all copies of training images), so this is the per-class estimate.
    "served" is the share of a class's samples the API would actually report
    correctly: right label *and* confidence >= the serving threshold.
    """
    from eval_pose_metrics import confusion_metrics  # noqa: PLC0415

    num_classes = len(features.labels)
    folds = grouped_stratified_kfold(features.y, features.groups, k=args.cv, seed=args.seed)
    probs = np.zeros((len(features.y), num_classes), dtype=np.float32)

    for fold_idx, held_out in enumerate(folds):
        train_idx = np.setdiff1d(np.arange(len(features.y)), held_out)
        # Early stopping needs a validation set; carve it from the training
        # folds (grouped), never from the held-out fold being scored.
        inner_train, inner_val, _ = grouped_stratified_split(
            features.y[train_idx], features.groups[train_idx], features.labels,
            val_fraction=args.validation_split, seed=args.seed,
        )
        tr, va = train_idx[inner_train], train_idx[inner_val]
        train_x, train_y = features.x[tr], features.y[tr]
        if args.augment_mirror:
            train_x = np.concatenate([train_x, mirror_features(train_x)])
            train_y = np.concatenate([train_y, train_y])
        model, _ = train_classifier(
            train_x, train_y, num_classes=num_classes,
            validation_data=(features.x[va], features.y[va]),
            epochs=args.epochs, batch_size=args.batch_size,
            dropout=args.dropout, l2=args.l2, patience=args.patience or None,
            verbose=0,
        )
        probs[held_out] = model.predict(features.x[held_out], verbose=0)
        print(f"fold {fold_idx + 1}/{args.cv}: {len(held_out)} samples scored", flush=True)

    pred = probs.argmax(axis=1)
    metrics = confusion_metrics(features.y, pred, num_classes)
    served = (pred == features.y) & (probs.max(axis=1) >= SERVING_MIN_CLASS_PROB)

    width = max(len(label) for label in features.labels)
    print(f"\n{args.cv}-fold grouped cross-validation "
          f"({'with' if args.augment_mirror else 'without'} mirror augmentation)")
    print(f"accuracy {metrics['accuracy']:.3f}, macro F1 {metrics['macro_f1']:.3f}, "
          f"served {served.mean():.3f}\n")
    print(f"{'class'.ljust(width)}  {'prec':>6} {'rec':>6} {'f1':>6} {'served':>7} {'n':>5}")
    print("-" * (width + 36))
    for idx, label in enumerate(features.labels):
        mask = features.y == idx
        print(f"{label.ljust(width)}  {metrics['precision'][idx]:>6.3f} "
              f"{metrics['recall'][idx]:>6.3f} {metrics['f1'][idx]:>6.3f} "
              f"{served[mask].mean():>7.3f} {int(mask.sum()):>5}")
    return probs


def main() -> int:
    args = parse_args()
    logging.basicConfig(
        level=args.log_level.upper(),
        format="%(asctime)s %(levelname)-8s %(name)s | %(message)s",
    )

    features = load_or_extract(args.rebuild_cache, args.limit_per_class)

    if features.is_empty or features.stats.kept < MIN_SAMPLES:
        logger.error("Not enough usable samples: %s", features.stats.summary())
        return 1
    if len(features.labels) < MIN_CLASSES:
        logger.error("Need >=%d classes, found %d", MIN_CLASSES, len(features.labels))
        return 1

    logger.info("Extraction: %s", features.stats.summary())
    logger.info("Classes (%d): %s", len(features.labels), ", ".join(features.labels))
    print_class_report(features)

    if args.cv:
        cross_validate(features, args)
        return 0

    num_classes = len(features.labels)
    class_weight = (
        balanced_class_weights(features.y, num_classes) if args.class_weight else None
    )

    if args.legacy_split:
        print("\n!! --legacy-split: Keras validation_split on class-ordered rows.")
        print("   Validation will contain classes absent from training. Diagnostic only.")
        model, history = train_classifier(
            features.x,
            features.y,
            num_classes=num_classes,
            validation_split=args.validation_split,
            epochs=args.epochs,
            batch_size=args.batch_size,
            dropout=args.dropout,
            l2=args.l2,
            patience=args.patience or None,
            class_weight=class_weight,
            verbose=0,
        )
    else:
        train_idx, val_idx, report = grouped_stratified_split(
            features.y,
            features.groups,
            features.labels,
            val_fraction=args.validation_split,
            seed=args.seed,
        )
        print("\nGrouped, stratified split")
        print(report.format_table())
        if report.single_group_classes:
            print(f"\nsingle-group classes (kept in train): {report.single_group_classes}")

        train_x, train_y = features.x[train_idx], features.y[train_idx]
        if args.augment_mirror:
            train_x = np.concatenate([train_x, mirror_features(train_x)])
            train_y = np.concatenate([train_y, train_y])
            print(f"\nMirror augmentation: {len(train_idx)} -> {len(train_y)} training samples")

        model, history = train_classifier(
            train_x,
            train_y,
            num_classes=num_classes,
            validation_data=(features.x[val_idx], features.y[val_idx]),
            epochs=args.epochs,
            batch_size=args.batch_size,
            dropout=args.dropout,
            l2=args.l2,
            patience=args.patience or None,
            class_weight=class_weight,
            verbose=0,
        )

    print_curve(history)

    if args.no_save:
        print("\n--no-save: artifacts not written")
        return 0

    save_classifier(model, features.labels)
    print("\nTraining complete")
    print(f"  Samples : {features.stats.kept} "
          f"({features.stats.retention_rate:.1%} of {features.stats.total_images})")
    print(f"  Classes : {num_classes}")
    print(f"  Model   : {CLASSIFIER_MODEL_PATH}")
    print(f"  Labels  : {LABELS_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
