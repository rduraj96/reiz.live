import { readFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
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
  await page.route("**/api/countries*", (route) =>
    route.fulfill({ json: [{ code: "DE", name: "Germany" }] }),
  );
  await page.goto("/");
  // Wait for the entrance animations to settle so axe sees final colours/opacity.
  await page.waitForFunction(() => {
    const animated = document.querySelectorAll('header, main > div[style*="opacity"], .pointer-events-auto[style*="opacity"]');
    return animated.length > 0 && Array.from(animated).every((el) => getComputedStyle(el).opacity === "1");
  });
}

async function expectNoSevereViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const severe = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    severe.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
  ).toEqual([]);
}

// Exact number of real tab stops (disabled controls are skipped); one layout at every width:
// LanguageSwitch, SEARCH, SAVED, INFO, the blob button, shuffle and the dial. Heart and share are
// disabled until a station is tuned, and the language options stay hidden while the popover is closed.
const DESKTOP_TAB_STOPS = 7;
const MOBILE_TAB_STOPS = 7;

async function focusRing(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const cs = getComputedStyle(el);
    return { style: cs.outlineStyle, color: cs.outlineColor, width: cs.outlineWidth };
  });
}

async function expectFocusRings(page: Page, tabStops: number) {
  for (let i = 1; i <= tabStops; i++) {
    await page.keyboard.press("Tab");
    expect(await focusRing(page), `tab stop ${i} of ${tabStops}: focus left the page`).not.toBeNull();
    // Poll: `transition-colors` animates outline-color for ~150ms after focus.
    await expect
      .poll(() => focusRing(page), { message: `tab stop ${i}` })
      .toEqual({ style: "solid", color: "rgb(238, 38, 71)", width: "2px" });
  }
  // Exactly `tabStops`: one more Tab leaves the page's controls.
  await page.keyboard.press("Tab");
  expect(await focusRing(page), `more than ${tabStops} tab stops`).toBeNull();
}

test.describe("desktop", () => {
  test("no serious axe violations", async ({ page }) => {
    await setup(page);
    await expectNoSevereViolations(page);
  });

  // fixme(Task 13: the "Stations" button was removed with the play bar).
  test.fixme("no serious axe violations with the panel open", async ({ page }) => {
    await setup(page);
    await page.getByRole("button", { name: "Stations" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoSevereViolations(page);
  });

  test("tab stops show a focus ring", async ({ page }) => {
    await setup(page);
    await expectFocusRings(page, DESKTOP_TAB_STOPS);
  });

  // fixme(Task 13: the genre picker was removed (the dial replaces it)).
  test.fixme("genre picker is a keyboard radio group", async ({ page }) => {
    await setup(page);
    const picker = page.getByRole("radiogroup", { name: "Genre" });
    const checked = picker.getByRole("radio", { checked: true });
    await expect(checked).toHaveText("House");
    await checked.focus();
    const request = page.waitForRequest((r) => r.url().includes("/api/stations?genre=dance"));
    await page.keyboard.press("ArrowDown");
    await request;
    await expect(picker.getByRole("radio", { checked: true })).toHaveText("Dance");
    await expect(picker.getByRole("radio", { checked: true })).toBeFocused();
  });
});

test.describe("390px", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("no serious axe violations", async ({ page }) => {
    await setup(page);
    await expectNoSevereViolations(page);
  });

  // fixme(Task 13: the "Stations" button was removed with the play bar).
  test.fixme("no serious axe violations with the panel open", async ({ page }) => {
    await setup(page);
    await page.getByRole("button", { name: "Stations" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoSevereViolations(page);
  });

  test("tab stops show a focus ring", async ({ page }) => {
    await setup(page);
    await expectFocusRings(page, MOBILE_TAB_STOPS);
  });
});

// fixme(Task 13: the "Stations" button was removed with the play bar).
test.fixme("station rows are buttons", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Stations" }).click();
  await expect(page.getByRole("button", { name: /Alpha FM/ })).toBeVisible();
});

// fixme(Task 13: the "Stations" button and the marquee were removed).
test.fixme("reduced motion disables the marquee", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  await page.getByRole("button", { name: "Stations" }).click();
  await page.getByRole("button", { name: /Alpha FM/ }).click();
  const name = await page.locator(".animate-marquee").first().evaluate((el) => getComputedStyle(el).animationName);
  expect(name).toBe("none");
});

// fixme(Task 13: the RECENT header button was removed).
test.fixme("focus returns to the opener control even when the opener was not focused", async ({ page }) => {
  await setup(page);
  // Simulate Safari/Firefox: a mouse click leaves document.activeElement on body.
  await page.getByRole("button", { name: "RECENT" }).evaluate((el) => {
    el.addEventListener("mousedown", (e) => e.preventDefault());
  });
  await page.getByRole("button", { name: "RECENT" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "RECENT" })).toBeFocused();
});
