# 0010 · Lightning on phones, Thunder on desktop

**Context.**
- Thunder is more accurate, and Lightning is about 5× faster on CPU (13 ms vs 74 ms on a desktop).
- The classifier was trained on Thunder keypoints. Fed Lightning keypoints, it matched the server's result on only 29 of 32 photos.

**Decision.**
- Train a second classifier head on Lightning keypoints.
- Pick the model by device: Thunder on desktop (WebGPU where available), Lightning on phones (CPU).
- A live session switches from Thunder to Lightning on its own if the median inference after warm-up exceeds 150 ms.
- `?model=` and `?accel=` override the choice.

**Consequences.**
- The Lightning head scores 0.765 accuracy and 0.605 macro F1 on the Wikimedia photos, against Thunder's 0.800 and 0.652. With its own head, Lightning matches the server's result on 31 of 32 lab photos.
- Under a 4× CPU throttle, the automatic switch happened after 7 s.
- The server now pairs each variant with its own head. Before, setting `MOVENET_VARIANT=lightning` silently used the Thunder classifier.
- Real phone benchmarks are still to be run (`/lab` → Benchmark this device). They decide whether Thunder or WebGPU is worth it on phones.
