# 0003 · LiteRT.js running the server's own `.tflite`

**Context.**
- The classifier was trained on MoveNet v3 keypoints.
- The plan was to compare two options: converting the server's `.tflite` to ONNX, or TF.js MoveNet (v4 weights).
- An M2 spike measured each runtime against the server on 32 freely licensed Wikimedia photos, comparing the keypoint error, the label and the result the user would actually see.

| Runtime · model | Mean keypoint error | Same served result |
|---|---|---|
| LiteRT.js · Thunder (WASM and WebGPU) | 0.00095 | 32/32 |
| TF.js v4 · Thunder · WebGPU | 0.0109 | 26/32 |

**Decision.**
- Use Google's LiteRT.js (`@litertjs/core`), found during the spike. It runs the vendored `.tflite` files unchanged, so there is no conversion step.
- WebGPU uses LiteRT's JSPI build. CPU uses the plain WASM build, which was faster there.

**Consequences.**
- The APK backend and the browser are served by one model file.
- TF.js was the fastest (6–12 ms) but failed parity: its v4 weights differ from the v3 weights the classifier learned from. It stays in `/lab`, for comparison only.
- LiteRT's Emscripten loader looks for its `.wasm` next to the running script, which breaks inside a bundled worker. The worker redirects those fetches ([0009](0009-inference-in-a-worker.md)).
