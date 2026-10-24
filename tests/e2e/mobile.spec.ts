import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const tone = readFileSync(path.resolve("tests/e2e/fixtures/tone.wav"));

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Three stations per band, named after the requested genre (`House One`...). */
function bandStations(url: string) {
  const genre = new URL(url).searchParams.get("genre") ?? "house";
  return ["One", "Two", "Three"].map((n) => ({
    id: `${genre}-${n.toLowerCase()}`,
    name: `${capitalise(genre)} ${n}`,
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

/** The readout's name line (the big outlined name repeats the text but is aria-hidden). */
const readoutName = (page: Page, name: string) =>
  page.locator("main").getByText(name, { exact: true }).and(page.locator(':not([aria-hidden="true"])'));

async function setup(page: Page) {
  await page.route("**/__test/tone.wav", (route) =>
    route.fulfill({ status: 200, contentType: "audio/wav", body: tone }),
  );
  await page.route("**/api/stations*", (route) => route.fulfill({ json: bandStations(route.request().url()) }));
  await page.goto("/");
  await expect(page.getByRole("slider", { name: "Tune stations" })).toHaveAttribute(
    "aria-valuetext",
    "House One, House",
  );
}

for (const width of [360, 390]) {
  test(`no horizontal overflow at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 360 ? 740 : 844 });
    await setup(page);
    // Tune so the big name (which may run off both edges) is on screen.
    await page.getByRole("slider", { name: "Tune stations" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(readoutName(page, "House Two")).toBeVisible();
    for (const name of ["SEARCH", "SAVED", "INFO"]) {
      await expect(page.locator("header").getByRole("button", { name, exact: true })).toBeInViewport({ ratio: 1 });
    }
    await expect(page.getByRole("button", { name: /Language/ })).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
      page.viewportSize()!.height,
    );
  });
}

test("blob, visualizer switch, heart, share and shuffle are at least 44x44", async ({ page }) => {
  await setup(page);
  for (const name of [/^(Play|Pause)$/, /visualizer, switch/, "Ambient mode", "Save station", "Share station", "Surprise me"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box, String(name)).not.toBeNull();
    expect(box!.width, String(name)).toBeGreaterThanOrEqual(44);
    expect(box!.height, String(name)).toBeGreaterThanOrEqual(44);
  }
});

test("the language switch shows just the value below 760 px", async ({ page }) => {
  await setup(page);
  const trigger = page.getByRole("button", { name: /Language/ });
  await expect(trigger).toBeVisible();
  await expect(trigger.getByText("Lang ·")).toBeHidden();
  await expect(trigger.getByText("Any", { exact: true })).toBeVisible();
});

test("phones start on the light 2D visualizer", async ({ page }) => {
  await setup(page);
  await expect(page.locator('canvas[data-viz="2d"]')).toHaveCount(1);
  await expect(page.getByRole("button", { name: /switch to 3D/ })).toBeVisible();
});
