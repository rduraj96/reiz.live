import { expect, test, type Page } from "@playwright/test";

const KNOWN_ID = "11111111-aaaa-bbbb-cccc-000000000001";

const fixtureStation = {
  id: KNOWN_ID,
  name: "Fixture FM",
  streamUrl: "/__test/tone.wav",
  homepage: null,
  favicon: null,
  country: "Germany",
  countryCode: "DE",
  language: "english",
  tags: ["house"],
  codec: "WAV",
  bitrate: 128,
};

/** Every band answers with `list`; `[]` means the shared station is on no loaded band. */
async function mockBands(page: Page, list: unknown[]) {
  await page.route("**/api/stations*", (route) => route.fulfill({ json: list }));
}

test.beforeEach(async ({ page }) => {
  await mockBands(page, []);
});

test("share link primes the station off the dial: band Shared, plays on first tap", async ({ page }) => {
  await page.goto(`/s/${KNOWN_ID}`);
  await expect(page.getByTestId("intro")).toHaveCount(0, { timeout: 9000 });
  await expect(page.locator("main").getByText("Fixture FM").and(page.locator(':not([aria-hidden="true"])')).first()).toBeVisible();
  await expect(page.getByText("Shared", { exact: true })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Tune stations" })).toHaveAttribute(
    "aria-valuetext",
    "Fixture FM, Shared",
  );
  await expect(page.getByText("Tap to play")).toBeVisible();
  // Nothing plays until the user taps.
  await expect(page.getByRole("button", { name: "Pause" })).toHaveCount(0);
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible({ timeout: 5000 });
});

test("share link whose station is on a loaded band: needle sits on it, no Shared band", async ({ page }) => {
  await mockBands(page, [fixtureStation]);
  await page.goto(`/s/${KNOWN_ID}`);
  await expect(page.getByTestId("intro")).toHaveCount(0, { timeout: 9000 });
  const dial = page.getByRole("slider", { name: "Tune stations" });
  await expect(dial).toHaveAttribute("aria-valuetext", /^Fixture FM, (?!Shared)/);
  await expect(page.getByText("Shared", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Tap to play")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause" })).toHaveCount(0);
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
