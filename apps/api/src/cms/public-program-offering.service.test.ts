import { describe, expect, it, vi } from "vitest"

import { PriceRuleEntity, RatePlanEntity } from "@crm/db"

import { createPublicProgramProjectionDependency } from "../offerings/public-program-projection.js"
import { PublicProgramOfferingService } from "./public-program-offering.service.js"
import { resolvedContentHash } from "./public-content.service.js"

const offeringId = "11111111-1111-4111-8111-111111111111"
const nodeId = "22222222-2222-4222-8222-222222222222"
const revisionId = "33333333-3333-4333-8333-333333333333"
const releaseId = "44444444-4444-4444-8444-444444444444"
const priceBookId = "55555555-5555-4555-8555-555555555555"
const ratePlanId = "66666666-6666-4666-8666-666666666666"
const content = { kind: "program_detail", path: "/programs/rafting", title: "Рафтинг", summary: "Программа на воде", hero: null, sections: [], seo: { title: "Рафтинг", description: "Программа", indexPolicy: "index_follow", canonical: { mode: "self" }, structuredData: [] } }
const dependency = createPublicProgramProjectionDependency({ offeringId, nodeId, profileRevisionId: revisionId })

function row(overrides: Record<string, unknown> = {}) {
  return { releaseId, releaseCreatedAt: new Date("2026-09-02T08:00:00.000Z"), releasePublishedAt: new Date("2026-09-02T08:05:00.000Z"), nodeId, revisionId, resolvedContent: content, resolvedContentHash: resolvedContentHash(content), dependencies: [{ type: "node_revision", id: revisionId, version: "2", contentHash: "a".repeat(64) }, dependency], offeringId, offeringVersion: 3, offeringUpdatedAt: new Date("2026-09-02T08:10:00.000Z"), pricingVersion: 4, salesMode: "selectable", priceDisplayMode: "from", currency: "RUB", timezone: "Europe/Moscow", calendarVersion: 2, calendarUpdatedAt: new Date("2026-09-01T08:00:00.000Z"), priceBookId, priceBookRevision: 2, priceBookState: "active", priceBookValidFrom: "2026-01-01", priceBookValidToExclusive: "2027-01-01", priceBookUpdatedAt: new Date("2026-09-02T08:09:00.000Z"), templateId: "77777777-7777-4777-8777-777777777777", templateVersion: 2, templateUpdatedAt: new Date("2026-09-02T08:08:00.000Z"), durationMinutes: 180, minimumParticipants: 2, participantLimit: 20, nextOccurrenceStartsAt: new Date("2026-09-20T10:00:00.000Z"), nextOccurrenceEndsAt: new Date("2026-09-20T13:00:00.000Z"), nextOccurrenceParticipantLimit: 20, nextOccurrenceRegistrationLimit: 10, titleKey: "рафтинг", ...overrides }
}

function subject(projectionRows = [row()]) {
  const query = vi.fn().mockResolvedValue(projectionRows)
  const repositories = new Map<unknown, { findBy: ReturnType<typeof vi.fn> }>([
    [RatePlanEntity, { findBy: vi.fn().mockResolvedValue([{ id: ratePlanId, priceBookId, pricingBasis: "per_person", baseAmountMinor: 250000 }]) }],
    [PriceRuleEntity, { findBy: vi.fn().mockResolvedValue([]) }],
  ])
  return { service: new PublicProgramOfferingService({ query, getRepository: vi.fn((entity) => repositories.get(entity)) } as never), query }
}

describe("PublicProgramOfferingService", () => {
  it("serves a release-pinned program with the next open occurrence", async () => {
    const result = await subject().service.detail(offeringId)
    expect(result.data).toMatchObject({ kind: "program", price: { mode: "from" }, fulfillment: { durationMinutes: 180, availabilityMode: "occurrence", participantLimit: 20 }, capacity: null })
    expect(result.data.fulfillment.nextOccurrence?.startsAt).toBe("2026-09-20T10:00:00.000Z")
    expect(result.cacheTags).toContain("public-offering-kind:program")
  })

  it("keeps a program request-only when the price book or occurrence is absent", async () => {
    const result = await subject([row({ priceBookId: null, priceBookRevision: null, priceBookState: null, priceBookValidFrom: null, priceBookValidToExclusive: null, priceBookUpdatedAt: null, nextOccurrenceStartsAt: null, nextOccurrenceEndsAt: null, nextOccurrenceParticipantLimit: null, nextOccurrenceRegistrationLimit: null })]).service.detail(offeringId)
    expect(result.data).toMatchObject({ price: { mode: "request" }, readiness: "request_only", fulfillment: { availabilityMode: "request_only", nextOccurrence: null } })
  })

  it("fails closed when the release projection dependency is stale", async () => {
    await expect(subject([row({ dependencies: [] })]).service.detail(offeringId)).rejects.toMatchObject({ response: { code: "PUBLIC_PROJECTION_INVALID" } })
  })

  it("guards the public SQL against a second active primary binding", async () => {
    const { service, query } = subject()
    await service.detail(offeringId)
    expect(query.mock.calls[0]?.[0]).toContain("SELECT COUNT(*) FROM offering_bindings primary_binding")
    expect(query.mock.calls[0]?.[0]).toContain("primary_binding.archived_at IS NULL) = 1")
  })
})
