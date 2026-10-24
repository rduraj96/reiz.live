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

async function setup(page: Page) {
  await page.route("**/__test/tone.wav", (route) =>
    route.fulfill({ status: 200, contentType: "audio/wav", body: tone }),
  );
  await page.route("**/api/stations*", (route) => route.fulfill({ json: bandStations(route.request().url()) }));
  await page.goto("/");
}

const setUser = async (page: Page) => {
  // The auth store module may evaluate after `load` (WebKit): wait for its E2E hook.
  await page.waitForFunction(() => "__useAuth" in window);
  return page.evaluate(() =>
    (window as unknown as { __useAuth: { setState: (s: object) => void } }).__useAuth.setState({
      user: { id: "u1" },
      saved: [],
    }),
  );
};

test("SEARCH opens the Search tab and focuses the input", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "SEARCH" }).click();
  await expect(page.getByRole("tab", { name: "Search" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("searchbox", { name: "Search stations" })).toBeFocused();
});

test("SAVED opens the Saved tab, Recent is a second tab", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "SAVED" }).click();
  await expect(page.getByRole("tab", { name: "Saved" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Recent" }).click();
  await expect(page.getByRole("tab", { name: "Recent" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Nothing played yet")).toBeVisible();
});

test("a played station shows up in Recent", async ({ page }) => {
  await setup(page);
  // Wait for the dial to prime its first station before tapping the blob.
  await expect(page.getByRole("slider", { name: "Tune stations" })).toHaveAttribute("aria-valuetext", /^House one/);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "SAVED" }).click();
  await page.getByRole("tab", { name: "Recent" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("listitem").first()).toContainText("House");
});

test("tapping the paused current station in Recent resumes it", async ({ page }) => {
  await setup(page);
  await expect(page.getByRole("slider", { name: "Tune stations" })).toHaveAttribute("aria-valuetext", /^House one/);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "SAVED" }).click();
  await page.getByRole("tab", { name: "Recent" }).click();
  await page.getByRole("listitem").first().getByRole("button").first().click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible({ timeout: 5000 });
});

test("SAVED while logged out asks to log in", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "SAVED" }).click();
  await expect(page.getByText("Log in to save stations")).toBeVisible();
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("dialog")).toContainText("Login is unavailable right now");
});

test("SAVED while logged in offers Log out at least 44px tall", async ({ page }) => {
  await setup(page);
  await setUser(page);
  await page.getByRole("button", { name: "SAVED" }).click();
  const logOut = page.getByRole("button", { name: "Log out" });
  await expect(logOut).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in" })).toHaveCount(0);
  expect((await logOut.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test("Escape closes the panel and returns focus to the trigger", async ({ page }) => {
  await setup(page);
  const trigger = page.getByRole("button", { name: "SAVED" });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("INFO describes the tuner and links the repo", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "INFO" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("tuner");
  await expect(dialog).toContainText("Radio Browser");
  await expect(dialog.getByRole("link", { name: /github/i })).toHaveAttribute(
    "href",
    "https://github.com/rduraj96/reiz.live",
  );
});
