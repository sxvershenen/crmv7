import { defineConfig, devices } from "@playwright/test"

import { assertSafeTestDatabaseEnvironment } from "../../packages/db/src/test-database-safety.js"

assertSafeTestDatabaseEnvironment({
  ...process.env,
  APP_ENV: "test",
  DATABASE_URL: process.env.TEST_DATABASE_URL,
})

export default defineConfig({
  testDir: "./e2e-api",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4188",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "APP_ENV=test DATABASE_URL=\"$TEST_DATABASE_URL\" pnpm --filter @crm/api test:db:prepare-e2e && APP_ENV=test DATABASE_URL=\"$TEST_DATABASE_URL\" API_PORT=3010 CORS_ORIGIN=http://127.0.0.1:4188 LOG_LEVEL=warn pnpm dev:api",
      cwd: "../..",
      reuseExistingServer: false,
      url: "http://127.0.0.1:3010/api/internal/v1/health",
    },
    {
      command: "VITE_API_PROXY_TARGET=http://127.0.0.1:3010 pnpm dev --host 127.0.0.1 --port 4188 --strictPort",
      reuseExistingServer: false,
      url: "http://127.0.0.1:4188",
    },
  ],
  projects: [{ name: "api-desktop", use: { ...devices["Desktop Chrome"] } }],
})
