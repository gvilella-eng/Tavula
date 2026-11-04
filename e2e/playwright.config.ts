import { defineConfig } from "@playwright/test";

const url = "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: url, channel: "chrome", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm dev",
    cwd: "..",
    url,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
