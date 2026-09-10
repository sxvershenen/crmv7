import type {
  ProgramRegistration,
  ProgramRegistrationAddOnSelection,
  ProgramRegistrationEditorRecord,
  ProgramRegistrationQuote,
  ProgramRegistrationStatus,
  ProgramRun,
  ProgramRunEditorRecord,
  ProgramRunResourceOption,
  ProgramRunStatus,
  ProgramsDataset,
  ProgramQuery,
  ProgramTemplate,
  ProgramTemplateEditorRecord,
  ProgramCategory,
  ProgramCategoryEditorRecord,
} from "@app/entities/programs"
import { bookingResourcesFixture } from "@app/fixtures/bookings"
import { programCategoriesFixture, programRegistrationsFixture, programRunsFixture, programTemplatesFixture } from "@app/fixtures/programs"
import type {
  InternalOfferingEditor,
  ProgramOfferingPrepareResult,
  ProgramOfferingQuoteResult,
} from "@crm/contracts"
import type {
  ProgramCategoryEditorRepository,
  ProgramOfferingResolution,
  ProgramPriceBookDraftInput,
  ProgramQuotePreviewInput,
  ProgramRegistrationEditorRepository,
  ProgramRunEditorRepository,
  ProgramsRepository,
  ProgramTemplateEditorRepository,
} from "./programs-repository-model.js"
import {
  createEmptyProgramRegistration,
  fixturePriceBook,
  selectPrograms,
  toListRegistration,
  toListRun,
  toListTemplate,
  toRegistrationEditorRecord,
  toRunEditorRecord,
  toRunEditorRegistration,
  toTemplateEditorRecord,
} from "./programs-repository-model.js"

const demoAssignee = { id: "demo-manager", initials: "МК", name: "Марина Кириллова", colorClass: "bg-sky-100 text-sky-700" }

export class FixtureProgramsRepository implements ProgramsRepository, ProgramTemplateEditorRepository, ProgramRunEditorRepository, ProgramRegistrationEditorRepository, ProgramCategoryEditorRepository {
  private data: ProgramsDataset = {
    categories: structuredClone(programCategoriesFixture),
    templates: structuredClone(programTemplatesFixture),
    runs: structuredClone(programRunsFixture),
    registrations: structuredClone(programRegistrationsFixture),
  }
  private templateEditorData = new Map<string, ProgramTemplateEditorRecord>()
  private runEditorData = new Map<string, ProgramRunEditorRecord>()
  private registrationEditorData = new Map<string, ProgramRegistrationEditorRecord>()
  private categoryEditorData = new Map<string, ProgramCategoryEditorRecord>()
  private programOfferings = new Map<string, Extract<ProgramOfferingResolution, { resolution: "linked" }>>()

  async list(query: ProgramQuery): Promise<ProgramsDataset> {
    return Promise.resolve(selectPrograms(structuredClone(this.data), query))
  }

  async assignTemplate(id: string): Promise<ProgramTemplate> {
    const template = this.data.templates.find((item) => item.id === id)
    if (!template) throw new Error("Шаблон не найден")
    template.assignees = [demoAssignee]
    return Promise.resolve(structuredClone(template))
  }

  async assignRun(id: string): Promise<ProgramRun> {
    const run = this.data.runs.find((item) => item.id === id)
    if (!run) throw new Error("Проведение не найдено")
    run.assignees = [demoAssignee]
    return Promise.resolve(structuredClone(run))
  }

  async assignRegistration(id: string): Promise<ProgramRegistration> {
    const registration = this.data.registrations.find((item) => item.id === id)
    if (!registration) throw new Error("Регистрация не найдена")
    registration.assignees = [demoAssignee]
    return Promise.resolve(structuredClone(registration))
  }

  async updateRunStatus(id: string, status: ProgramRunStatus): Promise<ProgramRun> {
    const run = this.data.runs.find((item) => item.id === id)
    if (!run) throw new Error("Проведение не найдено")
    run.status = status
    return Promise.resolve(structuredClone(run))
  }

  async updateRegistrationStatus(id: string, status: ProgramRegistrationStatus): Promise<ProgramRegistration> {
    const registration = this.data.registrations.find((item) => item.id === id)
    if (!registration) throw new Error("Регистрация не найдена")
    registration.status = status
    return Promise.resolve(structuredClone(registration))
  }

