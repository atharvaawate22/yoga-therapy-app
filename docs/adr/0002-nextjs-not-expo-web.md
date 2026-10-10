# 0002 · A separate Next.js PWA, not Expo web

**Context.** The Expo app already builds for the web with react-native-web, so
a link could have gone live in a day. Against that:
- The corrector, the most important screen, captures stills with `takePictureAsync`. It would need a rewrite either way.
- The 16 `Alert.alert` calls do nothing on the web.
- RN-web renders a phone layout stretched across a laptop.
- Every change to shared screens risks the APK, and the APK had to stay untouched.

**Decision.**
- A new Next.js 16 + TypeScript app in `web/`: static export, Tailwind, Vitest and Playwright.
- The pose logic lives in a framework-free package, `packages/pose-core`.
- No root npm workspaces, because EAS builds from the root `package.json` and lockfile.

**Consequences.**
- Content and storage code are reused, not copied:
  - `web/` imports `src/data/*.js` read-only through an alias.
  - AsyncStorage is aliased to a `localStorage` shim, so streaks and stats are the same code as on Android, covered by the same Jest tests.
- There are two UIs to maintain.
- The APK build is unaffected: `web/**` and `packages/**` are in its `paths-ignore`, and root Jest ignores both folders.
