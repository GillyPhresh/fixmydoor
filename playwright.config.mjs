import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "browser.spec.mjs",
  timeout: 90000,
  workers: 1,
  reporter: "list",
  use: {
    launchOptions: {
      executablePath:
        process.env.FMD_CHROME_PATH ||
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
    },
    trace: "off",
    screenshot: "only-on-failure",
  },
});