  async getTemplate(id: string): Promise<ProgramTemplateEditorRecord | null> {
    const cached = this.templateEditorData.get(id)
    if (cached) return Promise.resolve(structuredClone(cached))
    const template = this.data.templates.find((item) => item.id === id)
    if (!template) return Promise.resolve(null)
    const editor = toTemplateEditorRecord(template, this.data.runs.filter((run) => run.templateId === id))
    this.templateEditorData.set(id, editor)
    return Promise.resolve(structuredClone(editor))
  }

  async listCategories(): Promise<ProgramCategory[]> {
    return Promise.resolve(structuredClone(this.data.categories))
  }

  async saveTemplate(template: ProgramTemplateEditorRecord): Promise<ProgramTemplateEditorRecord> {
    const next = structuredClone(template)
    this.templateEditorData.set(next.id, next)
    const flat = toListTemplate(next)
    const index = this.data.templates.findIndex((item) => item.id === next.id)
    if (index >= 0) this.data.templates[index] = flat
    else this.data.templates.unshift(flat)
    return Promise.resolve(structuredClone(next))
  }

  async resolveProgramOffering(programTemplateId: string): Promise<ProgramOfferingResolution> {
    return structuredClone(this.programOfferings.get(programTemplateId) ?? { resolution: "unprepared" as const })
  }

  async prepareProgramOffering(programTemplateId: string, expectedProgramTemplateVersion: number): Promise<ProgramOfferingPrepareResult> {
    const template = await this.getTemplate(programTemplateId)
    if (!template) throw new Error("Шаблон программы не найден")
    if (template.version !== expectedProgramTemplateVersion) throw new Error("Шаблон программы был изменён")
    const offeringId = crypto.randomUUID()
    const now = new Date().toISOString()
    const nodeId = crypto.randomUUID()
    const revisionId = crypto.randomUUID()
    const editor = {
      offering: {
        id: offeringId, code: `PROGRAM-${programTemplateId}`, version: 1, kind: "program", state: "draft",
        operationalName: template.name, internalComment: "", salesMode: "quoted", priceDisplayMode: "from", currency: "RUB",
        timezone: "Europe/Moscow", taxMode: "tax_included", businessCalendarId: crypto.randomUUID(), fulfillment: { kind: "program" },
        activePriceBookId: null, archivedAt: null, createdAt: now, updatedAt: now,
      },
      addOnTerms: null,
      addOnUsages: [],
      bindings: [],
      bindingTargets: [],
      priceBooks: [],
      addOnAssignments: [],
      addOnCatalog: [],
      editorial: {
        source: { sourceKind: "catalog_offering", sourceId: offeringId, sourceVersion: 1, createdAt: now },
        node: { id: nodeId, version: 1, kind: "program_detail", status: "active" },
        currentRevision: { id: revisionId, revision: 1, state: "draft", path: `/programs/${programTemplateId}`, title: template.name, contentHash: "a".repeat(64) },
        latestPublished: null,
        publication: { eligible: false, blockers: ["offering_not_active", "safe_public_projection_missing"] },
      },
      ownerVersions: { catalog: 1, subject: { aggregateVersion: 1, primary: { type: "program_template", id: programTemplateId, version: template.version } }, pricing: 1, draftPriceBook: null, addOnAssignments: 1, editorial: { nodeId, nodeVersion: 1, draftRevisionId: revisionId, contentHash: "a".repeat(64) } },
      capabilities: {
        catalog: { canEdit: false, canChangeState: false, canArchive: false }, subject: { canEdit: true, canManageBindings: true },
        pricing: { canView: true, canEditDraft: true, canActivate: true }, addOns: { canSearch: true, canCreate: true, canAssign: true },
        editorial: { canEdit: true, canReview: true, canPublish: true }, canPreviewQuote: false,
      },
    } as InternalOfferingEditor
    this.programOfferings.set(programTemplateId, { resolution: "linked", editor, cmsReady: true, publicReady: false })
    return { offeringId, offeringVersion: 1, subjectVersion: 1, pricingVersion: 1, addOnAssignmentsVersion: 1, programTemplateId, programTemplateVersion: template.version, cmsReady: true, publicReady: false, editorialNodeId: nodeId }
  }

