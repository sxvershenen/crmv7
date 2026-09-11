import { describe, expect, it, vi } from "vitest"

import type { AnalyticsConversionConsumer } from "../analytics/analytics-conversion.consumer.js"
import type { OutboxDeliveryEngine } from "../delivery/outbox-delivery.engine.js"
import type { PublicOfferingProjectionConsumer } from "../delivery/public-offering-projection.consumer.js"
import type { LiveService } from "./live.service.js"
import { OutboxDispatcherService } from "./outbox-dispatcher.service.js"

describe("OutboxDispatcherService analytics delivery", () => {
  it("dispatches the analytics consumer in the deterministic batch", async () => {
    const dispatch = vi.fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(5)
    const service = new OutboxDispatcherService(
      { publish: vi.fn() } as unknown as LiveService,
      { dispatch } as unknown as OutboxDeliveryEngine,
      { consume: vi.fn() } as unknown as PublicOfferingProjectionConsumer,
      { consume: vi.fn() } as unknown as AnalyticsConversionConsumer,
    )

    await expect(service.dispatchBatch()).resolves.toBe(10)
    expect(dispatch.mock.calls.map(([consumer]) => consumer)).toEqual(["sse", "public_projection", "analytics"])
  })
})
