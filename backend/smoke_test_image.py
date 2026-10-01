"""Smoke test run inside the built serving image before it is deployed.

Usage (from the repo root, see .github/workflows/deploy-lambda-backend.yml):

    docker run --rm -i --entrypoint python IMAGE - < backend/smoke_test_image.py

The unit tests stub both models, so they can't catch a serving image whose
real runtimes fail to load (a missing dependency, an incompatible wheel).
This loads the real MoveNet + classifier the way a request does and runs one
full analysis, so a broken image fails the deploy instead of production.
"""

import base64
import importlib.util
import io
import sys
import time

import numpy as np
from PIL import Image

started = time.perf_counter()
import yoga_pose_engine as engine  # noqa: E402

movenet = engine.get_movenet()
classifier = engine.get_classifier()
load_seconds = time.perf_counter() - started

interpreter_module = type(movenet.interpreter).__module__
assert interpreter_module.startswith("ai_edge_litert"), (
    f"MoveNet should run on LiteRT, got {interpreter_module}"
)
assert isinstance(classifier.model, engine.NumpyClassifier), (
    f"classifier should be the numpy runtime, got {type(classifier.model)}"
)
assert classifier.ready(), "classifier did not load"
assert importlib.util.find_spec("tensorflow") is None, (
    "tensorflow is installed in the serving image; it should not be needed"
)

buffer = io.BytesIO()
Image.new("RGB", (640, 480), (127, 127, 127)).save(buffer, "JPEG")
request = engine.PoseAnalyzeRequest(
    image_base64=base64.b64encode(buffer.getvalue()).decode("ascii"),
    source="image",
)
response = engine.analyze_pose(request, movenet=movenet, classifier=classifier)
assert response.pose == engine.NO_POSE, response
assert response.debug_image_base64 is None

probs = classifier.predict(np.zeros(34, dtype=np.float32))
assert abs(sum(probs.values()) - 1.0) < 1e-4, probs

print(f"smoke test passed: runtimes loaded in {load_seconds:.1f}s, "
      f"{len(classifier.labels)} classes, interpreter={interpreter_module}")
sys.exit(0)