  async createProgramPriceBook(offeringId: string, expectedPricingVersion: number, input: ProgramPriceBookDraftInput) {
    const linked = this.fixtureOfferingById(offeringId)
    if (linked.editor.ownerVersions.pricing !== expectedPricingVersion) throw new Error("Цены были изменены")
    const priceBook = fixturePriceBook(offeringId, input, "draft")
    linked.editor.priceBooks = [priceBook, ...linked.editor.priceBooks]
    linked.editor.ownerVersions.pricing += 1
    linked.editor.ownerVersions.draftPriceBook = { id: priceBook.id, version: priceBook.version }
    return structuredClone({ priceBook, pricingVersion: linked.editor.ownerVersions.pricing })
  }

  async replaceProgramPriceBook(offeringId: string, priceBookId: string, expectedPricingVersion: number, input: ProgramPriceBookDraftInput) {
    const linked = this.fixtureOfferingById(offeringId)
    if (linked.editor.ownerVersions.pricing !== expectedPricingVersion) throw new Error("Цены были изменены")
    const current = linked.editor.priceBooks.find((item) => item.id === priceBookId && item.state === "draft")
    if (!current) throw new Error("Черновик прайс-листа не найден")
    const priceBook = { ...fixturePriceBook(offeringId, input, "draft"), id: current.id, version: current.version + 1, revision: current.revision }
    linked.editor.priceBooks = linked.editor.priceBooks.map((item) => item.id === priceBookId ? priceBook : item)
    linked.editor.ownerVersions.pricing += 1
    linked.editor.ownerVersions.draftPriceBook = { id: priceBook.id, version: priceBook.version }
    return structuredClone({ priceBook, pricingVersion: linked.editor.ownerVersions.pricing })
  }

  async activateProgramPriceBook(offeringId: string, priceBookId: string, expectedPricingVersion: number) {
    const linked = this.fixtureOfferingById(offeringId)
    if (linked.editor.ownerVersions.pricing !== expectedPricingVersion) throw new Error("Цены были изменены")
    const current = linked.editor.priceBooks.find((item) => item.id === priceBookId && item.state === "draft")
    if (!current) throw new Error("Черновик прайс-листа не найден")
    const activatedAt = new Date().toISOString()
    const priceBook = { ...current, state: "active" as const, version: current.version + 1, activatedAt, updatedAt: activatedAt }
    linked.editor.priceBooks = linked.editor.priceBooks.map((item) => item.id === priceBookId ? priceBook : { ...item, state: item.state === "active" ? "retired" as const : item.state })
    linked.editor.offering = { ...linked.editor.offering, state: "active", activePriceBookId: priceBook.id }
    linked.editor.ownerVersions.pricing += 1
    linked.editor.ownerVersions.draftPriceBook = null
    linked.editor.capabilities.canPreviewQuote = true
    return structuredClone({ priceBook, pricingVersion: linked.editor.ownerVersions.pricing })
  }

  async previewProgramQuote(programTemplateId: string, input: ProgramQuotePreviewInput): Promise<ProgramOfferingQuoteResult> {
    const linked = this.programOfferings.get(programTemplateId)
    const book = linked?.editor.priceBooks.find((item) => item.state === "active")
    const plan = book?.ratePlans.find((item) => item.key === input.ratePlanKey) ?? book?.ratePlans.find((item) => item.isDefault) ?? book?.ratePlans[0]
    if (!linked || !book || !plan) throw new Error("Для программы нет активного тарифа")
    const perPerson = plan.pricingBasis === "per_person"
    const included = plan.includedQuantity ?? 0
    const extra = perPerson ? 0 : Math.max(0, input.participants - included)
    const baseQuantity = perPerson ? input.participants : 1
    const baseAmount = plan.baseAmount * baseQuantity
    const extraAmount = extra * (plan.baseExtraUnitAmount ?? 0)
    const calculatedAt = new Date()
    return {
      quoteType: "template_preview", acceptanceReady: false, quoteId: crypto.randomUUID(), offeringId: linked.editor.offering.id,
      programTemplateId, calculatedAt: calculatedAt.toISOString(), validUntil: new Date(calculatedAt.getTime() + 900_000).toISOString(), leadDays: 0,
      currency: "RUB", inputs: { serviceDate: input.serviceDate, participants: input.participants, durationMinutes: 60 },
      lines: [
        { kind: "base", label: perPerson ? "Участники" : "Пакет", serviceDate: input.serviceDate, quantity: baseQuantity, unitAmount: { amountMinor: plan.baseAmount, currency: "RUB" }, amount: { amountMinor: baseAmount, currency: "RUB" }, ratePlanId: plan.id, ratePlanVersion: plan.version, matchedRuleId: null, matchedRuleVersion: null, explanation: "base" },
        ...(extra > 0 ? [{ kind: "extra_unit" as const, label: "Дополнительные участники", serviceDate: input.serviceDate, quantity: extra, unitAmount: { amountMinor: plan.baseExtraUnitAmount ?? 0, currency: "RUB" as const }, amount: { amountMinor: extraAmount, currency: "RUB" as const }, ratePlanId: plan.id, ratePlanVersion: plan.version, matchedRuleId: null, matchedRuleVersion: null, explanation: "base" }] : []),
      ],
      total: { amountMinor: baseAmount + extraAmount, currency: "RUB" },
      provenance: { offeringVersion: linked.editor.offering.version, subjectVersion: linked.editor.ownerVersions.subject.aggregateVersion, programTemplateVersion: linked.editor.ownerVersions.subject.primary?.version ?? 1, pricingVersion: linked.editor.ownerVersions.pricing, addOnsVersion: linked.editor.ownerVersions.addOnAssignments, priceBookId: book.id, priceBookVersion: book.version, businessCalendarId: linked.editor.offering.businessCalendarId, businessCalendarVersion: 1, businessCalendarSourceVersion: "fixture", matchedRuleIds: [] },
      immutableSnapshot: true,
    }
  }

