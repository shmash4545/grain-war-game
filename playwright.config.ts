import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 120000,
  use: {
    baseURL: "http://localhost:5180/grain-war-game/",
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run dev -- --port 5180 --strictPort",
      url: "http://localhost:5180/grain-war-game/",
      reuseExistingServer: false,
    },
    {
      command: "npm run server",
      url: "http://localhost:3102/health",
      reuseExistingServer: false,
      env: {
        PORT: "3102",
        DATA_FILE: ".data/e2e.sqlite",
        ALLOWED_ORIGINS: "http://localhost:5180",
      },
    },
  ],
});
