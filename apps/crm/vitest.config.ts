import path from "node:path"
import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const alias = {
  "@app": path.resolve(currentDirectory, "src"),
  "@": path.resolve(currentDirectory, "../../packages/ui/src"),
}
const sharedTest = {
  environment: "jsdom" as const,
  setupFiles: "./src/test/setup.ts",
}

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          ...sharedTest,
          exclude: ["src/pages/bookings-page.test.tsx"],
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          name: "api-mode",
        },
      },
      {
        resolve: { alias },
        test: {
          ...sharedTest,
          env: { VITE_DATA_MODE: "fixtures" },
          include: ["src/pages/bookings-page.test.tsx"],
          name: "fixture-mode",
        },
      },
    ],
  },
})
