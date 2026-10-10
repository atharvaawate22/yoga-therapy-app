# 0008 · A hand-written service worker

**Context.**
- The plan named Serwist, but Serwist's Next.js integration is webpack-first, and this app builds with Turbopack.
- A static export is a complete, known list of files.

**Decision.**
- The worker is `web/sw/sw.js`: about 120 lines, no dependencies.
- A post-build script lists the export and injects a manifest with content hashes.
- At install, it precaches 302 files: pages, assets, fonts, icons, pose photos and the demo photos.
- Models and LiteRT's WASM are cached on first use.
- A new deploy waits until the user taps "Reload".

**Consequences.**
- The manifest logic is a pure module with unit tests. Playwright tests the offline app and the offline corrector in Chromium.
- Those tests found two real bugs, both now fixed and covered by tests:
  - The placeholder replacement hit a comment, leaving a worker that threw on load.
  - The first install reloaded the page on a visitor's first visit.
- The caching rules are ours to maintain.