  private fixtureOfferingById(offeringId: string) {
    const linked = [...this.programOfferings.values()].find((item) => item.editor.offering.id === offeringId)
    if (!linked) throw new Error("Коммерческое предложение не найдено")
    return linked
  }

  async getCategory(id: string): Promise<ProgramCategoryEditorRecord | null> {
    const cached = this.categoryEditorData.get(id)
    if (cached) return Promise.resolve(structuredClone(cached))
    const category = this.data.categories.find((item) => item.id === id)
    if (!category) return Promise.resolve(null)
    const editor = { ...structuredClone(category), relatedTemplates: structuredClone(this.data.templates.filter((template) => template.categoryId === id)) }
    this.categoryEditorData.set(id, editor)
    return Promise.resolve(structuredClone(editor))
  }

  async saveCategory(category: ProgramCategoryEditorRecord): Promise<ProgramCategoryEditorRecord> {
    const next = structuredClone(category)
    next.templateCount = next.relatedTemplates.length
    this.categoryEditorData.set(next.id, next)
    const flat: ProgramCategory = { id: next.id, name: next.name, description: next.description, icon: next.icon, tone: next.tone, templateCount: next.templateCount }
    const index = this.data.categories.findIndex((item) => item.id === next.id)
    if (index >= 0) this.data.categories[index] = flat
    else this.data.categories.unshift(flat)
    this.data.templates = this.data.templates.map((template) => template.categoryId === next.id ? { ...template, categoryIcon: next.icon, categoryName: next.name, categoryTone: next.tone } : template)
    return Promise.resolve(structuredClone(next))
  }

  async getRun(id: string): Promise<ProgramRunEditorRecord | null> {
    const cached = this.runEditorData.get(id)
    if (cached) return Promise.resolve(structuredClone(cached))
    const run = this.data.runs.find((item) => item.id === id)
    if (!run) return Promise.resolve(null)
    const editor = toRunEditorRecord(run, this.data.registrations.filter((registration) => registration.runId === id))
    this.runEditorData.set(id, editor)
    return Promise.resolve(structuredClone(editor))
  }

  async listRunResources(): Promise<ProgramRunResourceOption[]> {
    return Promise.resolve(bookingResourcesFixture.map(({ capacity, category, id, name }) => ({ capacity, category, id, name, version: 1 })))
  }

  async listRunTemplates(): Promise<ProgramTemplate[]> {
    return Promise.resolve(structuredClone(this.data.templates))
  }

  async saveRun(run: ProgramRunEditorRecord): Promise<ProgramRunEditorRecord> {
    const next = structuredClone(run)
    this.runEditorData.set(next.id, next)
    const flat = toListRun(next)
    const index = this.data.runs.findIndex((item) => item.id === next.id)
    if (index >= 0) this.data.runs[index] = flat
    else this.data.runs.unshift(flat)
    this.data.registrations = [
      ...this.data.registrations.filter((registration) => registration.runId !== next.id),
      ...next.registrations.map(toListRegistration),
    ]
    return Promise.resolve(structuredClone(next))
  }

