import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // One retry on CI: a pass on retry is still reported as flaky, and the failure's trace is uploaded.
  retries: process.env.CI ? 1 : 0,
  // Reduced motion by default so glides and letter rises settle instantly; intro.spec.ts opts back in.
  use: {
    baseURL: "http://localhost:3100",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    // Start on the light 2D visualizer: CI has no GPU, so the 3D blob renders in software and starves the page.
    // Tests about the 3D default clear this.
    storageState: {
      cookies: [],
      origins: [{ origin: "http://localhost:3100", localStorage: [{ name: "reizdio:viz", value: "2d" }] }],
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
      },
    },
    // Safari's engine at a phone size: the iOS-only bugs (deaf analyser, frame-aligned decoding, gradient ticks) live here.
    { name: "webkit-iphone", use: { ...devices["iPhone 13"] } },
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
