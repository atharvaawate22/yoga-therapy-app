import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the real static export (`npm run build` first),
 * in Chromium with a fake camera that plays a generated video of a yoga
 * pose (e2e/global-setup.ts).
 */
export const FAKE_CAMERA = join(__dirname, "test-results", "fake-camera.y4m");
const PORT = 4173;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: {
    // Serves out/ like Vercel does (/about -> about.html).
    command: `npx serve out -l ${PORT} --no-clipboard`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        permissions: ["camera"],
        launchOptions: {
          args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
            `--use-file-for-fake-video-capture=${FAKE_CAMERA}`,
          ],
        },
      },
    },
  ],
});
