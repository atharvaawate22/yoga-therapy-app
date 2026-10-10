# 0001 · Run the pose pipeline in the browser

**Context.**
- The Android app (v1) sends a camera still about once a second to FastAPI on AWS Lambda. The server runs MoveNet, the classifier, the vote and the correction rules.
- A public web demo on that path would share the API Gateway throttle (10 requests/s) that APK users rely on.
- It would also pay Lambda cold starts and upload every frame.

**Decision.**
- The web app runs everything on the device: MoveNet, the 34-feature MLP, the body gate, the vote and the rules.
- The server is not in the hot path.

**Consequences.**
- Frames never leave the device. The corrector works offline once the model is cached.
- The desktop gets 10–20 frames/s instead of about 1:
  - Thunder on WebGPU: 39–43 ms
  - Thunder on CPU: 66–77 ms
  - Lightning on CPU: 13 ms
- Because of that frame rate, the vote and speech had to be re-tuned for time rather than frame count ([0006](0006-time-window-vote.md)).
- The model downloads once (9.4 MB for Lightning, 25 MB for Thunder) and the service worker caches it.
- The browser has to give the server's answers. That needs the same model ([0003](0003-litert-same-tflite.md)) and the same logic ([0005](0005-pose-core-golden-parity.md)).
