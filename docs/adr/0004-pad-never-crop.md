# 0004 · Pad frames to a square, never crop

**Context.**
- MoveNet takes a square input.
- The classifier was originally trained on centre-cropped images while the server padded them. This train/serve mismatch was found and fixed in the backend: training, evaluation and serving now share `utils/preprocessing.py`.
- Cropping a landscape webcam frame would also cut off hands and feet in wide poses.

**Decision.**
- The browser letterboxes every frame exactly as the server does: a centred square with grey (114) borders, then a resize.
- The model gets unmirrored pixels. Only the preview is mirrored, with CSS.

**Consequences.**
- The measured keypoint error against the server stays at 0.00095 on the photo fixtures.
- The browser resizes with the canvas rather than OpenCV's `INTER_AREA`. The difference is small. "High" smoothing is kept because camera frames are downscaled 5× or more.
