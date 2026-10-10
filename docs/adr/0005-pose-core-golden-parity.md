# 0005 · Pose logic in plain TypeScript, held to Python by golden fixtures

**Context.**
- After MoveNet, the server's logic is NumPy and Python: feature normalisation, a body gate, a three-layer MLP, confidence cutoffs, a vote, and a few hundred lines of correction rules.
- A hand port would drift silently.

**Decision.**
- `packages/pose-core` is a dependency-free TypeScript port.
- The MLP is three matrix multiplies on weights exported to JSON (`backend/export_web_artifacts.py`), so it needs neither TF.js nor ONNX.
- Python generates golden outputs (`backend/export_parity_fixtures.py`), and TypeScript must reproduce all of them:
  - 1,008 skeletons × 29 pose names × 3 levels = 87,696 correction outputs, compared as exact strings along with the distance metrics
  - 500 frames per MoveNet variant through the full post-MoveNet pipeline
  - 300 vote sequences

**Consequences.**
- TypeScript reproduces 100% of the outputs. Cases that sit exactly on a float32/float64 decision boundary are resampled rather than allowed a tolerance (182 of about 1,200 skeletons).
- The fixtures store hashes of the Python sources and models they came from. If the rules change or the model is retrained without regenerating them, both the pose-core and backend tests fail. Web CI runs on those backend paths.
- When the Android app moves to on-device inference, it can import the same package.