  async getRegistration(id: string): Promise<ProgramRegistrationEditorRecord | null> {
    const cached = this.registrationEditorData.get(id)
    if (cached) return Promise.resolve(structuredClone(cached))
    const registration = this.data.registrations.find((item) => item.id === id)
    if (!registration) return Promise.resolve(null)
    const run = this.data.runs.find((item) => item.id === registration.runId) ?? null
    const runDetail = this.runEditorData.get(registration.runId)?.registrations.find((item) => item.id === id)
    const editor = toRegistrationEditorRecord(runDetail ?? toRunEditorRegistration(registration), run)
    if (id === "5009") {
      editor.pricingMode = "quote_required"
      editor.availableAddOns = [{ assignmentId: "fixture-breakfast", label: "Завтрак", serviceType: "person_service", required: false, minQuantity: 1, maxQuantity: 20, defaultQuantity: 1 }]
    }
    this.registrationEditorData.set(id, editor)
    return Promise.resolve(structuredClone(editor))
  }

  async createRegistrationDraft(run?: ProgramRun) {
    return Promise.resolve(createEmptyProgramRegistration(run))
  }

  async listRegistrationRuns(): Promise<ProgramRun[]> {
    return Promise.resolve(structuredClone(this.data.runs))
  }

  async saveRegistration(registration: ProgramRegistrationEditorRecord): Promise<ProgramRegistrationEditorRecord> {
    const next = structuredClone(registration)
    const previousCompact = this.data.registrations.find((item) => item.id === next.id)
    const previousEditor = this.registrationEditorData.get(next.id)
    this.registrationEditorData.set(next.id, next)
    const flat = toListRegistration(next)
    const index = this.data.registrations.findIndex((item) => item.id === next.id)
    if (index >= 0) this.data.registrations[index] = flat
    else this.data.registrations.unshift(flat)
    const cachedRun = this.runEditorData.get(next.runId)
    if (cachedRun) {
      const registrationIndex = cachedRun.registrations.findIndex((item) => item.id === next.id)
      if (registrationIndex >= 0) cachedRun.registrations[registrationIndex] = toRunEditorRegistration(flat, next)
      else cachedRun.registrations.unshift(toRunEditorRegistration(flat, next))
    }
    const run = this.data.runs.find((item) => item.id === next.runId)
    if (run) {
      run.paid = Math.max(0, run.paid - Math.max(0, (previousCompact?.total ?? 0) - (previousCompact?.debt ?? 0)) + next.paid)
      run.revenue = Math.max(0, run.revenue - (previousCompact?.total ?? 0) + next.total)
      run.participantCount = Math.max(0, run.participantCount - (previousEditor?.participantCount ?? 0) + (next.participantCount ?? 0))
      if (!previousCompact) run.registrationCount += 1
    }
    return Promise.resolve(structuredClone(next))
  }


  async quoteRegistration(registration: ProgramRegistrationEditorRecord, addOns: ProgramRegistrationAddOnSelection[]): Promise<ProgramRegistrationQuote> {
    const total = Math.max(0, (registration.participantCount ?? 1) * 2500 + addOns.reduce((sum, item) => sum + item.quantity * 500, 0))
    return Promise.resolve({
      quoteId: `fixture-quote-${registration.runId}`,
      occurrenceId: registration.runId,
      occurrenceVersion: registration.occurrenceVersion ?? 1,
      calculatedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 15 * 60_000).toISOString(),
      participants: Math.max(1, registration.participantCount ?? 1),
      total,
      currency: registration.currency,
      addOns: structuredClone(addOns),
      lines: [{ kind: "base", label: "Участники", quantity: Math.max(1, registration.participantCount ?? 1), amount: total }],
    })
  }

  async confirmRegistration(registration: ProgramRegistrationEditorRecord, quote: ProgramRegistrationQuote): Promise<ProgramRegistrationEditorRecord> {
    const next = {
      ...structuredClone(registration),
      version: registration.version + 1,
      status: "confirmed" as const,
      total: quote.total,
      debt: Math.max(0, quote.total - registration.paid),
      acceptedQuote: { quoteId: quote.quoteId, acceptedAt: new Date().toISOString(), total: quote.total, currency: quote.currency, addOns: structuredClone(quote.addOns), lines: structuredClone(quote.lines) },
    }
    this.registrationEditorData.set(next.id, next)
    return Promise.resolve(structuredClone(next))
  }
}
