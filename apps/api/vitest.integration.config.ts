import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["test/**/*.integration.test.ts"],
    setupFiles: ["test/integration.setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
})
