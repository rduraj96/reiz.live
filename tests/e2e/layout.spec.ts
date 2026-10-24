import { expect, test } from "@playwright/test";

// A wide desktop: the stage must run edge to edge, not sit in a centred column.
test.use({ viewport: { width: 1920, height: 1080 } });

test("header and dial span the full width on wide screens", async ({ page }) => {
  await page.route("**/api/stations*", (route) => route.fulfill({ json: [] }));
  await page.goto("/");

  const dial = page.getByRole("slider", { name: "Tune stations" });
  await expect(dial).toBeVisible();

  for (const el of [page.locator("header"), dial]) {
    const box = await el.boundingBox();
    expect(box?.x).toBe(0);
    expect(box?.width).toBe(1920);
  }
});
