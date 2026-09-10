import { defineConfig, devices } from "@playwright/test"

const production = process.env.SITE_TEST_RUNTIME === "production"

export default defineConfig({
  testDir: "./e2e",
  testMatch: "content-delivery.spec.ts",
  workers: 1,
  retries: 0,
  reporter: "line",
  use: { baseURL: "http://127.0.0.1:4327", trace: "retain-on-failure" },
  webServer: [
    {
      command: "node e2e/support/cms-server.mjs",
      url: "http://127.0.0.1:4398/health",
      reuseExistingServer: false,
    },
    {
      command: production ? "pnpm build && node dist/server/entry.mjs" : "node e2e/support/site-server.mjs",
      url: "http://127.0.0.1:4327/",
      // The production run deliberately requests fixtures: the build must still
      // read the published API and fail closed when it becomes unavailable.
      env: {
        SITE_TEST_PORT: "4327", HOST: "127.0.0.1", PORT: "4327",
        SITE_CONTENT_SOURCE: production ? "fixture" : "cms",
        CMS_PUBLIC_API_BASE_URL: "http://127.0.0.1:4398/api/public/v1",
      },
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
})
