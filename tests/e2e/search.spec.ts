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

/** Band requests answer with three stations named after the genre, so each band is identifiable on the dial. */
function bandStations(url: string) {
  const genre = new URL(url).searchParams.get("genre") ?? "house";
  const title = genre.charAt(0).toUpperCase() + genre.slice(1);
  return ["one", "two", "three"].map((n) => station(`${genre}-${n}`, `${title} ${n}`));
}

const results = [station("house-two", "House two"), station("far-away", "Faraway FM")];

async function setup(page: Page, random: { status: number; body: unknown } = { status: 200, body: station("r", "Random FM") }) {
  await page.route("**/__test/tone.wav", (route) =>
    route.fulfill({ status: 200, contentType: "audio/wav", body: tone }),
  );
  // Registered first; later, more specific routes win.
  await page.route("**/api/stations*", (route) => route.fulfill({ json: bandStations(route.request().url()) }));
  await page.route("**/api/stations/search*", (route) => route.fulfill({ json: results }));
  await page.route("**/api/stations/random*", (route) =>
    route.fulfill({ status: random.status, json: random.body }),
  );
  await page.route("**/api/countries", (route) =>
    route.fulfill({ json: [{ code: "DE", name: "Germany" }, { code: "FR", name: "France" }] }),
  );
  await page.goto("/");
}

test("typing in the panel search shows results, clearing removes them", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "SEARCH" }).click();
  const search = page.getByRole("searchbox", { name: "Search stations" });
  await search.fill("far");
  await expect(page.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByRole("listitem").nth(1)).toContainText("Faraway FM");
  await search.fill("");
  await expect(page.getByRole("listitem")).toHaveCount(0);
});

test("country select is populated with All countries first", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "SEARCH" }).click();
  const options = page.getByRole("combobox", { name: "Country" }).locator("option");
  await expect(options).toHaveText(["All countries", "Germany", "France"]);
});

test("picking a result that is on the dial moves the needle to it", async ({ page }) => {
  await setup(page);
  const dial = page.getByRole("slider", { name: "Tune stations" });
  await expect(dial).toHaveAttribute("aria-valuetext", /^House one/);
  await page.getByRole("button", { name: "SEARCH" }).click();
  await page.getByRole("searchbox", { name: "Search stations" }).fill("house");
  await page.getByRole("listitem").first().getByRole("button").first().click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(dial).toHaveAttribute("aria-valuetext", /^House two/);
});

test("picking a result that is not on the dial shows the off-dial band", async ({ page }) => {
  await setup(page);
  const dial = page.getByRole("slider", { name: "Tune stations" });
  await expect(dial).toHaveAttribute("aria-valuetext", /^House one/);
  await page.getByRole("button", { name: "SEARCH" }).click();
  await page.getByRole("searchbox", { name: "Search stations" }).fill("far");
  await page.getByRole("listitem").nth(1).getByRole("button").first().click();
  // The off-dial band has an empty label, so the value text is the bare station name.
  await expect(dial).toHaveAttribute("aria-valuetext", "Faraway FM");
});

test("picking a result after playing starts it playing", async ({ page }) => {
  await setup(page);
  // Wait for the dial to prime its first station before tapping the blob.
  await expect(page.getByRole("slider", { name: "Tune stations" })).toHaveAttribute("aria-valuetext", /^House one/);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "SEARCH" }).click();
  await page.getByRole("searchbox", { name: "Search stations" }).fill("far");
  await page.getByRole("listitem").nth(1).getByRole("button").first().click();
  await expect(page.getByRole("slider", { name: "Tune stations" })).toHaveAttribute("aria-valuetext", "Faraway FM");
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible({ timeout: 5000 });
});

test("Surprise me spins the dial to a loaded station and plays it", async ({ page }) => {
  await setup(page);
  const dial = page.getByRole("slider", { name: "Tune stations" });
  await expect(dial).toHaveAttribute("aria-valuetext", /^House /);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Surprise me" }).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible({ timeout: 5000 });
});
