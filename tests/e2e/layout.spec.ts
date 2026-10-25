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

test("panels take over the whole screen with a giant title", async ({ page }) => {
  await page.route("**/api/stations*", (route) => route.fulfill({ json: [] }));
  await page.goto("/");

  await page.getByRole("button", { name: "SEARCH" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Search" })).toBeVisible();
  await page.getByRole("tab", { name: "Saved" }).click();
  await expect(dialog.getByRole("heading", { name: "Saved" })).toBeVisible();
  await expect(async () => {
    expect(await dialog.boundingBox()).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  }).toPass();
});

test("the blob grows with big screens instead of stopping at 360 px", async ({ page }) => {
  await page.route("**/api/stations*", (route) => route.fulfill({ json: [] }));
  await page.goto("/");
  const blob = page.getByRole("button", { name: /^(Play|Pause)$/ });
  await expect(blob).toBeVisible();
  const box = (await blob.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(520);
  // Still clear of the header and the readout: it fits the stage's height.
  const stage = (await blob.locator("..").boundingBox())!;
  expect(box.height).toBeLessThanOrEqual(stage.height);
});

test.describe("the 3D default", () => {
  // Without the suite's saved 2D choice, so the device default applies.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the visualizer switch cycles 3D, Dots and Lines, and remembers it", async ({ page, isMobile }) => {
    test.skip(isMobile, "touch devices start on 2D (mobile.spec.ts covers that default)");
    await page.route("**/api/stations*", (route) => route.fulfill({ json: [] }));
    await page.goto("/");

    await expect(page.locator('canvas[data-viz="3d"]')).toHaveCount(1);
    await page.getByRole("button", { name: /switch to Dots/ }).click();
    await expect(page.locator('canvas[data-viz="2d"]')).toHaveCount(1);
    await expect(page.locator('canvas[data-viz="3d"]')).toHaveCount(0);

    await page.reload();
    await expect(page.locator('canvas[data-viz="2d"]')).toHaveCount(1);
    await page.getByRole("button", { name: /switch to Lines/ }).click();
    await expect(page.locator('canvas[data-viz="ridges"]')).toHaveCount(1);
    await page.getByRole("button", { name: /switch to 3D/ }).click();
    await expect(page.locator('canvas[data-viz="3d"]')).toHaveCount(1);
  });
});

test("Lines fill the stage edge to edge and the big name steps aside", async ({ page }) => {
  await page.route("**/api/stations*", (route) => route.fulfill({ json: [] }));
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("reizdio:viz", "ridges"));
  await page.reload();
  const lines = page.locator('canvas[data-viz="ridges"]');
  await expect(lines).toHaveCount(1);
  const box = (await lines.boundingBox())!;
  expect(box.x).toBe(0);
  expect(box.width).toBe(page.viewportSize()!.width);
  await expect(page.locator("[data-variant='ticker'], [data-variant='orbit']")).toHaveCount(0);
  // The middle of the stage still plays and pauses.
  await expect(page.getByRole("button", { name: /^(Play|Pause)$/ })).toBeVisible();
});

test("the page links the red-dot icons: favicon, SVG icon and home-screen icon", async ({ page, request }) => {
  await page.route("**/api/stations*", (route) => route.fulfill({ json: [] }));
  await page.goto("/");
  const hrefs = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').evaluateAll((els) =>
    els.map((el) => `${el.getAttribute("rel")} ${el.getAttribute("type") ?? ""} ${el.getAttribute("href")}`),
  );
  expect(hrefs.some((h) => h.startsWith("icon") && h.includes("/icon.svg"))).toBe(true);
  expect(hrefs.some((h) => h.startsWith("apple-touch-icon") && h.includes("/apple-icon.png"))).toBe(true);
  for (const path of ["/favicon.ico", "/icon.svg", "/apple-icon.png", "/icon-512.png"]) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
  expect(await (await request.get("/icon.svg")).text()).toContain("#ee2647");
});
