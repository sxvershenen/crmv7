import { defineConfig, devices } from "@playwright/test"

import { assertSafeTestDatabaseEnvironment } from "../../packages/db/src/test-database-safety.js"

assertSafeTestDatabaseEnvironment({ ...process.env, APP_ENV: "test", DATABASE_URL: process.env.TEST_DATABASE_URL })

export default defineConfig({
  testDir: "./e2e-live",
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:4328", trace: "retain-on-failure" },
  webServer: [
    {
      command: "APP_ENV=test DATABASE_URL=\"$TEST_DATABASE_URL\" pnpm --filter @crm/api test:db:prepare-e2e && APP_ENV=test DATABASE_URL=\"$TEST_DATABASE_URL\" API_PORT=3011 CORS_ORIGIN=http://127.0.0.1:4328 LOG_LEVEL=warn pnpm dev:api",
      cwd: "../..",
      url: "http://127.0.0.1:3011/api/internal/v1/health",
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      command: "node e2e/support/site-server.mjs",
      port: 4328,
      env: {
        SITE_TEST_PORT: "4328",
        SITE_CONTENT_SOURCE: "cms",
        CMS_PUBLIC_API_BASE_URL: "http://127.0.0.1:3011/api/public/v1",
      },
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
  projects: [{ name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } }],
})
