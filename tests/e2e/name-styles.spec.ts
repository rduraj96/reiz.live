import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

// TEMPORARY with NameStylePicker: `?name=<variant>` picks the BigName treatment.

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

async function open(page: Page, variant: string) {
  await page.route("**/__test/tone.wav", (route) =>
    route.fulfill({ status: 200, contentType: "audio/wav", body: tone }),
  );
  await page.route("**/api/stations*", (route) => route.fulfill({ json: [station] }));
  await page.goto(`/?name=${variant}`);
}

/** The BigName layer's text, spaces normalised and uppercased. */
const bigNameText = (page: Page, variant: string) =>
  page
    .locator(`main [aria-hidden="true"][data-variant="${variant}"]`)
    .evaluate((el) => (el.textContent ?? "").replace(/ /g, " ").toUpperCase());

for (const variant of ["part", "orbit"]) {
  test(`?name=${variant} shows the station name in that treatment`, async ({ page }) => {
    await open(page, variant);
    await expect.poll(() => bigNameText(page, variant)).toContain("HOUSE");
    const text = await bigNameText(page, variant);
    expect(text.replace(/\s+/g, "")).toContain("HOUSEONE");
    if (variant === "orbit") expect(text).toContain("DE");
  });
}
