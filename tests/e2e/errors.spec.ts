import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const tone = readFileSync(path.resolve("tests/e2e/fixtures/tone.wav"));

const stations = (url: string) => {
  const genre = new URL(url).searchParams.get("genre") ?? "house";
  return ["One", "Two", "Three"].map((n) => ({
    id: `${genre}-${n.toLowerCase()}`,
    name: `${genre.charAt(0).toUpperCase()}${genre.slice(1)} ${n}`,
    streamUrl: "/__test/dead.wav",
    homepage: null,
    favicon: null,
    country: "Germany",
    countryCode: "DE",
    language: "english",
    tags: [genre],
    codec: "WAV",
    bitrate: 128,
  }));
};

const dial = (page: Page) => page.getByRole("slider", { name: "Tune stations" });

test("a failing directory shows Couldn't load on the bands and a Retry that re-requests", async ({ page }) => {
  let failing = true;
  const requests: string[] = [];
  await page.route("**/__test/tone.wav", (r) => r.fulfill({ status: 200, contentType: "audio/wav", body: tone }));
  await page.route("**/api/stations*", (route) => {
    requests.push(route.request().url());
    return failing
      ? route.fulfill({ status: 502, json: { error: "bad gateway" } })
      : route.fulfill({ json: stations(route.request().url()).map((s) => ({ ...s, streamUrl: "/__test/tone.wav" })) });
  });
  await page.goto("/");

  const readout = page.locator("main");
  const retry = readout.getByRole("button", { name: "Retry" });
  await expect(retry).toBeVisible();
  await expect(readout.getByText("Couldn't load stations")).toBeVisible();
  await expect(dial(page)).toBeVisible();

  failing = false;
  const before = requests.length;
  const again = page.waitForRequest((r) => r.url().includes("/api/stations"));
  await retry.click();
  await again;
  expect(requests.length).toBeGreaterThan(before);
  await expect(retry).toBeHidden();
  await expect(dial(page)).toHaveAttribute("aria-valuetext", /House One/);
});

test("after every station fails, the readout says so", async ({ page }) => {
  await page.route("**/__test/dead.wav", (r) => r.fulfill({ status: 404, body: "nope" }));
  await page.route("**/api/stations*", (route) => route.fulfill({ json: stations(route.request().url()) }));
  await page.goto("/");

  await expect(dial(page)).toHaveAttribute("aria-valuetext", /House One/);
  await dial(page).focus();
  await page.keyboard.press("ArrowRight");

  await expect(page.locator("main").getByText("Couldn't play any station here — tune somewhere else")).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator("main").getByRole("button", { name: "Retry" })).toBeHidden();
});

test("a station that failed here stays off the dial after a reload", async ({ page }) => {
  await page.route("**/__test/tone.wav", (r) => r.fulfill({ status: 200, contentType: "audio/wav", body: tone }));
  await page.route("**/__test/dead.wav", (r) => r.fulfill({ status: 404, body: "nope" }));
  // House Two is dead; the rest play.
  await page.route("**/api/stations*", (route) =>
    route.fulfill({
      json: stations(route.request().url()).map((s) => ({
        ...s,
        streamUrl: s.id === "house-two" ? "/__test/dead.wav" : "/__test/tone.wav",
      })),
    }),
  );
  await page.goto("/");
  await expect(dial(page)).toHaveAttribute("aria-valuetext", "House One, House");
  await dial(page).focus();
  await page.keyboard.press("ArrowRight"); // House Two fails and the player moves on
  await expect(page.locator("main").getByText("House Three", { exact: true }).filter({ visible: true }).first()).toBeVisible({
    timeout: 15000,
  });

  await page.reload();
  let deadRequests = 0;
  page.on("request", (r) => r.url().includes("/__test/dead.wav") && deadRequests++);
  await expect(dial(page)).toHaveAttribute("aria-valuetext", "House One, House");
  await dial(page).focus();
  await page.keyboard.press("ArrowRight"); // straight to House Three: House Two isn't on the dial any more
  await expect(dial(page)).toHaveAttribute("aria-valuetext", "House Three, House");
  await expect(page.locator("[data-station-id='house-two']")).toHaveCount(0);
  expect(deadRequests).toBe(0);
});
