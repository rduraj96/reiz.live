import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const tone = readFileSync(path.resolve("tests/e2e/fixtures/tone.wav"));

const stations = (url: string) => {
  const genre = new URL(url).searchParams.get("genre") ?? "house";
  return ["One", "Two"].map((n) => ({
    id: `${genre}-${n.toLowerCase()}`,
    name: `${genre} ${n}`,
    streamUrl: "/__test/tone.wav",
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

async function mockStations(page: Page, status = 200) {
  await page.route("**/api/stations*", (route) =>
    status === 200
      ? route.fulfill({ json: stations(route.request().url()) })
      : route.fulfill({ status, json: { error: "down" } }),
  );
}

const intro = (page: Page) => page.getByTestId("intro");

test.describe("full motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("sweeps 87.5 to 108.0 signal locked, then leaves the DOM and the page is ready", async ({ page }) => {
    await mockStations(page);
    await page.addInitScript(() => {
      new MutationObserver(() => {
        const w = window as unknown as { __first?: string };
        const t = document.querySelector('[data-testid="intro-reading"]')?.textContent;
        if (t && w.__first === undefined) w.__first = t;
      }).observe(document, { childList: true, subtree: true, characterData: true });
    });
    await page.goto("/");
    // The sweep is monotonic, so 87.5 is transient: record the first reading from an init script.
    const first = await page.evaluate(() => (window as unknown as { __first?: string }).__first);
    expect(first).toBe("87.5");
    const reading = page.getByTestId("intro-reading");
    await expect(reading).toHaveText("108.0", { timeout: 7000 });
    await expect(intro(page)).toContainText("MHz · signal locked");
    await expect(intro(page)).toHaveCount(0, { timeout: 8000 });
    await expect(page.getByText("Tap to play")).toBeVisible();
    // The first station is primed: heart enabled, readout names it.
    await expect(page.getByRole("button", { name: "Save station" })).toBeEnabled();
    await expect(page.locator("main").getByText("house One", { exact: true }).and(page.locator(':not([aria-hidden="true"])'))).toBeVisible();
  });

  test("still ends within 8 s when the directory is down", async ({ page }) => {
    await mockStations(page, 502);
    await page.goto("/");
    await expect(intro(page)).toHaveCount(0, { timeout: 9000 });
  });

  test("directory down at first load: after Retry the blob plays", async ({ page }) => {
    let failing = true;
    await page.route("**/__test/tone.wav", (r) => r.fulfill({ status: 200, contentType: "audio/wav", body: tone }));
    await page.route("**/api/stations*", (route) =>
      failing
        ? route.fulfill({ status: 502, json: { error: "down" } })
        : route.fulfill({ json: stations(route.request().url()) }),
    );
    await page.goto("/");
    await expect(intro(page)).toHaveCount(0, { timeout: 9000 });

    failing = false;
    await page.locator("main").getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("slider", { name: "Tune stations" })).toHaveAttribute("aria-valuetext", /house One/);

    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible({ timeout: 5000 });
  });
});

test("reduced motion: gone within 1 s and no sweep is rendered", async ({ page }) => {
  await mockStations(page);
  const seen: string[] = [];
  await page.exposeFunction("report", (t: string) => seen.push(t));
  await page.addInitScript(() => {
    new MutationObserver(() => {
      const t = document.querySelector('[data-testid="intro-reading"]')?.textContent;
      if (t) (window as unknown as { report: (s: string) => void }).report(t);
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });
  await page.goto("/");
  await expect(intro(page)).toHaveCount(0, { timeout: 1500 });
  expect(seen).not.toContain("108.0");
});
