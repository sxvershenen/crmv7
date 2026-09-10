import { describe, expect, it } from "vitest"

import { PublicProgramFulfillmentSchema, PublicProgramProjectionPinSchema, PublicProgramSummarySchema } from "@crm/contracts"

const ids = {
  offering: "11111111-1111-4111-8111-111111111111",
  node: "22222222-2222-4222-8222-222222222222",
  revision: "33333333-3333-4333-8333-333333333333",
  release: "44444444-4444-4444-8444-444444444444",
}

const occurrence = {
  startsAt: "2026-09-20T10:00:00.000Z",
  endsAt: "2026-09-20T13:00:00.000Z",
  participantLimit: 20,
  registrationLimit: 10,
}

function program(overrides: Record<string, unknown> = {}) {
  return {
    offeringId: ids.offering,
    kind: "program",
    path: "/programs/rafting",
    releaseId: ids.release,
    title: "Рафтинг",
    summary: "Программа на воде",
    price: { mode: "from", amount: { amountMinor: 250000, currency: "RUB" } },
    priceBasisLabel: "за участника",
    quoteAvailable: false,
    requestAvailable: true,
    capacity: null,
    readiness: "ready",
    timezone: "Europe/Moscow",
    currency: "RUB",
    sourceVersions: { offering: 3, pricing: 4, priceBook: 2, calendar: 2, contentReleaseId: ids.release, profileRevisionId: ids.revision },
    asOf: "2026-09-10T10:00:00.000Z",
    fulfillment: { durationMinutes: 180, minimumParticipants: 2, participantLimit: 20, availabilityMode: "occurrence", nextOccurrence: occurrence },
    ...overrides,
  }
}

describe("public program contract", () => {
  it("accepts a release-pinned program with the next open occurrence", () => {
    expect(PublicProgramSummarySchema.parse(program())).toMatchObject({ kind: "program", path: "/programs/rafting", fulfillment: { durationMinutes: 180, nextOccurrence: occurrence } })
  })

  it("allows request-only delivery without a price or occurrence", () => {
    const value = PublicProgramSummarySchema.parse(program({ price: { mode: "request" }, priceBasisLabel: null, readiness: "request_only", fulfillment: { durationMinutes: 180, minimumParticipants: 2, participantLimit: 20, availabilityMode: "request_only", nextOccurrence: null } }))
    expect(value.price).toEqual({ mode: "request" })
    expect(value.fulfillment.nextOccurrence).toBeNull()
  })

  it("rejects an occurrence mode without an occurrence", () => {
    expect(PublicProgramFulfillmentSchema.safeParse({ durationMinutes: 180, minimumParticipants: 2, participantLimit: 20, availabilityMode: "occurrence", nextOccurrence: null }).success).toBe(false)
  })

  it("keeps the projection pin explicit and versioned", () => {
    expect(PublicProgramProjectionPinSchema.parse({ contract: "public.program-summary.v1", kind: "program", offeringId: ids.offering, nodeId: ids.node, profileRevisionId: ids.revision })).toMatchObject({ contract: "public.program-summary.v1", kind: "program" })
  })
})
