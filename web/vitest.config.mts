import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirrors tsconfig paths and next.config.ts resolveAlias.
    alias: {
      "@app-data": path("../src/data"),
      "@react-native-async-storage/async-storage": path("./src/lib/storage/asyncStorageShim.ts"),
      "@": path("./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
