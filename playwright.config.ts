import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: "http://localhost:3100" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
      },
    },
  ],
  webServer: [
    {
      command: "node tests/e2e/fixtures/radio-browser.mjs",
      url: "http://localhost:3101/json/stations/byuuid/ping",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run build && npm start -- -p 3100",
      url: "http://localhost:3100",
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: { RADIO_BROWSER_BASE: "http://localhost:3101" },
    },
  ],
});
