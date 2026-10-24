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

const stations = [station("a", "Alpha FM"), station("b", "Bravo FM")];

async function setup(page: Page) {
  await page.route("**/__test/tone.wav", (route) =>
    route.fulfill({ status: 200, contentType: "audio/wav", body: tone }),
  );
  await page.route("**/api/stations*", (route) => route.fulfill({ json: stations }));
  await page.goto("/");
}

test("RECENT opens the panel on the Recent tab", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "RECENT" }).click();
  await expect(page.getByRole("tab", { name: "Recent" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Nothing played yet")).toBeVisible();
});

test("a played station shows up in Recent", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Stations" }).click();
  await page.getByRole("listitem").nth(1).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible({ timeout: 5000 });

  await page.getByRole("button", { name: "RECENT" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("listitem").first()).toContainText("Bravo FM");
});

test("SAVED while logged out asks to log in", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "SAVED" }).click();
  await expect(page.getByText("Log in to save stations")).toBeVisible();
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("dialog")).toContainText("Login is unavailable right now");
});

test("Escape closes the panel and returns focus to the trigger", async ({ page }) => {
  await setup(page);
  const trigger = page.getByRole("button", { name: "RECENT" });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("ABOUT shows the directory credit and repo link", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "ABOUT" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Radio Browser");
  await expect(dialog.getByRole("link", { name: /github/i })).toHaveAttribute(
    "href",
    "https://github.com/rduraj96/reiz.live",
  );
});
