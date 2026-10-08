# pose-core

Platform-free pose logic for the Yoga Therapy clients: no DOM, no React, no
model runtime. The web app uses it now; the React Native app is meant to adopt
it later (plan milestone M8).

The Python backend (`backend/utils/`, `backend/yoga_pose_engine.py`) is the
source of truth: the classifier was trained on its features. Everything here is
a port that tests hold to the Python behaviour.

It holds everything the server does after MoveNet:

- `keypoints.ts`: the keypoint contract (names, order, skeleton, MoveNet output layout)
- `features.ts`: the 34-value feature vector and the body-presence gate
- `classifier.ts`: the MLP forward pass, with weights exported from the
  server's Keras models into `models/` (one head per MoveNet variant)
- `corrections.ts`: the rule-based alignment cues and Warrior II distances
- `stability.ts`: the live-mode majority vote
- `analyze.ts`: `analyzeFrame`, all of the above in `/analyze-pose` order

**Parity with Python is tested, not assumed.** `fixtures/parity.json.gz` holds
the server's outputs on about 1,000 skeletons × 29 pose names × 3 levels, 500
frames per MoveNet variant, and 300 vote sequences. `src/parity.test.ts`
requires every output to match exactly, and fails if the Python sources
changed since the fixtures were generated (`backend/export_parity_fixtures.py`).
`src/features.test.ts` also replays the 32 real lab photos.

```bash
npm install
npm test           # vitest
npm run typecheck
```
