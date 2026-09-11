import "reflect-metadata"

import { describe, expect, it, vi } from "vitest"

import { REQUIRED_CAPABILITIES } from "../common/require-capability.decorator.js"
import { AnalyticsAggregateController } from "./analytics-aggregate.controller.js"

describe("AnalyticsAggregateController", () => {
  it("requires the dedicated analytics read capability", () => {
    expect(Reflect.getMetadata(
      REQUIRED_CAPABILITIES,
      AnalyticsAggregateController.prototype.get,
    )).toEqual(["canViewAnalytics"])
  })

  it("forwards only the validated aggregate query to the service", async () => {
    const get = vi.fn().mockResolvedValue({ items: [] })
    const controller = new AnalyticsAggregateController({ get } as never)
    const query = { from: "2026-09-01", to: "2026-09-02", interval: "day" } as const

    await expect(controller.get(query)).resolves.toEqual({ items: [] })
    expect(get).toHaveBeenCalledWith(query)
  })
})
