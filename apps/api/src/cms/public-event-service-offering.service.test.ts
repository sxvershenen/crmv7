import { describe, expect, it, vi } from "vitest"

import { createPublicEventServiceProjectionDependency } from "../offerings/public-event-service-projection.js"
import { PublicEventServiceOfferingService } from "./public-event-service-offering.service.js"
import { resolvedContentHash } from "./public-content.service.js"

const offeringId = "11111111-1111-4111-8111-111111111111"
const nodeId = "22222222-2222-4222-8222-222222222222"
const revisionId = "33333333-3333-4333-8333-333333333333"
const releaseId = "44444444-4444-4444-8444-444444444444"
const dependency = createPublicEventServiceProjectionDependency({ offeringId, nodeId, profileRevisionId: revisionId })
const content = { kind: "event_detail", path: "/events/corporate", title: "Корпоративное мероприятие", summary: "Сценарий для команды", hero: null, sections: [], seo: { title: "Корпоративное мероприятие", description: "Событие", indexPolicy: "index_follow", canonical: { mode: "self" }, structuredData: [] } }

function row(overrides: Record<string, unknown> = {}) {
  return {
    releaseId,
    releaseCreatedAt: new Date("2026-09-02T08:00:00.000Z"),
    releasePublishedAt: new Date("2026-09-02T08:05:00.000Z"),
    nodeId,
    revisionId,
    resolvedContent: content,
    resolvedContentHash: resolvedContentHash(content),
    dependencies: [{ type: "node_revision", id: revisionId, version: "2", contentHash: "a".repeat(64) }, dependency],
    offeringId,
    offeringVersion: 3,
    offeringUpdatedAt: new Date("2026-09-02T08:10:00.000Z"),
    pricingVersion: 4,
    currency: "RUB",
    timezone: "Europe/Moscow",
    calendarVersion: 2,
    calendarUpdatedAt: new Date("2026-09-01T08:00:00.000Z"),
    templateId: "55555555-5555-4555-8555-555555555555",
    templateVersion: 2,
    templateUpdatedAt: new Date("2026-09-02T08:08:00.000Z"),
    format: "corporate",
    durationMinutes: 360,
    minimumGuests: 10,
    maximumGuests: 80,
    titleKey: "корпоративное мероприятие",
    ...overrides,
  }
}

function subject(projectionRows = [row()]) {
  const query = vi.fn()
    .mockResolvedValueOnce(projectionRows)
    .mockResolvedValue([{ id: releaseId, asOf: new Date("2026-09-02T08:05:00.000Z") }])
  return { service: new PublicEventServiceOfferingService({ query } as never), query }
}

describe("PublicEventServiceOfferingService", () => {
  it("serves a release-pinned request-only event category", async () => {
    const result = await subject().service.detail(offeringId)
    expect(result.data).toMatchObject({ kind: "event_service", format: "corporate", price: { mode: "request" }, quoteAvailable: false, readiness: "request_only", fulfillment: { durationMinutes: 360, minimumGuests: 10, maximumGuests: 80, availabilityMode: "request_only" } })
    expect(result.cacheTags).toContain("public-offering-kind:event-service")
  })

  it("fails closed when the release projection dependency is stale", async () => {
    await expect(subject([row({ dependencies: [] })]).service.detail(offeringId)).rejects.toMatchObject({ response: { code: "PUBLIC_PROJECTION_INVALID" } })
  })

  it("fails closed for malformed editorial content and never reads customer Event data", async () => {
    const { service, query } = subject([row({ resolvedContent: { ...content, privateCustomerPhone: "+79990000000" } })])
    await expect(service.detail(offeringId)).rejects.toMatchObject({ response: { code: "PUBLIC_PROJECTION_INVALID" } })
    expect(query.mock.calls[0]?.[0]).toContain("event_service_templates")
    expect(query.mock.calls[0]?.[0]).not.toContain("FROM events")
  })
})
