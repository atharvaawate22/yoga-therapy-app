"""Classifier architecture, training and persistence.

The head that sits on top of MoveNet: a small MLP over the 34-value normalized
keypoint vector. It is intentionally tiny — MoveNet already did the visual
work, so this only has to separate poses in a low-dimensional geometric space.

TensorFlow is imported inside the functions rather than at module scope so that
importing the API (or running the unit tests) does not require it.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np

from .paths import CLASSIFIER_MODEL_PATH, LABELS_PATH, MODELS_DIR
from .preprocessing import FEATURE_DIM

logger = logging.getLogger(__name__)

__all__ = [
    "DEFAULT_EPOCHS",
    "DEFAULT_BATCH_SIZE",
    "DEFAULT_VALIDATION_SPLIT",
    "DEFAULT_DROPOUT",
    "DEFAULT_L2",
    "DEFAULT_PATIENCE",
    "balanced_class_weights",
    "build_classifier",
    "train_classifier",
    "save_classifier",
    "load_classifier",
    "load_labels",
]

DEFAULT_EPOCHS = 200  # an upper bound; early stopping decides when to halt
DEFAULT_BATCH_SIZE = 16
DEFAULT_VALIDATION_SPLIT = 0.2
# Chosen by ablation on a grouped, stratified split (see backend/README.md).
# Dropout 0.2 lowered val_loss 0.82 -> 0.66; adding L2 1e-4 or inverse-frequency
# class weights both made it worse, so neither is enabled by default.
DEFAULT_DROPOUT = 0.2
DEFAULT_L2 = 0.0
DEFAULT_PATIENCE = 10


def build_classifier(
    num_classes: int,
    feature_dim: int = FEATURE_DIM,
    dropout: float = DEFAULT_DROPOUT,
    l2: float = DEFAULT_L2,
) -> Any:
    """34 -> 64 -> 32 -> num_classes, softmax.

    Dropout and L2 default to off. The architecture has ~4k parameters against
    a 34-dimensional input, so it has little capacity to memorize; reach for
    regularization only when a trustworthy validation curve says it is needed.
    """
    import tensorflow as tf  # noqa: PLC0415 - lazy, see module docstring

    regularizer = tf.keras.regularizers.l2(l2) if l2 else None

    layers: List[Any] = [tf.keras.layers.Input(shape=(feature_dim,))]
    for units in (64, 32):
        layers.append(
            tf.keras.layers.Dense(
                units, activation="relu", kernel_regularizer=regularizer
            )
        )
        if dropout:
            layers.append(tf.keras.layers.Dropout(dropout))
    layers.append(tf.keras.layers.Dense(num_classes, activation="softmax"))

    return tf.keras.Sequential(layers)


def train_classifier(
    x: np.ndarray,
    y: np.ndarray,
    num_classes: int,
    validation_data: Optional[Tuple[np.ndarray, np.ndarray]] = None,
    epochs: int = DEFAULT_EPOCHS,
    batch_size: int = DEFAULT_BATCH_SIZE,
    validation_split: Optional[float] = None,
    dropout: float = DEFAULT_DROPOUT,
    l2: float = DEFAULT_L2,
    patience: Optional[int] = DEFAULT_PATIENCE,
    class_weight: Optional[Dict[int, float]] = None,
    verbose: int = 1,
) -> Tuple[Any, Any]:
    """Fit the head. Returns ``(model, history)``.

    Prefer passing an explicit ``validation_data`` built by
    ``utils.splits.grouped_stratified_split``. Keras' ``validation_split``
    slices the *last* rows before shuffling, which on class-ordered features
    hands back a validation set made of entirely different classes — use it
    only for deliberate comparisons.
    """
    import tensorflow as tf  # noqa: PLC0415

    y_onehot = tf.keras.utils.to_categorical(y, num_classes=num_classes)

    fit_validation_data = None
    if validation_data is not None:
        val_x, val_y = validation_data
        fit_validation_data = (
            val_x,
            tf.keras.utils.to_categorical(val_y, num_classes=num_classes),
        )

    model = build_classifier(num_classes, dropout=dropout, l2=l2)
    model.compile(
        optimizer="adam", loss="categorical_crossentropy", metrics=["accuracy"]
    )

    callbacks = []
    has_validation = fit_validation_data is not None or bool(validation_split)
    if patience and has_validation:
        # Restore the best weights so the saved model is the one that
        # generalized best, not whatever the last epoch happened to produce.
        callbacks.append(
            tf.keras.callbacks.EarlyStopping(
                monitor="val_loss",
                patience=patience,
                restore_best_weights=True,
                verbose=verbose,
            )
        )

    history = model.fit(
        x,
        y_onehot,
        epochs=epochs,
        batch_size=batch_size,
        validation_data=fit_validation_data,
        validation_split=validation_split if fit_validation_data is None else None,
        callbacks=callbacks,
        class_weight=class_weight,
        verbose=verbose,
    )
    return model, history


def balanced_class_weights(y: np.ndarray, num_classes: int) -> Dict[int, float]:
    """Inverse-frequency weights, normalized to mean 1.

    Counters the 13x head-to-tail imbalance in the pose folders so rare classes
    are not simply ignored in favour of the common ones.
    """
    counts = np.bincount(y, minlength=num_classes).astype(float)
    present = counts > 0
    weights = np.ones(num_classes, dtype=float)
    weights[present] = counts[present].sum() / (present.sum() * counts[present])
    return {i: float(w) for i, w in enumerate(weights)}


def save_classifier(
    model: Any,
    labels: Sequence[str],
    model_path: Path = CLASSIFIER_MODEL_PATH,
    labels_path: Path = LABELS_PATH,
) -> None:
    """Persist weights and the label order together.

    The label list is the model's output contract — index i of the softmax is
    ``labels[i]``. Writing them separately is how label spaces silently drift,
    so they are always saved in the same call.
    """
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model.save(model_path)
    labels_path.write_text(json.dumps(list(labels), indent=2), encoding="utf-8")
    logger.info("Saved classifier -> %s (%d classes)", model_path, len(labels))


def load_classifier(model_path: Path = CLASSIFIER_MODEL_PATH) -> Any:
    """Load a saved model.

    ``compile=False`` skips optimizer state, which is unused for inference and
    is the usual cause of load failures across TF/Keras versions.
    """
    import tensorflow as tf  # noqa: PLC0415

    return tf.keras.models.load_model(model_path, compile=False)


def load_labels(labels_path: Path = LABELS_PATH) -> List[str]:
    return json.loads(labels_path.read_text(encoding="utf-8"))
