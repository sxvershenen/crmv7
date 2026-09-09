import { describe, expect, it } from "vitest"

import { decodeEventServiceRegistryCursor, encodeEventServiceRegistryCursor, EventServiceApplicationService } from "./event-service-application.service.js"
import { OfferingEditorApplicationService } from "./offering-editor-application.service.js"

describe("event-service application guards", () => {
  it("round-trips a millisecond cursor with an id tie-breaker and rejects malformed cursors", () => {
    const cursor = encodeEventServiceRegistryCursor({ updatedAt: "2026-09-09T14:02:45.123Z", id: "11111111-1111-4111-8111-111111111111" })
    expect(decodeEventServiceRegistryCursor(cursor)).toEqual({ updatedAt: new Date("2026-09-09T14:02:45.123Z"), id: "11111111-1111-4111-8111-111111111111" })
    expect(() => decodeEventServiceRegistryCursor("not-a-cursor")).toThrow(/\u041a\u0443\u0440\u0441\u043e\u0440/)
  })

  it("requires operational and content capabilities on the admin surface", () => {
    const service = new EventServiceApplicationService({} as never)
    expect(() => (service as unknown as { assertCreate(value: unknown): void }).assertCreate({ actor: { capabilities: { canCreate: true, canEdit: true, canEditContent: false } }, requestId: "r", entrySurface: "admin" })).toThrow(/Недостаточно прав/)
    expect(() => (service as unknown as { assertCreate(value: unknown): void }).assertCreate({ actor: { capabilities: { canCreate: true, canEdit: true, canEditContent: true } }, requestId: "r", entrySurface: "admin" })).not.toThrow()
  })

  it("maps a concurrent template-code uniqueness race to a typed conflict", async () => {
    const duplicate = Object.assign(new Error("duplicate"), { driverError: { code: "23505", constraint: "event_service_templates_code_unique" } })
    const service = new EventServiceApplicationService({ transaction: async () => { throw duplicate } } as never)
    await expect((service as unknown as { serializable(operation: () => Promise<never>): Promise<never> }).serializable(async () => { throw new Error("unused") })).rejects.toMatchObject({
      response: expect.objectContaining({ code: "EVENT_SERVICE_TEMPLATE_CODE_CONFLICT" }),
    })
  })

  it("resolves event templates only through an exact primary event binding", async () => {
    const service = new EventServiceApplicationService({} as never)
    const clauses: string[] = []
    const builder = {
      innerJoin: () => builder,
      where: (value: string) => { clauses.push(value); return builder },
      andWhere: (value: string) => { clauses.push(value); return builder },
      orderBy: () => builder,
      getMany: async () => [],
    }
    await (service as unknown as { findExactOfferings(manager: unknown, id: string, lock: boolean): Promise<unknown[]> }).findExactOfferings({ createQueryBuilder: () => builder }, "template-id", false)
    expect(clauses.join(" ")).toContain("binding.event_service_template_id = :templateId")
    expect(clauses.join(" ")).toContain("binding.role = 'primary'")
  })

  it("allows only flat guest packages through the shared price-book commands", async () => {
    const editor = new OfferingEditorApplicationService({} as never)
    const offering = { id: "offering", kind: "event_service" }
    const plan = { key: "standard", label: "Standard", pricingBasis: "flat_package", quantityMetric: "guests", baseAmount: 50000, includedQuantity: 20, baseExtraUnitAmount: 2000, minQuantity: null, maxQuantity: null, minDurationMinutes: null, maxDurationMinutes: null, isDefault: true, displayOrder: 0, rules: [] }
    await expect((editor as unknown as { validateDraftStructure(manager: unknown, offering: unknown, plans: unknown[]): Promise<void> }).validateDraftStructure({}, offering, [plan])).resolves.toBeUndefined()
    await expect((editor as unknown as { validateDraftStructure(manager: unknown, offering: unknown, plans: unknown[]): Promise<void> }).validateDraftStructure({}, offering, [{ ...plan, pricingBasis: "per_hour" }])).rejects.toThrow(/flat_package/)
    await expect((editor as unknown as { validateDraftStructure(manager: unknown, offering: unknown, plans: unknown[]): Promise<void> }).validateDraftStructure({}, offering, [{ ...plan, includedQuantity: null }])).rejects.toThrow(/includedQuantity/)
  })
})
