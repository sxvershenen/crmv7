import { afterEach, describe, expect, it, vi } from "vitest"

import { AnalyticsDailyRollupWorker } from "./analytics-daily-rollup.worker.js"

afterEach(() => vi.restoreAllMocks())

describe("AnalyticsDailyRollupWorker", () => {
  it("does not start under APP_ENV=test", () => {
    const interval = vi.spyOn(global, "setInterval")
    const rebuildDay = vi.fn()
    const worker = new AnalyticsDailyRollupWorker({ get: () => "test" } as never, { rebuildDay } as never)

    worker.onModuleInit()

    expect(interval).not.toHaveBeenCalled()
    expect(rebuildDay).not.toHaveBeenCalled()
  })

  it("rebuilds only yesterday in the Moscow calendar", async () => {
    const rebuildDay = vi.fn().mockResolvedValue(3)
    const worker = new AnalyticsDailyRollupWorker({ get: () => "development" } as never, { rebuildDay } as never)

    await expect(worker.tick(new Date("2026-09-12T21:30:00.000Z"))).resolves.toBe(3)
    expect(rebuildDay).toHaveBeenCalledWith("2026-09-12")
  })
})
