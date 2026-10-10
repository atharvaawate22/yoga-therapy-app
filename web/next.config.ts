import path from "node:path";
import type { NextConfig } from "next";

// The repo root: parent of web/ and packages/. Turbopack refuses to resolve
// files outside its root, and both pose-core (../packages) and the RN app's
// content and storage modules (../src/data, via the @app-data alias) live there.
const repoRoot = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  // Fully static: the app is offline-first and inference runs in the
  // browser, so there is nothing for a server to do. `next build` -> out/.
  output: "export",
  // The image optimizer needs a server; static assets are optimized at
  // build time instead (M5).
  images: { unoptimized: true },
  // pose-core ships TypeScript source, not a build.
  transpilePackages: ["pose-core"],
  turbopack: {
    root: repoRoot,
    resolveAlias: {
      // The RN app's storage helpers (src/data/userStorage.js and
      // sessionStorage.js) are reused unchanged on top of localStorage.
      "@react-native-async-storage/async-storage": "./src/lib/storage/asyncStorageShim.ts",
    },
  },
};

export default nextConfig;
