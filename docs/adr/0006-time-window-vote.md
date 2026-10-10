# 0006 · A time-window vote on the web

**Context.**
- The server reports a pose only once it wins 3 of the last 5 frames.
- At about 1 frame/s on the APK, that takes a few seconds.
- At 15 frames/s in the browser, 5 frames is a third of a second, so the label would flicker.

**Decision.**
- `TimeWindowVote` uses the same majority rule over the last 1.2 s: a pose needs 60% of the votes.
- The window never holds fewer than 5 frames.
- Both votes share a `Vote` interface. The server's 5-frame vote stays in pose-core, covered by the parity tests.

**Consequences.**
- Labels are stable at any frame rate. On slow devices, the 5-frame floor gives exactly the server's behaviour, and a test checks that.
- The floor came from testing in the browser: without it, a device running at 1 frame/s never reported a pose.
- Speech is time-based too. A cue is spoken once it has held for 2 s, at most every 4 s, and never repeated back to back.
