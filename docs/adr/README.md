# Architecture decision records

Short records of the decisions behind the web app (v2). Each one gives the
context, the decision and its cost. The full audit and plan they came from is
[`../web-app-plan.md`](../web-app-plan.md). The measurements come from there and
from [`../device-testing.md`](../device-testing.md).

| # | Decision | Status |
|---|---|---|
| [0001](0001-in-browser-inference.md) | Run the whole pose pipeline in the browser, not on the Lambda backend | Accepted |
| [0002](0002-nextjs-not-expo-web.md) | A separate Next.js PWA, not Expo web | Accepted |
| [0003](0003-litert-same-tflite.md) | LiteRT.js running the server's own `.tflite`, not TF.js or ONNX | Accepted (after a spike) |
| [0004](0004-pad-never-crop.md) | Pad frames to a square, never crop | Accepted |
| [0005](0005-pose-core-golden-parity.md) | Port the pose logic to plain TypeScript, held to Python by golden fixtures | Accepted |
| [0006](0006-time-window-vote.md) | A time-window vote on the web instead of the server's 5 frames | Accepted |
| [0007](0007-calendar-reminders.md) | Calendar (`.ics`) reminders instead of push notifications | Accepted |
| [0008](0008-hand-written-service-worker.md) | A hand-written service worker instead of Serwist | Accepted |
| [0009](0009-inference-in-a-worker.md) | Run MoveNet in a Web Worker | Accepted |
| [0010](0010-model-per-device.md) | Lightning on phones, Thunder on desktop, each with its own classifier head | Accepted; phone numbers pending |
