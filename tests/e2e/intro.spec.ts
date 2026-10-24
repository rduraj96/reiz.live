import { expect, test, type Page } from "@playwright/test";

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
    await page.goto("/");
    const reading = page.getByTestId("intro-reading");
    await expect(reading).toHaveText("87.5");
    await expect(reading).toHaveText("108.0", { timeout: 7000 });
    await expect(intro(page)).toContainText("MHz · signal locked");
    await expect(intro(page)).toHaveCount(0, { timeout: 8000 });
    await expect(page.getByText("Tap to play")).toBeVisible();
  });

  test("still ends within 8 s when the directory is down", async ({ page }) => {
    await mockStations(page, 502);
    await page.goto("/");
    await expect(intro(page)).toHaveCount(0, { timeout: 8000 });
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
  await expect(intro(page)).toHaveCount(0, { timeout: 1000 });
  expect(seen).not.toContain("108.0");
});
