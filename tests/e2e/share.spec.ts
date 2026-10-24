import { expect, test } from "@playwright/test";

const KNOWN_ID = "11111111-aaaa-bbbb-cccc-000000000001";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/stations*", (route) => route.fulfill({ json: [] }));
});

test("share link loads the station and plays on tap", async ({ page }) => {
  await page.goto(`/s/${KNOWN_ID}`);
  await expect(page.getByText("Fixture FM").first()).toBeVisible();
  const tap = page.getByRole("button", { name: "Tap to play" });
  await expect(tap).toBeVisible();
  // Nothing plays until the user taps.
  await expect(page.getByRole("button", { name: "Pause" })).toHaveCount(0);
  await tap.click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible({ timeout: 5000 });
});

test("unknown station id shows a friendly page with a link home", async ({ page }) => {
  await page.goto("/s/unknown");
  await expect(page.getByRole("heading", { name: "Station not found" })).toBeVisible();
  await page.getByRole("link", { name: /back to reizdio/i }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("directory errors render not-found and a generic OG image", async ({ page, request }) => {
  await page.goto("/s/fail-500");
  await expect(page.getByRole("heading", { name: "Station not found" })).toBeVisible();
  const res = await request.get("/s/fail-500/opengraph-image");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");
});

test("share page has og:title and an og:image that renders", async ({ page, request }) => {
  await page.goto(`/s/${KNOWN_ID}`);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Fixture FM on REIZDIO");
  const image = await page.locator('meta[property="og:image"]').getAttribute("content");
  const res = await request.get(new URL(image!, page.url()).pathname);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");
});

test("unknown id still renders a generic OG image", async ({ request }) => {
  const res = await request.get("/s/unknown/opengraph-image");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");
});

test("share button copies the link and toasts", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => Object.defineProperty(navigator, "share", { value: undefined }));
  await page.goto(`/s/${KNOWN_ID}`);
  await page.getByRole("button", { name: "Share station" }).click();
  await expect(page.getByText("Link copied")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `http://localhost:3100/s/${KNOWN_ID}`,
  );
});
