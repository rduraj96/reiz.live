import { readFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const tone = readFileSync(path.resolve("tests/e2e/fixtures/tone.wav"));

function bandStations(url: string) {
  const genre = new URL(url).searchParams.get("genre") ?? "house";
  return ["One", "Two"].map((n) => ({
    id: `${genre}-${n.toLowerCase()}`,
    name: `${genre.charAt(0).toUpperCase()}${genre.slice(1)} ${n}`,
    streamUrl: "/__test/tone.wav",
    homepage: null,
    favicon: null,
    country: "Germany",
    countryCode: "DE",
    language: "english",
    tags: [genre],
    codec: "WAV",
    bitrate: 128,
  }));
}

async function setup(page: Page) {
  await page.route("**/__test/tone.wav", (r) => r.fulfill({ status: 200, contentType: "audio/wav", body: tone }));
  await page.route("**/api/stations*", (route) => route.fulfill({ json: bandStations(route.request().url()) }));
  await page.route("**/api/now-playing*", (route) => route.fulfill({ json: { title: "Moby - Porcelain" } }));
  await page.goto("/");
  await expect(page.getByRole("slider", { name: "Tune stations" })).toHaveAttribute("aria-valuetext", "House One, House");
}

const dial = (page: Page) => page.getByRole("slider", { name: "Tune stations" });
const exitButton = (page: Page) => page.getByRole("button", { name: "Exit ambient mode" });
/** Like a user reaching for the controls: a pointer move brings back the bar if it went idle. */
const wake = async (page: Page) => {
  await page.mouse.move(10, 10);
  await page.mouse.move(20, 20);
};
const blobWidth = async (page: Page) => (await page.getByRole("button", { name: /^(Play|Pause)$/ }).boundingBox())!.width;

test("the ambient button hides the controls, grows the visualizer, and Esc brings everything back", async ({ page }) => {
  await setup(page);
  const before = await blobWidth(page);
  await page.getByRole("button", { name: "Ambient mode" }).click();
  await expect(exitButton(page)).toBeVisible();
  await expect(dial(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "SEARCH" })).toBeHidden();
  await expect.poll(() => blobWidth(page)).toBeGreaterThan(before);

  await page.keyboard.press("Escape");
  await expect(exitButton(page)).toHaveCount(0);
  await expect(dial(page)).toBeVisible();
});

test("focus moves to the exit button on entering, and back to the Ambient button on leaving", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Ambient mode" }).click();
  await expect(exitButton(page)).toBeFocused();
  await wake(page);
  await exitButton(page).click();
  await expect(page.getByRole("button", { name: "Ambient mode" })).toBeFocused();
});

test("the exit button leaves ambient mode", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Ambient mode" }).click();
  await wake(page);
  await exitButton(page).click();
  await expect(dial(page)).toBeVisible();
});

test("F toggles ambient mode, but not while typing in search", async ({ page }) => {
  await setup(page);
  await page.keyboard.press("f");
  await expect(exitButton(page)).toBeVisible();
  await page.keyboard.press("f");
  await expect(dial(page)).toBeVisible();

  await page.getByRole("button", { name: "SEARCH" }).click();
  await page.getByRole("searchbox", { name: "Search stations" }).pressSequentially("funk");
  await expect(page.getByRole("searchbox", { name: "Search stations" })).toHaveValue("funk");
  await expect(exitButton(page)).toHaveCount(0);
});

test("the bottom bar shows the station and song, and fades out when idle", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator("main [data-now-playing]")).toHaveText("Moby - Porcelain");
  await page.getByRole("button", { name: "Ambient mode" }).click();
  const bar = page.getByTestId("ambient-bar");
  await expect(bar).toContainText("House One");
  await expect(bar).toContainText("Moby - Porcelain");
  await expect(bar).toHaveAttribute("data-idle", "true", { timeout: 6000 });
  // The cursor hides over the visualizer too, not just the background.
  const cursor = await page.getByRole("button", { name: /^(Play|Pause)$/ }).evaluate((el) => getComputedStyle(el).cursor);
  expect(cursor).toBe("none");
  await page.mouse.move(40, 40);
  await page.mouse.move(80, 80);
  await expect(bar).not.toHaveAttribute("data-idle", "true");
});

test("no serious axe violations in ambient mode", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Ambient mode" }).click();
  await expect(exitButton(page)).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  const severe = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(severe.map((v) => v.id)).toEqual([]);
});

test("when idle, the first tap only brings the controls back (it doesn't pause the music)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "a mouse wakes the controls by moving before it can click");
  await setup(page);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Ambient mode" }).click();
  const bar = page.getByTestId("ambient-bar");
  await expect(bar).toHaveAttribute("data-idle", "true", { timeout: 6000 });

  const { width, height } = page.viewportSize()!;
  await page.touchscreen.tap(width / 2, height / 2); // on the visualizer
  await expect(bar).not.toHaveAttribute("data-idle", "true");
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await wake(page);
  await exitButton(page).click();
  await expect(dial(page)).toBeVisible();
});
