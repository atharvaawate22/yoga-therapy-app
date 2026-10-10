# 0009 · Run MoveNet in a Web Worker

**Context.** On CPU, one Thunder inference takes about 70 ms. On the main
thread, that is a long task every frame, and every tap waits for it.

**Decision.**
- The page sends each frame to a worker as a transferred `ImageBitmap`.
- The worker letterboxes it on an `OffscreenCanvas`, runs LiteRT and posts back the raw output.
- If the worker can't start, inference falls back to the main thread. `?worker=0` forces that.

**Consequences.** Measured with the fake camera, Thunder on CPU, 3 runs each:

| | Long tasks per ~6 s | Tap answered in | Inference |
|---|---|---|---|
| Main thread | 64–67 | 32–96 ms | 68–70 ms |
| Worker | 0 | 16–24 ms | 67–77 ms |

The worker needs a fetch shim: LiteRT looks for its `.wasm` next to the bundled
worker script and has no option to look anywhere else.
