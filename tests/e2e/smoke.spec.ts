import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const tone = readFileSync(path.resolve("tests/e2e/fixtures/tone.wav"));

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Three stations per band, named after the requested genre (`House One`...) so bands are distinguishable. */
function bandStations(url: string, extra: Record<string, unknown> = {}) {
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
    ...extra,
  }));
}

/** The readout's name line (the big outlined name repeats the text but is aria-hidden). */
const readoutName = (page: Page, name: string) =>
  page.locator("main").getByText(name, { exact: true }).and(page.locator(':not([aria-hidden="true"])'));

async function setup(page: Page, opts: { requests?: string[]; extra?: Record<string, unknown> } = {}) {
  await page.route("**/__test/tone.wav", (route) =>
    route.fulfill({ status: 200, contentType: "audio/wav", body: tone }),
  );
  await page.route("**/api/stations*", (route) => {
    const url = route.request().url();
    opts.requests?.push(url);
    return route.fulfill({ json: bandStations(url, opts.extra) });
  });
  await page.goto("/");
}

const dial = (page: Page) => page.getByRole("slider", { name: "Tune stations" });

/** Wait for the House band, then step the needle right `steps` times from House One. */
async function tune(page: Page, steps: number) {
  await expect(dial(page)).toHaveAttribute("aria-valuetext", "House One, House");
  await dial(page).focus();
  for (let i = 0; i < steps; i++) await page.keyboard.press("ArrowRight");
}

/** The big name's first ticker item (the ticker is the treatment at desktop width), without its separators. */
const bigName = (page: Page) =>
  page
    .locator('main [data-variant="ticker"] [data-ticker-item]')
    .first()
    .evaluate((el) => (el.textContent ?? "").split("●")[0])
    .catch(() => "");

test("keyboard tuning updates the readout and big name, and the blob plays", async ({ page }) => {
  await setup(page);
  await tune(page, 2);

  await expect(readoutName(page, "House Three")).toBeVisible();
  await expect.poll(() => bigName(page)).toBe("HOUSE THREE");

  const blob = page.getByRole("button", { name: /^(Play|Pause)$/ });
  // The tuned station loads and plays (autoplay is allowed in the test browser).
  await expect(blob).toHaveAttribute("aria-label", "Pause", { timeout: 5000 });
  await blob.click();
  await expect(blob).toHaveAttribute("aria-label", "Play");
  await expect(page.getByText("Tap to play")).toBeVisible();
  await blob.click();
  await expect(blob).toHaveAttribute("aria-label", "Pause", { timeout: 5000 });
  await expect(page.getByText("Tap to play")).toBeHidden();
});

test("the blob shows the Tap to play hint before anything plays", async ({ page }) => {
  await setup(page);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(page.getByText("Tap to play")).toBeVisible();
});

test("a station with a malformed favicon still plays", async ({ page }) => {
  await setup(page, { extra: { favicon: "https://" } });
  await tune(page, 1);
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible({ timeout: 5000 });
});

test("choosing Deutsch in the language switch re-requests stations in German", async ({ page }) => {
  const requests: string[] = [];
  await setup(page, { requests });
  await expect(dial(page)).toHaveAttribute("aria-valuetext", "House One, House");

  const trigger = page.getByRole("button", { name: /Language/ });
  await expect(trigger.getByText("Lang ·")).toBeVisible();
  await expect(trigger.getByText("Any", { exact: true })).toBeVisible();
  await trigger.click();
  const group = page.getByRole("radiogroup", { name: "Language" });
  await expect(group.getByRole("radio").first()).toHaveText("Any");
  await expect(group.getByRole("radio", { name: "Any" })).toHaveAttribute("aria-checked", "true");

  const german = page.waitForRequest((r) => r.url().includes("/api/stations") && r.url().includes("language=german"));
  await group.getByRole("radio", { name: "Deutsch" }).click();
  await german;
  await expect(group).toBeHidden();
  await expect(trigger).toContainText(/Deutsch/i);
});

test("the language popover closes on Escape and returns focus to its trigger", async ({ page }) => {
  await setup(page);
  const trigger = page.getByRole("button", { name: /Language/ });
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("radiogroup", { name: "Language" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("radiogroup", { name: "Language" })).toBeHidden();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
});

test("header holds SEARCH, SAVED and INFO", async ({ page }) => {
  await setup(page);
  const header = page.locator("header");
  for (const name of ["SEARCH", "SAVED", "INFO"]) {
    await expect(header.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await header.getByRole("button", { name: "INFO", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Radio Browser");
});

test("heart while logged out opens login (unavailable without Supabase env)", async ({ page }) => {
  await setup(page);
  await tune(page, 1);
  await expect(readoutName(page, "House Two")).toBeVisible();
  await page.getByRole("button", { name: "Save station" }).click();
  await expect(page.getByRole("dialog")).toContainText("Login is unavailable right now");
});
