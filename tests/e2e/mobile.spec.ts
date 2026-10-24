import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

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

const stations = [station("a", "Alpha FM"), station("b", "Bravo FM")];

async function setup(page: Page, requests: string[] = []) {
  await page.route("**/__test/tone.wav", (route) =>
    route.fulfill({ status: 200, contentType: "audio/wav", body: tone }),
  );
  await page.route("**/api/stations*", (route) => {
    requests.push(route.request().url());
    return route.fulfill({ json: stations });
  });
  await page.goto("/");
}

test("no horizontal overflow at 390 px", async ({ page }) => {
  await setup(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("no horizontal overflow at 360 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await setup(page);
  await expect(page.getByRole("button", { name: "Stations" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("genre and language are chip rows; scroll pickers are hidden", async ({ page }) => {
  await setup(page);
  await expect(page.getByRole("radiogroup", { name: "Genre" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Language" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Genre" })).toBeHidden();
  await expect(page.getByRole("group", { name: "Language" })).toBeHidden();
});

test("tapping the Pop chip requests genre=pop", async ({ page }) => {
  const requests: string[] = [];
  await setup(page, requests);
  const pop = page.getByRole("radio", { name: "Pop", exact: true });
  const request = page.waitForRequest((r) => r.url().includes("/api/stations") && r.url().includes("genre=pop"));
  await pop.tap();
  await request;
  await expect(pop).toHaveAttribute("aria-checked", "true");
});

test("compact bar controls are at least 44x44", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Stations" }).tap();
  await page.getByRole("listitem").first().tap();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible({ timeout: 5000 });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Alpha FM").locator("visible=true").first()).toBeVisible();
  for (const name of ["Pause", "Save station", "Stations"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.width, name).toBeGreaterThanOrEqual(44);
    expect(box!.height, name).toBeGreaterThanOrEqual(44);
  }
});

test("Stations opens the bottom sheet", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Stations" }).tap();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("header menu opens, lists items, and Escape returns focus", async ({ page }) => {
  await setup(page);
  const menu = page.getByRole("button", { name: "Menu" });
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await menu.tap();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  for (const name of ["Recent", "Saved", "About", "Surprise me", "Log in"]) {
    await expect(page.getByRole("button", { name })).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();
  await menu.tap();
  await page.getByRole("button", { name: "Recent" }).tap();
  await expect(page.getByRole("tab", { name: "Recent" })).toHaveAttribute("aria-selected", "true");
});
