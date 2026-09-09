import { describe, expect, it } from "vitest"

import { ProgramOfferingApplicationService } from "./program-offering-application.service.js"
import { OfferingEditorApplicationService } from "./offering-editor-application.service.js"

describe("ProgramOfferingApplicationService guards", () => {
  const service = new ProgramOfferingApplicationService({} as never)

  it("keeps admin preparation behind operational and content capabilities", () => {
    expect(() => (service as unknown as { assertCreate(value: unknown): void }).assertCreate({ actor: { capabilities: { canCreate: true, canEdit: true, canEditContent: false } }, requestId: "r", entrySurface: "admin" })).toThrow(/Недостаточно прав/)
    expect(() => (service as unknown as { assertCreate(value: unknown): void }).assertCreate({ actor: { capabilities: { canCreate: true, canEdit: true, canEditContent: true } }, requestId: "r", entrySurface: "admin" })).not.toThrow()
  })

  it("uses the exact template id for primary offering resolution", async () => {
    const clauses: string[] = []
    const builder = { setLock: () => builder, innerJoin: () => builder, where: (value: string) => { clauses.push(value); return builder }, andWhere: (value: string) => { clauses.push(value); return builder }, orderBy: () => builder, getMany: async () => [] }
    await (service as unknown as { findExactOfferings(manager: unknown, id: string, lock: boolean): Promise<unknown[]> }).findExactOfferings({ createQueryBuilder: () => builder }, "template-id", true)
    expect(clauses.join(" ")).toContain("binding.program_template_id = :templateId")
    expect(clauses.join(" ")).toContain("binding.role = 'primary'")
  })

  it("returns an explicit unprepared recovery state without creating anything", async () => {
    const templateId = "11111111-1111-4111-8111-111111111111"
    const manager = { findOne: async () => ({ id: templateId, version: 4, archivedAt: null }) }
    const lookupService = new ProgramOfferingApplicationService({ transaction: async (_isolation: string, work: (value: unknown) => Promise<unknown>) => work(manager) } as never)
    ;(lookupService as unknown as { findExactOfferings(manager: unknown, id: string, lock: boolean): Promise<unknown[]> }).findExactOfferings = async () => []
    await expect(lookupService.lookup(templateId, { actor: { capabilities: { canView: true } }, requestId: "r", entrySurface: "internal" } as never)).resolves.toEqual({ resolution: "unprepared", programTemplateId: templateId, programTemplateVersion: 4 })
  })

  it("accepts only explicit participant-based program plans in the shared PriceBook", async () => {
    const editor = new OfferingEditorApplicationService({} as never)
    const base = { id: "offering", kind: "program" }
    const plan = { key: "standard", label: "Стандарт", pricingBasis: "per_person", quantityMetric: "participants", baseAmount: 1000, includedQuantity: null, baseExtraUnitAmount: null, minQuantity: 1, maxQuantity: 20, minDurationMinutes: 120, maxDurationMinutes: 120, isDefault: true, displayOrder: 0, rules: [] }
    await expect((editor as unknown as { validateDraftStructure(manager: unknown, offering: unknown, plans: unknown[]): Promise<void> }).validateDraftStructure({}, base, [plan])).resolves.toBeUndefined()
    await expect((editor as unknown as { validateDraftStructure(manager: unknown, offering: unknown, plans: unknown[]): Promise<void> }).validateDraftStructure({}, base, [{ ...plan, quantityMetric: "guests" }])).rejects.toThrow(/participants/)
  })
})
