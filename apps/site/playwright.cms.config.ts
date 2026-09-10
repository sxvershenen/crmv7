import { defineConfig, devices } from "@playwright/test"

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
      command: "node e2e/support/site-server.mjs",
      url: "http://127.0.0.1:4327/",
      env: { SITE_TEST_PORT: "4327", SITE_CONTENT_SOURCE: "cms", CMS_PUBLIC_API_BASE_URL: "http://127.0.0.1:4398/api/public/v1" },
      reuseExistingServer: false,
    },
  ],
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
})
