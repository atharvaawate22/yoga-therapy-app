import { expect, test } from "@playwright/test";

// Chromium's fake camera plays a generated clip of a Warrior II photo
// (e2e/global-setup.ts), so this drives the real getUserMedia path.

test("live camera recognises the pose, corrects it, and saves the session", async ({ page }) => {
  await page.goto("/corrector?pose=warrior_pose&debug=1");
  await page.getByRole("button", { name: "Start camera" }).click();

  const overlay = page.locator(".absolute.inset-x-2");
  await expect(overlay).toContainText("Live", { timeout: 90_000 });
  await expect(overlay).toContainText("Warrior II");
  await expect(page.getByText("Target: Warrior II · matched")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Corrections", exact: true })).toBeVisible();

  // Sessions of 15 s or more with a recognised pose are saved, as in the APK.
  await page.waitForTimeout(16_000);
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByText("Session saved to your progress")).toBeVisible();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("@yoga_practice_sessions") ?? "[]"));
  expect(saved[0]).toMatchObject({ type: "corrector", title: "Pose Corrector", posesCompleted: 1 });

  await page.goto("/progress");
  await expect(page.getByText("Pose corrector · 1/1 poses")).toBeVisible();
});

test("the no-camera demo starts from a link", async ({ page }) => {
  await page.goto("/corrector?demo=1");
  const overlay = page.locator(".absolute.inset-x-2");
  await expect(overlay).toContainText("Demo · sample photos", { ignoreCase: true, timeout: 90_000 });
  await expect(overlay).toContainText(/Warrior II|Tree Pose|Downward-Facing Dog|Triangle Pose/);
});
