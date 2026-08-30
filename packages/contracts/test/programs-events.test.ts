import { describe, expect, it } from "vitest"

import { EventCreateSchema, EventStatusSchema, ProgramOccurrenceStatusSchema, ProgramTemplateCreateSchema } from "../src/index.js"

const id = "11111111-1111-4111-8111-111111111111"
const operationId = "22222222-2222-4222-8222-222222222222"

describe("programs and events contracts", () => {
  it("requires operation metadata and preserves money fields for template creates", () => {
    const result = ProgramTemplateCreateSchema.safeParse({ name: "Рафтинг", durationMinutes: 120, participantLimit: 12, basePrice: { amountMinor: 350000, currency: "RUB" }, operationId, idempotencyKey: "program-template-create-0001" })
    expect(result.success).toBe(true)
    expect(ProgramTemplateCreateSchema.safeParse({ name: "Рафтинг", durationMinutes: 120, participantLimit: 12, basePrice: { amountMinor: 350000, currency: "RUB" } }).success).toBe(false)
  })

  it("keeps documented lifecycle enums canonical", () => {
    expect(ProgramOccurrenceStatusSchema.options).toEqual(["draft", "open", "closed", "completed", "cancelled"])
    expect(EventStatusSchema.options).toEqual(["inquiry", "planning", "booked", "completed", "cancelled"])
    expect(EventCreateSchema.safeParse({ name: "Корпоратив", startsAt: "2026-09-10T10:00:00.000Z", endsAt: "2026-09-10T18:00:00.000Z", guestCount: 40, total: { amountMinor: 100000, currency: "RUB" }, operationId, idempotencyKey: "event-create-0000001", customerId: id }).success).toBe(true)
  })
})
