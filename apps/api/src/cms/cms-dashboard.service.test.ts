import { describe, expect, it, vi } from "vitest"

import type { SessionUser } from "@crm/contracts"
import { roleCapabilities } from "@crm/domain"

import { CmsDashboardService } from "./cms-dashboard.service.js"

const actor: SessionUser = { id: "11111111-1111-4111-8111-111111111111", name: "Admin", email: "admin@example.test", role: "admin", capabilities: roleCapabilities("admin") }

describe("CmsDashboardService", () => {
  it("maps authoritative aggregates and audited activity without analytics fixtures", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{ production_release: "REL-7", published_at: new Date("2026-09-01T10:00:00Z"), drafts: "2", review: "1", pages: "4", published_pages: "3", seo_healthy: "3", seo_risks: "1", media: "8", media_processing: "1", delivery_failures: "0", delivery_expired: "0", leads: "12", bookings: "5", paid: "3" }])
      .mockResolvedValueOnce([{ id: "22222222-2222-4222-8222-222222222222", actor: "Марина", action: "revision_created", entity_type: "cms_node", target: "Главная", created_at: new Date("2026-09-01T09:00:00Z"), status: "draft" }])
    const service = new CmsDashboardService({ query } as never)

    const result = await service.get(actor)

    expect(result).toMatchObject({ productionRelease: "REL-7", drafts: 2, queueHealthy: true, funnel: { visitors: 0, leads: 12, bookings: 5, paid: 3 } })
    expect(result.metrics).toHaveLength(4)
    expect(result.activity[0]).toMatchObject({ actor: "Марина", action: "создал версию", target: "Главная" })
    expect(result.attention).toEqual(expect.arrayContaining([expect.objectContaining({ title: "Сбор веб-аналитики не настроен" })]))
    expect(query).toHaveBeenCalledTimes(2)
  })

  it("fails before touching persistence without canViewContent", async () => {
    const query = vi.fn()
    const service = new CmsDashboardService({ query } as never)
    await expect(service.get({ ...actor, capabilities: { ...actor.capabilities, canViewContent: false } })).rejects.toMatchObject({ response: { code: "PERMISSION_DENIED" } })
    expect(query).not.toHaveBeenCalled()
  })
})
