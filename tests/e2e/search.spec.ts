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

const genreList = [station("a", "Alpha FM"), station("b", "Bravo FM")];
const lofi = [station("l1", "Lofi One"), station("l2", "Lofi Two")];

async function setup(page: Page, random: { status: number; body: unknown } = { status: 200, body: station("r", "Random FM") }) {
  await page.route("**/__test/tone.wav", (route) =>
    route.fulfill({ status: 200, contentType: "audio/wav", body: tone }),
  );
  // Registered first; later, more specific routes win.
  await page.route("**/api/stations*", (route) => route.fulfill({ json: genreList }));
  await page.route("**/api/stations/search*", (route) => route.fulfill({ json: lofi }));
  await page.route("**/api/stations/random*", (route) =>
    route.fulfill({ status: random.status, json: random.body }),
  );
  await page.route("**/api/countries", (route) =>
    route.fulfill({ json: [{ code: "DE", name: "Germany" }, { code: "FR", name: "France" }] }),
  );
  await page.goto("/");
}

// fixme(Task 10: the "Stations" button was removed with the play bar).
test.fixme("typing in the panel search shows results, clearing restores the genre list", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Stations" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByRole("listitem").first()).toContainText("Alpha FM");

  const search = page.getByRole("searchbox", { name: "Search stations" });
  await search.fill("lofi");
  await expect(page.getByRole("listitem").first()).toContainText("Lofi One");
  await expect(page.getByRole("listitem")).toHaveCount(2);

  await search.fill("");
  await expect(page.getByRole("listitem").first()).toContainText("Alpha FM");
});

// fixme(Task 10: the "Stations" button was removed with the play bar).
test.fixme("country select is populated with All countries first", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Stations" }).click();
  const options = page.getByRole("combobox", { name: "Country" }).locator("option");
  await expect(options).toHaveText(["All countries", "Germany", "France"]);
});

// fixme(Task 10: the "Stations" button was removed with the play bar).
test.fixme("selecting a search result plays it", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Stations" }).click();
  await page.getByRole("searchbox", { name: "Search stations" }).fill("lofi");
  await page.getByRole("listitem").nth(1).getByRole("button").first().click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Lofi Two").first()).toBeVisible();
});

// fixme(Task 10: the "Stations" button was removed with the play bar).
test.fixme("picking a search result keeps Browse's genre list", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Stations" }).click();
  const search = page.getByRole("searchbox", { name: "Search stations" });
  await search.fill("lofi");
  await page.getByRole("listitem").nth(1).getByRole("button").first().click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible({ timeout: 5000 });

  // Closing the panel cleared the query, so Browse is back on the genre list.
  await page.getByRole("button", { name: "Stations" }).click();
  await expect(search).toHaveValue("");
  await search.fill("");
  await expect(page.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByRole("listitem").first()).toContainText("Alpha FM");
});

// fixme(Task 10: the header SurpriseButton was removed; "Surprise me" is now the dial shuffle).
test.fixme("Surprise me requests a random station for the genre and plays it", async ({ page }) => {
  await setup(page);
  const request = page.waitForRequest((r) => r.url().includes("/api/stations/random?genre=house"));
  await page.getByRole("button", { name: "Surprise me" }).click();
  await request;
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Random FM").first()).toBeVisible();
});

// fixme(Task 10: the header SurpriseButton was removed; "Surprise me" is now the dial shuffle).
test.fixme("a 404 from random shows a toast", async ({ page }) => {
  await setup(page, { status: 404, body: { error: "No playable station found" } });
  await page.getByRole("button", { name: "Surprise me" }).click();
  await expect(page.getByRole("status")).toHaveText("Nothing playable in this genre right now");
});
