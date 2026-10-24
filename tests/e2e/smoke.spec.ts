import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const tone = readFileSync(path.resolve("tests/e2e/fixtures/tone.wav"));

const station = (id: string, name: string) => ({
  id,
  name,
  streamUrl: "/__test/tone.wav",
  homepage: null,
  favicon: null,
  country: "Germany",
  countryCode: "DE",
  language: "english",
  tags: ["house"],
  codec: "WAV",
  bitrate: 128,
});

const stations = [station("a", "Alpha FM"), station("b", "Bravo FM"), station("c", "Charlie FM")];

async function serveTone(page: Page) {
  await page.route("**/__test/tone.wav", (route) =>
    route.fulfill({ status: 200, contentType: "audio/wav", body: tone }),
  );
}

test("lists stations and plays the selected one", async ({ page }) => {
  await serveTone(page);
  await page.route("**/api/stations*", (route) => route.fulfill({ json: stations }));
  await page.goto("/");

  await expect(page.getByText("House", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Stations" }).click();
  const items = page.getByRole("listitem");
  await expect(items).toHaveCount(3);

  await items.nth(1).click();
  await expect(page.getByText("Bravo FM").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible({ timeout: 5000 });
});

test("empty list offers Any language", async ({ page }) => {
  const urls: string[] = [];
  await page.route("**/api/stations*", (route) => {
    urls.push(route.request().url());
    return route.fulfill({ json: [] });
  });
  await page.goto("/");

  await expect(page.getByText("No stations for this combo")).toBeVisible();
  await page.getByRole("button", { name: "Any language" }).click();
  await expect.poll(() => urls.some((u) => u.includes("language=any"))).toBe(true);
});

test("directory failure shows Retry", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/stations*", (route) => {
    calls++;
    return route.fulfill({ status: 502, json: { error: "Radio directory unavailable" } });
  });
  await page.goto("/");

  await expect(page.getByText("Radio directory unavailable")).toBeVisible();
  const before = calls;
  await page.getByRole("button", { name: "Retry" }).click();
  await expect.poll(() => calls).toBeGreaterThan(before);
});
