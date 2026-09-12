import { describe, expect, it, vi } from "vitest"

import { CmsSiteSettingsService } from "./cms-site-settings.service.js"

const id = "11111111-1111-4111-8111-111111111111"
const revisionId = "22222222-2222-4222-8222-222222222222"

describe("CmsSiteSettingsService", () => {
  it("enforces integration capability inside the service for every Metrika operation", async () => {
    const service = new CmsSiteSettingsService({} as never)
    const actor = { id, capabilities: { canManageIntegrations: false } }

    await expect(service.getMetrika(actor as never)).rejects.toMatchObject({ status: 403 })
    await expect(service.updateMetrika({} as never, actor as never, "request-1")).rejects.toMatchObject({ status: 403 })
    await expect(service.publishMetrika({} as never, actor as never, "request-1")).rejects.toMatchObject({ status: 403 })
  })

  it("normalizes legacy published values to an explicitly disabled public Metrika projection", async () => {
    const query = vi.fn().mockResolvedValue([{
      releaseId: id,
      revisionId,
      contentHash: "a".repeat(64),
      publishedAt: new Date("2026-09-12T12:00:00.000Z"),
      value: { siteName: "Свистоплясово" },
    }])
    const service = new CmsSiteSettingsService({ query } as never)

    await expect(service.publicSnapshot()).resolves.toMatchObject({
      value: { analytics: { metrika: { enabled: false, counterId: null } } },
    })
  })

  it("fails closed when persisted public Metrika data contains an arbitrary snippet", async () => {
    const query = vi.fn().mockResolvedValue([{
      releaseId: id,
      revisionId,
      contentHash: "a".repeat(64),
      publishedAt: new Date("2026-09-12T12:00:00.000Z"),
      value: {
        siteName: "Свистоплясово",
        analytics: { metrika: { enabled: true, counterId: "12345", snippet: "<script>ym()</script>" } },
      },
    }])
    const service = new CmsSiteSettingsService({ query } as never)

    await expect(service.publicSnapshot()).rejects.toMatchObject({ name: "ZodError" })
  })
})
