import { expect, test, type Page } from "@playwright/test";

/** Wait until the service worker has activated and precached the app. */
async function waitForPrecache(page: Page): Promise<number> {
  return page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 120; i++) {
      const name = (await caches.keys()).find((n) => n.startsWith("yoga-precache-"));
      if (name && navigator.serviceWorker.controller) {
        return (await (await caches.open(name)).keys()).length;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    return 0;
  });
}

test("is installable: valid manifest with reachable icons", async ({ page, request }) => {
  await page.goto("/about");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("/manifest.webmanifest");
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({ name: "Yoga Therapy", start_url: "/", display: "standalone" });
  const purposes = manifest.icons.map((icon: { purpose: string }) => icon.purpose);
  expect(purposes).toContain("maskable");
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);
});

test("works offline after the first visit", async ({ page, context }) => {
  await page.goto("/about");
  expect(await waitForPrecache(page)).toBeGreaterThan(100);

  await context.setOffline(true);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Yoga for real problems");

  await page.goto("/conditions/back-pain");
  await expect(page.getByRole("heading", { name: "Recommended yoga" })).toBeVisible();

  await page.goto("/poses/tree_pose");
  await expect(page.getByRole("heading", { name: "Tree Pose" })).toBeVisible();
  // Pose photos come from the precache too.
  await expect(page.locator('img[src="/poses/tree_pose-960.webp"]')).toHaveJSProperty("complete", true);

  await page.goto("/surya");
  await expect(page.getByRole("heading", { name: "Surya Namaskar" })).toBeVisible();

  // Client-side navigation between cached pages.
  await page.goto("/settings");
  await page.getByRole("link", { name: "Progress" }).first().click();
  await expect(page.getByRole("heading", { name: "My progress" })).toBeVisible();
});

test("the corrector works offline once its model has been loaded", async ({ page, context }) => {
  await page.goto("/corrector?mode=photo");
  await waitForPrecache(page);
  await page.getByRole("button", { name: "Warrior II" }).click();
  await expect(page.getByText("Recognised pose")).toBeVisible({ timeout: 90_000 });

  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Tree Pose" }).click();
  await expect(page.getByText("Recognised pose")).toBeVisible();
  await expect(page.getByText("Vrksasana")).toBeVisible();

  const cachedModels = await page.evaluate(async () =>
    (await (await caches.open("yoga-runtime")).keys()).map((r) => new URL(r.url).pathname),
  );
  expect(cachedModels).toContain("/models/movenet_thunder.tflite");
});
