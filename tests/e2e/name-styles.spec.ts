import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const tone = readFileSync(path.resolve("tests/e2e/fixtures/tone.wav"));

const station = {
  id: "house-one",
  name: "House One",
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

test("station name: orbit ring on phones, ticker band on desktop", async ({ page }) => {
  await page.route("**/__test/tone.wav", (route) =>
    route.fulfill({ status: 200, contentType: "audio/wav", body: tone }),
  );
  await page.route("**/api/stations*", (route) => route.fulfill({ json: [station] }));
  const orbit = page.locator('main [data-variant="orbit"]');
  const ticker = page.locator('main [data-variant="ticker"]');
  const textOf = (l: typeof orbit) =>
    l.evaluate((el) => (el.textContent ?? "").replace(/\s+/g, "").toUpperCase());

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect.poll(() => textOf(orbit)).toContain("HOUSEONE");
  await expect(orbit).toBeVisible();
  await expect(ticker).toBeHidden();

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(ticker).toBeVisible();
  await expect(orbit).toBeHidden();
  expect(await textOf(ticker)).toContain("HOUSEONE");
});
