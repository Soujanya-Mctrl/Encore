import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm --filter @encore/web dev",
    url: "http://localhost:3000/api/v1/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
