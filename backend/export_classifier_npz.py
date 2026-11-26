"""Write models/pose_classifier.npz from models/pose_classifier.keras.

The server loads the .npz (numpy only) instead of the .keras file (which needs
h5py and cost ~2.8 s of a Lambda cold start). train_movenet_classifier.py runs
this automatically through save_classifier; run it by hand only if the .keras
file was replaced some other way. tests/test_numpy_classifier.py fails when
the two files are out of step.

    python export_classifier_npz.py
"""

from utils.model import export_classifier_npz
from utils.paths import CLASSIFIER_MODEL_PATH, CLASSIFIER_NPZ_PATH

if __name__ == "__main__":
    export_classifier_npz(CLASSIFIER_MODEL_PATH, CLASSIFIER_NPZ_PATH)
    print(f"Wrote {CLASSIFIER_NPZ_PATH} ({CLASSIFIER_NPZ_PATH.stat().st_size} bytes)")
