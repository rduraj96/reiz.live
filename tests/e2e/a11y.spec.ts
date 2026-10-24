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
  // Let the entrance animations finish so axe sees final colours/opacity.
  await page.waitForTimeout(2000);
}

async function expectNoSevereViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const severe = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    severe.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
  ).toEqual([]);
}

async function expectFocusRings(page: Page) {
  let stops = 0;
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    const style = await page.evaluate(() => {
      const el = document.activeElement;
      return el && el !== document.body ? getComputedStyle(el).outlineStyle : null;
    });
    if (style === null) break; // focus left the document: fewer than 10 tab stops on this layout
    stops++;
    expect(style, `tab stop ${i + 1}`).not.toBe("none");
  }
  expect(stops).toBeGreaterThanOrEqual(4);
}

test.describe("desktop", () => {
  test("no serious axe violations", async ({ page }) => {
    await setup(page);
    await expectNoSevereViolations(page);
  });

  test("no serious axe violations with the panel open", async ({ page }) => {
    await setup(page);
    await page.getByRole("button", { name: "Stations" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoSevereViolations(page);
  });

  test("tab stops show a focus ring", async ({ page }) => {
    await setup(page);
    await expectFocusRings(page);
  });
});

test.describe("390px", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("no serious axe violations", async ({ page }) => {
    await setup(page);
    await expectNoSevereViolations(page);
  });

  test("no serious axe violations with the panel open", async ({ page }) => {
    await setup(page);
    await page.getByRole("button", { name: "Stations" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoSevereViolations(page);
  });

  test("tab stops show a focus ring", async ({ page }) => {
    await setup(page);
    await expectFocusRings(page);
  });
});

test("station rows are buttons", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Stations" }).click();
  await expect(page.getByRole("button", { name: /Alpha FM/ })).toBeVisible();
});

test("reduced motion disables the marquee", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  await page.getByRole("button", { name: "Stations" }).click();
  await page.getByRole("button", { name: /Alpha FM/ }).click();
  const name = await page.locator(".animate-marquee").first().evaluate((el) => getComputedStyle(el).animationName);
  expect(name).toBe("none");
});

test("focus returns to the opener control even when the opener was not focused", async ({ page }) => {
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
