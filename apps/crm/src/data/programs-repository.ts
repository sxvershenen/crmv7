import type {
  ProgramRegistration,
  ProgramRegistrationAddOnOption,
  ProgramRegistrationAddOnSelection,
  ProgramRegistrationEditorRecord,
  ProgramRegistrationQuote,
  ProgramRegistrationSortKey,
  ProgramRegistrationStatus,
  ProgramRun,
  ProgramRunEditorRecord,
  ProgramRunEditorRegistration,
  ProgramRunResourceOption,
  ProgramRunSortKey,
  ProgramRunStatus,
  ProgramsDataset,
  ProgramQuery,
  ProgramTemplate,
  ProgramCategory,
  ProgramCategoryEditorRecord,
  ProgramTemplateEditorRecord,
  ProgramTemplateSortKey,
} from "@app/entities/programs"
import { bookingResourcesFixture } from "@app/fixtures/bookings"
import { programCategoriesFixture, programRegistrationsFixture, programRunsFixture, programTemplatesFixture } from "@app/fixtures/programs"
import { ApiClientError, apiClient } from "@app/lib/api-client"
import { useFixtureData } from "@app/lib/data-mode"
import {
  HousePriceBookActivateBodySchema,
  HousePriceBookDraftCreateBodySchema,
  HousePriceBookDraftReplaceBodySchema,
  InternalOfferingEditorSchema,
  OfferingPricingMutationResultSchema,
  PaymentListResponseSchema,
  ProgramCategoryDetailSchema,
  ProgramCategorySchema,
  ProgramOccurrenceDtoSchema,
  ProgramOfferingPrepareBodySchema,
  ProgramOfferingLookupResultSchema,
  ProgramOfferingPrepareResultSchema,
  ProgramOfferingQuotePreviewBodySchema,
  ProgramOfferingQuoteResultSchema,
  ProgramRegistrationQuoteBodySchema,
  ProgramRegistrationQuoteResultSchema,
  ProgramRegistrationDtoSchema,
  ProgramTemplateDtoSchema,
  ResourceAllocationDtoSchema,
  ResourceDtoSchema,
  SessionUserSchema,
  type HousePriceBookDraftCreateBody,
  type InternalOfferingEditor,
  type OfferingPricingMutationResult,
  type ProgramOfferingPrepareResult,
  type ProgramOfferingQuoteResult,
} from "@crm/contracts"
import { z } from "zod"

export interface ProgramsRepository {
  list(query: ProgramQuery): Promise<ProgramsDataset>
  assignTemplate(id: string): Promise<ProgramTemplate>
  assignRun(id: string): Promise<ProgramRun>
  assignRegistration(id: string): Promise<ProgramRegistration>
  updateRunStatus(id: string, status: ProgramRunStatus): Promise<ProgramRun>
  updateRegistrationStatus(id: string, status: ProgramRegistrationStatus): Promise<ProgramRegistration>
}

export interface ProgramTemplateEditorRepository {
  getTemplate(id: string): Promise<ProgramTemplateEditorRecord | null>
  listCategories(): Promise<ProgramCategory[]>
  saveTemplate(template: ProgramTemplateEditorRecord): Promise<ProgramTemplateEditorRecord>
  resolveProgramOffering(programTemplateId: string): Promise<ProgramOfferingResolution>
  prepareProgramOffering(programTemplateId: string, expectedProgramTemplateVersion: number): Promise<ProgramOfferingPrepareResult>
  createProgramPriceBook(offeringId: string, expectedPricingVersion: number, input: ProgramPriceBookDraftInput): Promise<OfferingPricingMutationResult>
  replaceProgramPriceBook(offeringId: string, priceBookId: string, expectedPricingVersion: number, input: ProgramPriceBookDraftInput): Promise<OfferingPricingMutationResult>
  activateProgramPriceBook(offeringId: string, priceBookId: string, expectedPricingVersion: number): Promise<OfferingPricingMutationResult>
  previewProgramQuote(programTemplateId: string, input: ProgramQuotePreviewInput): Promise<ProgramOfferingQuoteResult>
}

export type ProgramOfferingResolution =
  | { resolution: "unprepared" }
  | { resolution: "linked"; editor: InternalOfferingEditor; cmsReady: boolean; publicReady: false }
  | { resolution: "ambiguous"; candidateOfferingIds: string[] }

export type ProgramPriceBookDraftInput = Omit<HousePriceBookDraftCreateBody, "operationId" | "idempotencyKey" | "expectedPricingVersion">
export type ProgramQuotePreviewInput = {
  serviceDate: string
  participants: number
  ratePlanKey: string | null
}

export interface ProgramRunEditorRepository {
  getRun(id: string): Promise<ProgramRunEditorRecord | null>
  listRunResources(): Promise<ProgramRunResourceOption[]>
  listRunTemplates(): Promise<ProgramTemplate[]>
  saveRun(run: ProgramRunEditorRecord): Promise<ProgramRunEditorRecord>
}

export interface ProgramRegistrationEditorRepository {
  createRegistrationDraft(run?: ProgramRun): Promise<ProgramRegistrationEditorRecord>
  getRegistration(id: string): Promise<ProgramRegistrationEditorRecord | null>
  listRegistrationRuns(): Promise<ProgramRun[]>
  saveRegistration(registration: ProgramRegistrationEditorRecord): Promise<ProgramRegistrationEditorRecord>
  quoteRegistration(registration: ProgramRegistrationEditorRecord, addOns: ProgramRegistrationAddOnSelection[]): Promise<ProgramRegistrationQuote>
  confirmRegistration(registration: ProgramRegistrationEditorRecord, quote: ProgramRegistrationQuote): Promise<ProgramRegistrationEditorRecord>
}

export interface ProgramCategoryEditorRepository {
  getCategory(id: string): Promise<ProgramCategoryEditorRecord | null>
  saveCategory(category: ProgramCategoryEditorRecord): Promise<ProgramCategoryEditorRecord>
}

export function createEmptyProgramCategory(): ProgramCategoryEditorRecord {
  return { id: "new", name: "Новая категория", description: "", icon: "campfire", tone: "amber", templateCount: 0, relatedTemplates: [] }
}

const collator = new Intl.Collator("ru-RU", { numeric: true, sensitivity: "base" })

const templateSortValue: Record<ProgramTemplateSortKey, (item: ProgramTemplate) => string | number> = {
  name: (item) => item.name,
  category: (item) => item.categoryName,
  duration: (item) => item.durationMinutes,
  limit: (item) => item.participantLimit,
  price: (item) => item.basePrice,
  publication: (item) => Number(item.published),
  nextRun: (item) => item.nextRun?.startsAt ?? "9999-12-31",
}

const runSortValue: Record<ProgramRunSortKey, (item: ProgramRun) => string | number> = {
  name: (item) => item.name,
  date: (item) => item.startsAt,
  participants: (item) => item.participantCount,
  registrations: (item) => item.registrationCount,
  status: (item) => item.status,
  revenue: (item) => item.revenue,
  paid: (item) => item.paid,
  assignee: (item) => item.assignees[0]?.name ?? "",
}

const registrationSortValue: Record<ProgramRegistrationSortKey, (item: ProgramRegistration) => string | number> = {
  program: (item) => item.programName,
  client: (item) => item.clientName,
  price: (item) => item.total,
  status: (item) => item.status,
  comment: (item) => item.comment,
  assignee: (item) => item.assignees[0]?.name ?? "",
}

function compare(a: string | number, b: string | number) {
  return typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b))
}

function sortBy<T>(items: T[], value: (item: T) => string | number, direction: ProgramQuery["sort"]["direction"]) {
  const sign = direction === "asc" ? 1 : -1
  return [...items].sort((left, right) => compare(value(left), value(right)) * sign)
}

export function selectPrograms(data: ProgramsDataset, query: ProgramQuery): ProgramsDataset {
  const templates = data.templates.filter((item) => query.category === "all" || item.categoryId === query.category)
  const runs = data.runs.filter((item) => {
    if (query.category !== "all" && item.categoryId !== query.category) return false
    if (query.status !== "all" && item.status !== query.status) return false
    const date = item.startsAt.slice(0, 10)
    return date >= query.date && date <= query.rangeEnd
  })
  const registrations = data.registrations.filter((item) => {
    if (query.status !== "all" && item.status !== query.status) return false
    if (query.category !== "all") {
      const run = data.runs.find((candidate) => candidate.id === item.runId)
      if (run?.categoryId !== query.category) return false
    }
    const date = item.programStartsAt.slice(0, 10)
    return date >= query.date && date <= query.rangeEnd
  })

  const templateSort = query.sort.key in templateSortValue ? query.sort.key as ProgramTemplateSortKey : "name"
  const runSort = query.sort.key in runSortValue ? query.sort.key as ProgramRunSortKey : "date"
  const registrationSort = query.sort.key in registrationSortValue ? query.sort.key as ProgramRegistrationSortKey : "program"
  return {
    categories: structuredClone(data.categories),
    templates: sortBy(templates, templateSortValue[templateSort], query.sort.direction),
    runs: sortBy(runs, runSortValue[runSort], query.sort.direction),
    registrations: sortBy(registrations, registrationSortValue[registrationSort], query.sort.direction),
  }
}

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

type ApiProgramsClient = Pick<typeof apiClient, "get" | "getWithMeta" | "patch" | "post" | "request">
type Page<T> = { items: T[]; nextCursor: string | null }

const templatePageSchema = z.object({ items: z.array(ProgramTemplateDtoSchema), nextCursor: z.string().nullable() }).strict()
const occurrencePageSchema = z.object({ items: z.array(ProgramOccurrenceDtoSchema), nextCursor: z.string().nullable() }).strict()
const registrationPageSchema = z.object({ items: z.array(ProgramRegistrationDtoSchema), nextCursor: z.string().nullable() }).strict()
const sessionResponseSchema = z.object({ user: SessionUserSchema }).strict()
const programCategoryPageSchema = z.object({ items: z.array(ProgramCategorySchema), nextCursor: z.string().nullable() }).strict()

const runStatusToApi: Record<ProgramRunStatus, "draft" | "open" | "closed" | "completed" | "cancelled"> = {
  draft: "draft", planned: "draft", registration: "open", full: "closed", completed: "completed", cancelled: "cancelled",
}
const runStatusFromApi: Record<"draft" | "open" | "closed" | "completed" | "cancelled", ProgramRunStatus> = {
  draft: "draft", open: "registration", closed: "full", completed: "completed", cancelled: "cancelled",
}

function operationId() { return crypto.randomUUID() }
function idempotencyKey(scope: string) { return `${scope}-${crypto.randomUUID()}` }
function canonicalId(value: string | null | undefined) { return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null }
function dateTimeStart(date: string) { return `${date}T00:00:00.000Z` }
function dateTimeEnd(date: string) { return `${date}T23:59:59.999Z` }

function assigneeFromId(id: string) {
  return { id, initials: id.slice(0, 2).toUpperCase(), name: id, colorClass: "bg-slate-100 text-slate-700" }
}

function mapTemplate(dto: ReturnType<typeof ProgramTemplateDtoSchema.parse>, category?: ProgramCategory): ProgramTemplate {
  return {
    id: dto.id, name: dto.name, version: dto.version, updatedAt: dto.updatedAt, categoryId: dto.categoryId ?? "uncategorized",
    categoryName: category?.name ?? dto.categoryId ?? "Без категории", categoryIcon: category?.icon ?? "sparkles", categoryTone: category?.tone ?? "violet", durationMinutes: dto.durationMinutes,
    participantLimit: dto.participantLimit, basePrice: dto.basePrice.amountMinor / 100, assignees: dto.assigneeIds.map(assigneeFromId), published: dto.published,
    nextRun: dto.nextOccurrence ? { id: dto.nextOccurrence.id, startsAt: dto.nextOccurrence.startsAt } : null, capabilities: dto.capabilities,
  }
}

function mapCategory(dto: ReturnType<typeof ProgramCategorySchema.parse>): ProgramCategory {
  return { id: dto.id, version: dto.version, name: dto.name, description: dto.description, icon: dto.icon, tone: dto.tone, templateCount: dto.templateCount }
}

function mapCategoryDetail(dto: ReturnType<typeof ProgramCategoryDetailSchema.parse>): ProgramCategoryEditorRecord {
  return { ...mapCategory(dto), relatedTemplates: dto.relatedTemplates.map((template) => ({ id: template.id, version: template.version, name: template.name, updatedAt: template.updatedAt, categoryId: dto.id, categoryName: dto.name, categoryIcon: dto.icon, categoryTone: dto.tone, durationMinutes: 0, participantLimit: 1, basePrice: 0, assignees: [], published: false, nextRun: template.nextRun })) }
}

function mapRun(dto: ReturnType<typeof ProgramOccurrenceDtoSchema.parse>, template?: ProgramTemplate): ProgramRun {
  return {
    id: dto.id, version: dto.version, currency: dto.revenue.currency, templateId: dto.templateId, name: dto.name, categoryId: template?.categoryId ?? "uncategorized", categoryIcon: template?.categoryIcon ?? "sparkles",
    categoryTone: template?.categoryTone ?? "violet", startsAt: dto.startsAt, endsAt: dto.endsAt, participantCount: dto.participantCount, participantLimit: dto.participantLimit,
    registrationCount: dto.registrationCount, registrationLimit: dto.registrationLimit, status: runStatusFromApi[dto.status], revenue: dto.revenue.amountMinor / 100,
    paid: dto.paid.amountMinor / 100, assignees: dto.assigneeIds.map(assigneeFromId),
  }
}

function mapRegistration(dto: ReturnType<typeof ProgramRegistrationDtoSchema.parse>, run?: ProgramRun): ProgramRegistration {
  return {
    id: dto.id, runId: dto.occurrenceId, programName: run?.name ?? dto.occurrenceId, programStartsAt: run?.startsAt ?? dto.createdAt, categoryIcon: run?.categoryIcon ?? "sparkles",
    categoryTone: run?.categoryTone ?? "violet", clientName: dto.customerId ?? "Без клиента", phone: dto.phone, total: dto.total.amountMinor / 100,
    debt: Math.max(0, dto.total.amountMinor - dto.paid.amountMinor) / 100, status: dto.status, comment: dto.comment, assignees: [],
  }
}

function toApiRunEditorRegistration(dto: ReturnType<typeof ProgramRegistrationDtoSchema.parse>, run: ProgramRun): ProgramRunEditorRegistration {
  return {
    ...mapRegistration(dto, run ?? undefined),
    discount: dto.discount.amountMinor / 100,
    paid: dto.paid.amountMinor / 100,
    participantCount: dto.participantCount,
    participantNames: dto.participantNames,
    promo: dto.promo,
    source: dto.source,
  }
}

function quoteLines(lines: ReturnType<typeof ProgramRegistrationQuoteResultSchema.parse>["lines"]): ProgramRegistrationQuote["lines"] {
  return lines.map((line) => ({ kind: line.kind, label: line.label, quantity: line.quantity, amount: line.amount.amountMinor / 100 }))
}

function toApiRegistrationEditorRecord(dto: ReturnType<typeof ProgramRegistrationDtoSchema.parse>, run: ProgramRun | null, payments: ProgramRegistrationEditorRecord["payments"] = [], availableAddOns: ProgramRegistrationAddOnOption[] = []): ProgramRegistrationEditorRecord {
  const compact: ProgramRunEditorRegistration = {
    ...mapRegistration(dto, run ?? undefined),
    discount: dto.discount.amountMinor / 100,
    paid: dto.paid.amountMinor / 100,
    participantCount: dto.participantCount,
    participantNames: dto.participantNames,
    promo: dto.promo,
    source: dto.source,
  }
  return {
    ...compact,
    version: dto.version,
    occurrenceVersion: run?.version ?? null,
    pricingMode: dto.pricingMode,
    currency: dto.total.currency,
    acceptedQuote: dto.acceptedQuote ? {
      quoteId: dto.acceptedQuote.quoteId,
      acceptedAt: dto.acceptedQuote.acceptedAt,
      total: dto.acceptedQuote.total.amountMinor / 100,
      currency: dto.acceptedQuote.total.currency,
      addOns: dto.acceptedQuote.addOns.map((item) => ({ ...item })),
      lines: quoteLines(dto.acceptedQuote.lines),
    } : null,
    availableAddOns,
    customerId: dto.customerId,
    internalComments: [],
    payments,
    run,
  }
}

export class ApiProgramsRepository implements ProgramsRepository, ProgramTemplateEditorRepository, ProgramRunEditorRepository, ProgramRegistrationEditorRepository, ProgramCategoryEditorRepository {
  private readonly templates = new Map<string, ReturnType<typeof ProgramTemplateDtoSchema.parse>>()
  private readonly occurrences = new Map<string, ReturnType<typeof ProgramOccurrenceDtoSchema.parse>>()
  private readonly registrations = new Map<string, ReturnType<typeof ProgramRegistrationDtoSchema.parse>>()
  private readonly commandIntents = new Map<string, { fingerprint: string; operationId: string; idempotencyKey: string }>()
  private readonly preparedProgramTemplateIds = new Set<string>()
  constructor(private readonly client: ApiProgramsClient = apiClient) {}

  async list(query: ProgramQuery): Promise<ProgramsDataset> {
    const [templates, occurrences, registrations, categories] = await Promise.all([
      this.listAll("/programs/templates?archived=false&limit=100", templatePageSchema),
      this.listAll(`/programs/occurrences?archived=false&from=${encodeURIComponent(dateTimeStart(query.date))}&to=${encodeURIComponent(dateTimeEnd(query.rangeEnd))}&limit=100`, occurrencePageSchema),
      this.listAll(`/programs/registrations?archived=false&limit=100`, registrationPageSchema),
      this.listCategories(),
    ])
    for (const dto of templates) this.templates.set(dto.id, dto)
    for (const dto of occurrences) this.occurrences.set(dto.id, dto)
    for (const dto of registrations) this.registrations.set(dto.id, dto)
    const categoryById = new Map(categories.map((category) => [category.id, category]))
    const templateModels = templates.map((dto) => mapTemplate(dto, categoryById.get(dto.categoryId ?? "")))
    const templateById = new Map(templateModels.map((template) => [template.id, template]))
    const runModels = occurrences.map((dto) => mapRun(dto, templateById.get(dto.templateId)))
    const runById = new Map(runModels.map((run) => [run.id, run]))
    const registrationModels = registrations.map((dto) => mapRegistration(dto, runById.get(dto.occurrenceId)))
    return selectPrograms({ categories, templates: templateModels, runs: runModels, registrations: registrationModels }, query)
  }

  async assignTemplate(id: string) {
    const current = await this.templateDto(id)
    const user = await this.currentUser()
    const updated = await this.client.patch(`/programs/templates/${encodeURIComponent(id)}`, { version: current.version, operationId: operationId(), idempotencyKey: idempotencyKey(`program-template-${id}`), assigneeIds: [user.id] }, ProgramTemplateDtoSchema)
    this.templates.set(updated.id, updated)
    return mapTemplate(updated)
  }

  async assignRun(id: string) {
    const current = await this.occurrenceDto(id)
    const user = await this.currentUser()
    const updated = await this.client.patch(`/programs/occurrences/${encodeURIComponent(id)}`, { version: current.version, operationId: operationId(), idempotencyKey: idempotencyKey(`program-occurrence-${id}`), assigneeIds: [user.id] }, ProgramOccurrenceDtoSchema)
    this.occurrences.set(updated.id, updated)
    return mapRun(updated, this.templates.get(updated.templateId) ? mapTemplate(this.templates.get(updated.templateId)!) : undefined)
  }

  async assignRegistration(id: string) {
    const current = await this.registrationDto(id)
    // The canonical registration contract has no assignee field. Keep this
    // repository method for the shared list boundary, but do not manufacture a
    // client-side assignment that the API cannot persist.
    const occurrence = this.occurrences.get(current.occurrenceId)
    return mapRegistration(current, occurrence ? mapRun(occurrence, this.templates.get(occurrence.templateId) ? mapTemplate(this.templates.get(occurrence.templateId)!) : undefined) : undefined)
  }

  async updateRunStatus(id: string, status: ProgramRunStatus) {
    const current = await this.occurrenceDto(id)
    const updated = await this.client.post(`/programs/occurrences/${encodeURIComponent(id)}/transition`, { version: current.version, operationId: operationId(), idempotencyKey: idempotencyKey(`program-occurrence-transition-${id}`), status: runStatusToApi[status] }, ProgramOccurrenceDtoSchema)
    this.occurrences.set(updated.id, updated)
    const template = this.templates.get(updated.templateId)
    return mapRun(updated, template ? mapTemplate(template) : undefined)
  }

  async updateRegistrationStatus(id: string, status: ProgramRegistrationStatus) {
    const current = await this.registrationDto(id)
    const updated = await this.client.post(`/programs/registrations/${encodeURIComponent(id)}/transition`, { version: current.version, operationId: operationId(), idempotencyKey: idempotencyKey(`program-registration-transition-${id}`), status }, ProgramRegistrationDtoSchema)
    this.registrations.set(updated.id, updated)
    const occurrence = this.occurrences.get(updated.occurrenceId)
    const run = occurrence ? mapRun(occurrence, this.templates.get(occurrence.templateId) ? mapTemplate(this.templates.get(occurrence.templateId)!) : undefined) : undefined
    return mapRegistration(updated, run)
  }

  async getTemplate(id: string): Promise<ProgramTemplateEditorRecord | null> {
    try {
      const dto = await this.templateDto(id)
      const template = mapTemplate(dto)
      const occurrences = await this.listAll(`/programs/occurrences?templateId=${encodeURIComponent(dto.id)}&archived=false&limit=100`, occurrencePageSchema)
      for (const occurrence of occurrences) this.occurrences.set(occurrence.id, occurrence)
      return {
        ...template,
        description: dto.description,
        minimumParticipants: dto.minimumParticipants,
        registrationCloseHours: dto.registrationCloseHours,
        stages: dto.stages.map((stage) => ({ ...stage })),
        relatedRuns: occurrences.map((occurrence) => mapRun(occurrence, template)),
      }
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) return null
      throw error
    }
  }

  async listCategories(): Promise<ProgramCategory[]> {
    return (await this.listAll("/programs/categories?archived=false&limit=100", programCategoryPageSchema)).map(mapCategory)
  }

  async saveTemplate(record: ProgramTemplateEditorRecord): Promise<ProgramTemplateEditorRecord> {
    const money = { amountMinor: Math.round(record.basePrice * 100), currency: "RUB" }
    const legacyFields = record.id === "new" || !this.preparedProgramTemplateIds.has(record.id)
      ? { basePrice: money, publication: record.published ? "published" as const : "draft" as const }
      : {}
    const common = {
      name: record.name,
      categoryId: canonicalId(record.categoryId === "uncategorized" ? null : record.categoryId),
      durationMinutes: record.durationMinutes,
      minimumParticipants: record.minimumParticipants,
      participantLimit: record.participantLimit,
      registrationCloseHours: record.registrationCloseHours,
      description: record.description,
      ...legacyFields,
      assigneeIds: record.assignees.map((assignee) => assignee.id),
      stages: record.stages.map(({ id, name, durationMinutes, comment }) => ({ ...(canonicalId(id) ? { id } : {}), name, durationMinutes, comment })),
    }
    const updated = record.id === "new"
      ? await this.client.post("/programs/templates", { ...common, operationId: operationId(), idempotencyKey: idempotencyKey("program-template-create") }, ProgramTemplateDtoSchema)
      : await this.client.patch(`/programs/templates/${encodeURIComponent(record.id)}`, { ...common, version: record.version, operationId: operationId(), idempotencyKey: idempotencyKey(`program-template-${record.id}`) }, ProgramTemplateDtoSchema)
    this.templates.set(updated.id, updated)
    const template = mapTemplate(updated)
    return { ...template, description: updated.description, minimumParticipants: updated.minimumParticipants, registrationCloseHours: updated.registrationCloseHours, stages: updated.stages.map((stage) => ({ ...stage })), relatedRuns: record.relatedRuns }
  }

  async resolveProgramOffering(programTemplateId: string): Promise<ProgramOfferingResolution> {
    const lookup = await this.client.get(`/programs/${encodeURIComponent(programTemplateId)}/offering`, ProgramOfferingLookupResultSchema)
    if (lookup.resolution === "unprepared") return { resolution: "unprepared" }
    if (lookup.resolution === "ambiguous") return { resolution: "ambiguous", candidateOfferingIds: lookup.candidates.map((candidate) => candidate.offeringId) }
    const editor = await this.client.get(`/offerings/${encodeURIComponent(lookup.offering.offeringId)}/editor`, InternalOfferingEditorSchema)
    const primaries = editor.bindings.filter((binding) => binding.role === "primary" && binding.target.type === "program_template")
    if (editor.offering.kind !== "program" || primaries.length !== 1 || primaries[0]?.target.id !== programTemplateId) {
      throw new Error("Program offering не соответствует открытому шаблону")
    }
    this.preparedProgramTemplateIds.add(programTemplateId)
    return { resolution: "linked", editor, cmsReady: lookup.offering.cmsReady, publicReady: lookup.offering.publicReady }
  }

  async prepareProgramOffering(programTemplateId: string, expectedProgramTemplateVersion: number) {
    const scope = `program-offering-prepare:${programTemplateId}`
    const input = { expectedProgramTemplateVersion }
    const intent = this.commandIntent(scope, input)
    const body = ProgramOfferingPrepareBodySchema.parse({ ...input, operationId: intent.operationId, idempotencyKey: intent.idempotencyKey })
    const result = await this.client.post(`/programs/${encodeURIComponent(programTemplateId)}/offering`, body, ProgramOfferingPrepareResultSchema)
    this.commandIntents.delete(scope)
    this.preparedProgramTemplateIds.add(programTemplateId)
    return result
  }

  async createProgramPriceBook(offeringId: string, expectedPricingVersion: number, input: ProgramPriceBookDraftInput) {
    const scope = `program-price-book-create:${offeringId}`
    const intent = this.commandIntent(scope, { expectedPricingVersion, input })
    const body = HousePriceBookDraftCreateBodySchema.parse({ ...input, expectedPricingVersion, operationId: intent.operationId, idempotencyKey: intent.idempotencyKey })
    const result = await this.client.post(`/offerings/${encodeURIComponent(offeringId)}/price-books/drafts`, body, OfferingPricingMutationResultSchema)
    this.commandIntents.delete(scope)
    return result
  }

  async replaceProgramPriceBook(offeringId: string, priceBookId: string, expectedPricingVersion: number, input: ProgramPriceBookDraftInput) {
    const scope = `program-price-book-replace:${offeringId}:${priceBookId}`
    const intent = this.commandIntent(scope, { expectedPricingVersion, input })
    const replaceInput = {
      name: input.name,
      validFrom: input.validFrom,
      validToExclusive: input.validToExclusive,
      changeReason: input.changeReason,
      ratePlans: input.ratePlans,
    }
    const body = HousePriceBookDraftReplaceBodySchema.parse({ ...replaceInput, expectedPricingVersion, operationId: intent.operationId, idempotencyKey: intent.idempotencyKey })
    const result = await this.client.request(`/offerings/${encodeURIComponent(offeringId)}/price-books/drafts/${encodeURIComponent(priceBookId)}`, { body, method: "PUT" }, OfferingPricingMutationResultSchema)
    this.commandIntents.delete(scope)
    return result
  }

  async activateProgramPriceBook(offeringId: string, priceBookId: string, expectedPricingVersion: number) {
    const scope = `program-price-book-activate:${offeringId}:${priceBookId}`
    const intent = this.commandIntent(scope, { expectedPricingVersion })
    const body = HousePriceBookActivateBodySchema.parse({ expectedPricingVersion, operationId: intent.operationId, idempotencyKey: intent.idempotencyKey, reason: "Тариф программы проверен оператором" })
    const result = await this.client.post(`/offerings/${encodeURIComponent(offeringId)}/price-books/${encodeURIComponent(priceBookId)}/activate`, body, OfferingPricingMutationResultSchema)
    this.commandIntents.delete(scope)
    return result
  }

  async previewProgramQuote(programTemplateId: string, input: ProgramQuotePreviewInput) {
    const scope = `program-quote-preview:${programTemplateId}`
    const intent = this.commandIntent(scope, input)
    const body = ProgramOfferingQuotePreviewBodySchema.parse({ quoteType: "template_preview", ...input, currency: "RUB", addOns: [], operationId: intent.operationId, idempotencyKey: intent.idempotencyKey })
    const result = await this.client.post(`/programs/${encodeURIComponent(programTemplateId)}/offering/quotes/preview`, body, ProgramOfferingQuoteResultSchema)
    this.commandIntents.delete(scope)
    return result
  }

  async getRun(id: string): Promise<ProgramRunEditorRecord | null> {
    const dto = await this.occurrenceDto(id).catch((error) => {
      if (error instanceof ApiClientError && error.status === 404) return null
      throw error
    })
    if (!dto) return null
    const templateDto = await this.templateDto(dto.templateId).catch(() => null)
    const template = templateDto ? mapTemplate(templateDto) : undefined
    const registrations = await this.listAll(`/programs/registrations?occurrenceId=${encodeURIComponent(id)}&archived=false&limit=100`, registrationPageSchema)
    for (const registration of registrations) this.registrations.set(registration.id, registration)
    const run = mapRun(dto, template)
    const resourceBookings = await this.listResourceBookings(id)
    return {
      ...run,
      comment: dto.comment,
      registrations: registrations.map((registration) => toApiRunEditorRegistration(registration, run)),
      resourceBookings,
    }
  }

  async listRunResources(): Promise<ProgramRunResourceOption[]> {
    const resources = await this.client.get("/resources?archived=false&limit=100", ResourceDtoSchema.array())
    return resources.map((resource) => ({ id: resource.id, name: resource.name, category: resource.kind, capacity: resource.capacityTotal, version: resource.version }))
  }

  async listRunTemplates(): Promise<ProgramTemplate[]> {
    const templates = await this.listAll("/programs/templates?archived=false&limit=100", templatePageSchema)
    for (const template of templates) this.templates.set(template.id, template)
    return templates.map((template) => mapTemplate(template))
  }

  async saveRun(record: ProgramRunEditorRecord): Promise<ProgramRunEditorRecord> {
    const common = {
      templateId: record.templateId,
      name: record.name,
      startsAt: record.startsAt,
      endsAt: record.endsAt,
      participantLimit: record.participantLimit,
      registrationLimit: record.registrationLimit,
      comment: record.comment,
      assigneeIds: record.assignees.map((assignee) => assignee.id),
    }
    let updated = record.id === "new"
      ? await this.client.post("/programs/occurrences", { ...common, currency: "RUB", operationId: operationId(), idempotencyKey: idempotencyKey("program-occurrence-create") }, ProgramOccurrenceDtoSchema)
      : await this.client.patch(`/programs/occurrences/${encodeURIComponent(record.id)}`, { ...common, version: (await this.occurrenceDto(record.id)).version, operationId: operationId(), idempotencyKey: idempotencyKey(`program-occurrence-${record.id}`) }, ProgramOccurrenceDtoSchema)
    this.occurrences.set(updated.id, updated)
    const targetStatus = runStatusToApi[record.status]
    if (updated.status !== targetStatus) {
      updated = await this.client.post(`/programs/occurrences/${encodeURIComponent(updated.id)}/transition`, { version: updated.version, operationId: operationId(), idempotencyKey: idempotencyKey(`program-occurrence-transition-${updated.id}`), status: targetStatus }, ProgramOccurrenceDtoSchema)
      this.occurrences.set(updated.id, updated)
    }
    const templateDto = await this.templateDto(updated.templateId).catch(() => null)
    const template = templateDto ? mapTemplate(templateDto) : undefined
    const registrations = await this.listAll(`/programs/registrations?occurrenceId=${encodeURIComponent(updated.id)}&archived=false&limit=100`, registrationPageSchema)
    for (const registration of registrations) this.registrations.set(registration.id, registration)
    await this.reconcileResourceBookings(updated.id, record.resourceBookings, "program_occurrence")
    const run = mapRun(updated, template)
    return { ...run, comment: updated.comment, registrations: registrations.map((registration) => toApiRunEditorRegistration(registration, run)), resourceBookings: await this.listResourceBookings(updated.id) }
  }

  private async listResourceBookings(sourceId: string) {
    const [allocations, resources] = await Promise.all([
      this.client.get(`/resources/allocations?sourceType=program_occurrence&sourceId=${encodeURIComponent(sourceId)}&includeCancelled=false`, ResourceAllocationDtoSchema.array()),
      this.listRunResources(),
    ])
    const names = new Map(resources.map((resource) => [resource.id, resource.name]))
    return (Array.isArray(allocations) ? allocations : []).map((allocation) => ({ id: allocation.id, resourceId: allocation.resourceId, resourceName: names.get(allocation.resourceId) ?? allocation.resourceId, startAt: allocation.startAt, endAt: allocation.endAt, guestCount: allocation.quantity }))
  }

  private async reconcileResourceBookings(sourceId: string, desired: ProgramRunEditorRecord["resourceBookings"], sourceType: "program_occurrence") {
    const current = await this.client.get(`/resources/allocations?sourceType=${sourceType}&sourceId=${encodeURIComponent(sourceId)}&includeCancelled=false`, ResourceAllocationDtoSchema.array())
    const activeAllocations = Array.isArray(current) ? current : []
    const desiredIds = new Set(desired.filter((booking) => {
      const existing = activeAllocations.find((item) => item.id === booking.id)
      return Boolean(existing && existing.resourceId === booking.resourceId && existing.startAt === booking.startAt && existing.endAt === booking.endAt && existing.quantity === booking.guestCount)
    }).map((booking) => booking.id))
    for (const allocation of activeAllocations.filter((item) => !desiredIds.has(item.id))) {
      const options = await this.listRunResources()
      const resource = options.find((item) => item.id === allocation.resourceId)
      if (!resource) continue
      await this.client.post(`/resources/allocations/${encodeURIComponent(allocation.id)}/cancel`, { expectedVersion: resource.version, operationId: operationId(), idempotencyKey: idempotencyKey(`program-allocation-cancel-${allocation.id}`) }, ResourceAllocationDtoSchema)
    }
    for (const booking of desired) {
      if (desiredIds.has(booking.id)) continue
      const options = await this.listRunResources()
      const resource = options.find((item) => item.id === booking.resourceId)
      if (!resource) throw new Error("Выбранный ресурс недоступен")
      await this.client.post("/resources/allocations", { resourceId: resource.id, sourceType, sourceId, startAt: booking.startAt, endAt: booking.endAt, quantity: booking.guestCount, capacityImpact: booking.guestCount, status: "tentative", operationId: operationId(), expectedVersion: resource.version, overrideConflict: false }, ResourceAllocationDtoSchema)
    }
  }

  async getRegistration(id: string): Promise<ProgramRegistrationEditorRecord | null> {
    const dto = await this.registrationDto(id).catch((error) => {
      if (error instanceof ApiClientError && error.status === 404) return null
      throw error
    })
    if (!dto) return null
    const occurrence = await this.occurrenceDto(dto.occurrenceId).catch(() => null)
    const template = occurrence ? await this.templateDto(occurrence.templateId).catch(() => null) : null
    const run = occurrence ? mapRun(occurrence, template ? mapTemplate(template) : undefined) : null
    const availableAddOns = template ? await this.availableRegistrationAddOns(template.id) : []
    return toApiRegistrationEditorRecord(dto, run, await this.listRegistrationPayments(dto.id), availableAddOns)
  }

  async createRegistrationDraft(run?: ProgramRun) {
    const draft = createEmptyProgramRegistration(run)
    if (!run?.templateId) return draft
    const resolution = await this.resolveProgramOffering(run.templateId)
    if (resolution.resolution === "ambiguous") throw new Error("Для программы найдено несколько offering")
    if (resolution.resolution === "unprepared") return draft
    return { ...draft, pricingMode: "quote_required" as const, availableAddOns: registrationAddOns(resolution.editor) }
  }

  async listRegistrationRuns(): Promise<ProgramRun[]> {
    const occurrences = await this.listAll("/programs/occurrences?archived=false&limit=100", occurrencePageSchema)
    for (const occurrence of occurrences) this.occurrences.set(occurrence.id, occurrence)
    const templates = await this.listRunTemplates()
    const templateById = new Map(templates.map((template) => [template.id, template]))
    return occurrences.map((occurrence) => mapRun(occurrence, templateById.get(occurrence.templateId)))
  }

  async saveRegistration(record: ProgramRegistrationEditorRecord): Promise<ProgramRegistrationEditorRecord> {
    const money = (value: number) => ({ amountMinor: Math.round(value * 100), currency: record.currency })
    const mutableContext = record.acceptedQuote ? {} : {
      occurrenceId: record.runId,
      participantCount: Math.max(1, record.participantCount ?? 1),
    }
    const editable = {
      ...mutableContext,
      customerId: record.customerId,
      phone: record.phone,
      participantNames: record.participantNames,
      promo: record.promo,
      source: record.source,
      comment: record.comment,
    }
    const legacyPrice = record.pricingMode === "legacy_unpriced" ? { total: money(record.total), discount: money(record.discount) } : {}
    const common = { ...editable, ...legacyPrice }
    let updated = record.id === "new"
      ? await this.client.post("/programs/registrations", { ...common, status: record.status === "confirmed" && record.pricingMode === "quote_required" ? "new" : record.status, operationId: operationId(), idempotencyKey: idempotencyKey("program-registration-create") }, ProgramRegistrationDtoSchema)
      : await this.client.patch(`/programs/registrations/${encodeURIComponent(record.id)}`, { ...common, version: record.version, operationId: operationId(), idempotencyKey: idempotencyKey(`program-registration-${record.id}`) }, ProgramRegistrationDtoSchema)
    this.registrations.set(updated.id, updated)
    if (record.pricingMode === "legacy_unpriced" && record.id !== "new" && updated.status !== record.status) {
      updated = await this.client.post(`/programs/registrations/${encodeURIComponent(updated.id)}/transition`, { version: updated.version, operationId: operationId(), idempotencyKey: idempotencyKey(`program-registration-transition-${updated.id}`), status: record.status }, ProgramRegistrationDtoSchema)
      this.registrations.set(updated.id, updated)
    }
    const occurrence = await this.occurrenceDto(updated.occurrenceId).catch(() => null)
    const template = occurrence ? await this.templateDto(occurrence.templateId).catch(() => null) : null
    await this.reconcileRegistrationPayments(updated.id, record.payments)
    const authoritative = await this.registrationDto(updated.id)
    const availableAddOns = template ? await this.availableRegistrationAddOns(template.id) : []
    return toApiRegistrationEditorRecord(authoritative, occurrence ? mapRun(occurrence, template ? mapTemplate(template) : undefined) : null, await this.listRegistrationPayments(updated.id), availableAddOns)
  }

  async quoteRegistration(registration: ProgramRegistrationEditorRecord, addOns: ProgramRegistrationAddOnSelection[]): Promise<ProgramRegistrationQuote> {
    if (registration.pricingMode !== "quote_required" || registration.occurrenceVersion === null) throw new Error("Серверный расчёт для этой регистрации недоступен")
    const input = {
      expectedOccurrenceVersion: registration.occurrenceVersion,
      ratePlanKey: null,
      participants: Math.max(1, registration.participantCount ?? 1),
      currency: registration.currency,
      addOns: [...addOns].sort((left, right) => left.assignmentId.localeCompare(right.assignmentId)),
    }
    const scope = `program-registration-quote:${registration.runId}`
    const intent = this.commandIntent(scope, input)
    const body = ProgramRegistrationQuoteBodySchema.parse({ ...input, operationId: intent.operationId, idempotencyKey: intent.idempotencyKey })
    const result = await this.client.post(`/programs/occurrences/${encodeURIComponent(registration.runId)}/offering/quotes/registration`, body, ProgramRegistrationQuoteResultSchema)
    this.commandIntents.delete(scope)
    return {
      quoteId: result.quoteId,
      occurrenceId: result.programOccurrenceId,
      occurrenceVersion: result.programOccurrenceVersion,
      calculatedAt: result.calculatedAt,
      validUntil: result.validUntil,
      participants: result.inputs.participants,
      total: result.total.amountMinor / 100,
      currency: result.currency,
      addOns: result.inputs.addOns.map((item) => ({ ...item })),
      lines: quoteLines(result.lines),
    }
  }

  async confirmRegistration(registration: ProgramRegistrationEditorRecord, quote: ProgramRegistrationQuote): Promise<ProgramRegistrationEditorRecord> {
    if (registration.id === "new") throw new Error("Сначала сохраните черновик")
    const input = { version: registration.version, status: "confirmed" as const, quoteAcceptance: { quoteSnapshotId: quote.quoteId } }
    const scope = `program-registration-confirm:${registration.id}`
    const intent = this.commandIntent(scope, input)
    const updated = await this.client.post(`/programs/registrations/${encodeURIComponent(registration.id)}/transition`, { ...input, operationId: intent.operationId, idempotencyKey: intent.idempotencyKey }, ProgramRegistrationDtoSchema)
    this.commandIntents.delete(scope)
    this.registrations.set(updated.id, updated)
    const occurrence = await this.occurrenceDto(updated.occurrenceId).catch(() => null)
    const template = occurrence ? await this.templateDto(occurrence.templateId).catch(() => null) : null
    const availableAddOns = template ? await this.availableRegistrationAddOns(template.id) : []
    return toApiRegistrationEditorRecord(updated, occurrence ? mapRun(occurrence, template ? mapTemplate(template) : undefined) : null, await this.listRegistrationPayments(updated.id), availableAddOns)
  }

  private async availableRegistrationAddOns(templateId: string): Promise<ProgramRegistrationAddOnOption[]> {
    try {
      const resolution = await this.resolveProgramOffering(templateId)
      return resolution.resolution === "linked" ? registrationAddOns(resolution.editor) : []
    } catch {
      return []
    }
  }

  private async listRegistrationPayments(registrationId: string): Promise<ProgramRegistrationEditorRecord["payments"]> {
    const query = new URLSearchParams({ "target[type]": "program_registration", "target[id]": registrationId, limit: "100" })
    const page = await this.client.get(`/payments?${query.toString()}`, PaymentListResponseSchema)
    return (page?.items ?? []).map((payment) => ({ id: payment.id, amount: payment.amount.amountMinor / 100, comment: payment.reason ?? "", date: payment.createdAt.slice(0, 10), kind: payment.type === "refund" ? "refund" : "payment", method: payment.method === "cash" || payment.method === "bank_transfer" ? payment.method === "bank_transfer" ? "transfer" : "cash" : "card", ...(payment.sourcePaymentId ? { sourcePaymentId: payment.sourcePaymentId } : {}) }))
  }

  private async reconcileRegistrationPayments(registrationId: string, desired: ProgramRegistrationEditorRecord["payments"]) {
    const existing = new Set((await this.listRegistrationPayments(registrationId)).map((payment) => payment.id))
    const pending = desired.filter((payment) => !existing.has(payment.id))
    const ids = new Map<string, string>()
    for (const payment of pending.filter((payment) => payment.kind === "payment")) {
      const current = await this.refreshRegistrationDto(registrationId)
      const saved = await this.client.post("/payments", { target: { type: "program_registration", id: registrationId }, type: "charge", amount: { amountMinor: Math.round(payment.amount * 100), currency: current.total.currency }, method: payment.method === "transfer" ? "bank_transfer" : payment.method, reason: payment.comment || null, sourcePaymentId: null, expectedVersion: current.version, operationId: operationId(), idempotencyKey: idempotencyKey(`program-registration-payment-${registrationId}`) }, PaymentListResponseSchema.shape.items.element)
      ids.set(payment.id, saved.id)
    }
    for (const payment of pending.filter((payment) => payment.kind === "refund")) {
      const sourcePaymentId = payment.sourcePaymentId ? ids.get(payment.sourcePaymentId) ?? payment.sourcePaymentId : undefined
      if (!sourcePaymentId) throw new Error("Для возврата нужна сохранённая исходная оплата")
      const current = await this.refreshRegistrationDto(registrationId)
      await this.client.post("/payments", { target: { type: "program_registration", id: registrationId }, type: "refund", amount: { amountMinor: Math.round(payment.amount * 100), currency: current.total.currency }, method: payment.method === "transfer" ? "bank_transfer" : payment.method, reason: payment.comment || null, sourcePaymentId, expectedVersion: current.version, operationId: operationId(), idempotencyKey: idempotencyKey(`program-registration-refund-${registrationId}`) }, PaymentListResponseSchema.shape.items.element)
    }
  }

  async getCategory(id: string): Promise<ProgramCategoryEditorRecord | null> {
    if (id === "new") return null
    const response = await this.client.get(`/programs/categories/${encodeURIComponent(id)}`, ProgramCategoryDetailSchema)
    return mapCategoryDetail(response)
  }
  async saveCategory(category: ProgramCategoryEditorRecord): Promise<ProgramCategoryEditorRecord> {
    const common = { name: category.name, description: category.description, icon: category.icon, tone: category.tone, operationId: operationId(), idempotencyKey: idempotencyKey("program-category") }
    const response = category.id === "new"
      ? await this.client.post("/programs/categories", common, ProgramCategoryDetailSchema)
      : await this.client.patch(`/programs/categories/${encodeURIComponent(category.id)}`, { ...common, version: category.version ?? 1 }, ProgramCategoryDetailSchema)
    return mapCategoryDetail(response)
  }

  private async currentUser() { return (await this.client.get("/auth/session", sessionResponseSchema)).user }
  private async templateDto(id: string) {
    const cached = this.templates.get(id)
    if (cached) return cached
    const value = await this.client.get(`/programs/templates/${encodeURIComponent(id)}`, ProgramTemplateDtoSchema)
    this.templates.set(value.id, value)
    return value
  }
  private async occurrenceDto(id: string) {
    const cached = this.occurrences.get(id)
    if (cached) return cached
    const value = await this.client.get(`/programs/occurrences/${encodeURIComponent(id)}`, ProgramOccurrenceDtoSchema)
    this.occurrences.set(value.id, value)
    return value
  }
  private async registrationDto(id: string) {
    const cached = this.registrations.get(id)
    if (cached) return cached
    const value = await this.client.get(`/programs/registrations/${encodeURIComponent(id)}`, ProgramRegistrationDtoSchema)
    this.registrations.set(value.id, value)
    return value
  }
  private async refreshRegistrationDto(id: string) {
    const value = await this.client.get(`/programs/registrations/${encodeURIComponent(id)}`, ProgramRegistrationDtoSchema)
    this.registrations.set(value.id, value)
    return value
  }

  private commandIntent(scope: string, input: unknown) {
    const fingerprint = JSON.stringify(input)
    const current = this.commandIntents.get(scope)
    if (current?.fingerprint === fingerprint) return current
    const next = { fingerprint, operationId: operationId(), idempotencyKey: idempotencyKey(scope.replace(/[^A-Za-z0-9._~-]/g, "-")) }
    this.commandIntents.set(scope, next)
    return next
  }


  private async listAll<T>(path: string, schema: z.ZodType<Page<T>>) {
    const items: T[] = []
    const basePath = path
    let nextPath = basePath
    for (let page = 0; page < 100; page += 1) {
      const response = await this.client.getWithMeta(nextPath, schema)
      items.push(...response.data.items)
      const cursor = response.headers.get("x-next-cursor") ?? response.data.nextCursor
      if (!cursor) return items
      nextPath = `${basePath}&cursor=${encodeURIComponent(cursor)}`
    }
    throw new Error("Не удалось загрузить все программы")
  }
}

function toTemplateEditorRecord(template: ProgramTemplate, relatedRuns: ProgramRun[]): ProgramTemplateEditorRecord {
  return {
    ...structuredClone(template),
    description: "Семейная программа с интерактивными этапами и общим финалом у костра.",
    minimumParticipants: 4,
    registrationCloseHours: 12,
    relatedRuns: structuredClone(relatedRuns),
    stages: [
      { id: `stage-${template.id}-1`, name: "Сбор и знакомство группы", durationMinutes: 20, comment: "Проверить список участников" },
      { id: `stage-${template.id}-2`, name: "Основная интерактивная программа", durationMinutes: Math.max(30, template.durationMinutes - 50), comment: "Длинный комментарий для проверки переноса текста внутри этапа" },
      { id: `stage-${template.id}-3`, name: "Общий финал и обратная связь", durationMinutes: 30, comment: "Фото и памятки участникам" },
    ],
  }
}

function toListTemplate(record: ProgramTemplateEditorRecord): ProgramTemplate {
  const flat = structuredClone(record) as ProgramTemplateEditorRecord & Record<string, unknown>
  for (const key of ["description", "minimumParticipants", "registrationCloseHours", "relatedRuns", "stages"]) delete flat[key]
  return flat as unknown as ProgramTemplate
}

function fixturePriceBook(offeringId: string, input: ProgramPriceBookDraftInput, state: "draft" | "active") {
  const now = new Date().toISOString()
  const priceBookId = crypto.randomUUID()
  return {
    id: priceBookId, offeringId, version: 1, revision: 1, state, scheduledActivationAt: null,
    activatedAt: state === "active" ? now : null, retiredAt: null, supersedesPriceBookId: input.supersedesPriceBookId,
    name: input.name, currency: "RUB" as const, timezone: "Europe/Moscow", validFrom: input.validFrom,
    validToExclusive: input.validToExclusive, changeReason: input.changeReason,
    ratePlans: input.ratePlans.map((plan) => {
      const ratePlanId = plan.id ?? crypto.randomUUID()
      return { ...plan, id: ratePlanId, priceBookId, version: 1, rules: plan.rules.map((rule) => ({ ...rule, id: rule.id ?? crypto.randomUUID(), ratePlanId, version: 1 })) }
    }),
    createdAt: now, updatedAt: now,
  }
}

export function createEmptyProgramTemplate(): ProgramTemplateEditorRecord {
  return toTemplateEditorRecord({
    assignees: [],
    basePrice: 0,
    categoryIcon: "sparkles",
    categoryId: "special",
    categoryName: "Специальные",
    categoryTone: "rose",
    durationMinutes: 60,
    id: "new",
    name: "Новая программа",
    nextRun: null,
    participantLimit: 1,
    published: false,
    updatedAt: new Date().toISOString(),
    version: 1,
  }, [])
}

function toRunEditorRecord(run: ProgramRun, registrations: ProgramRegistration[]): ProgramRunEditorRecord {
  return {
    ...structuredClone(run),
    comment: "Проверить готовность площадки за час до начала.",
    registrations: registrations.map((registration) => toRunEditorRegistration(registration)),
    resourceBookings: [
      { id: `run-resource-${run.id}-1`, resourceId: "house-pine", resourceName: "Дом «Сосна»", startAt: run.startsAt, endAt: run.endsAt, guestCount: Math.min(run.participantLimit, 6) },
      { id: `run-resource-${run.id}-2`, resourceId: "camp-north", resourceName: "Кемпинг Север", startAt: run.startsAt, endAt: run.endsAt, guestCount: Math.min(run.participantLimit, 16) },
    ],
  }
}

function toRunEditorRegistration(registration: ProgramRegistration, detail?: ProgramRunEditorRegistration): ProgramRunEditorRegistration {
  return {
    ...structuredClone(registration),
    discount: detail?.discount ?? 0,
    paid: detail?.paid ?? Math.max(0, registration.total - registration.debt),
    participantCount: detail?.participantCount ?? null,
    participantNames: detail?.participantNames ?? "",
    promo: detail?.promo ?? "",
    source: detail?.source ?? "",
  }
}

function toRegistrationEditorRecord(registration: ProgramRunEditorRegistration, run: ProgramRun | null): ProgramRegistrationEditorRecord {
  return {
    ...structuredClone(registration),
    version: 1,
    occurrenceVersion: run?.version ?? 1,
    pricingMode: "legacy_unpriced",
    currency: run?.currency ?? "RUB",
    acceptedQuote: null,
    availableAddOns: [],
    customerId: null,
    internalComments: [{ id: `registration-comment-${registration.id}-1`, author: "Марина Кириллова", createdLabel: "Сегодня, 13:48", text: "Клиент подтвердил состав группы и получил памятку участника." }, { id: `registration-comment-${registration.id}-2`, author: "Алексей Воронов", createdLabel: "23 авг, 18:12", text: "Проверил промокод и итоговую стоимость." }],
    payments: registration.paid > 0 ? [{ amount: registration.paid, comment: "Предоплата", date: "2026-08-23", id: `registration-payment-${registration.id}-1`, kind: "payment", method: "card" }] : [],
    run: run ? structuredClone(run) : null,
  }
}

function registrationAddOns(editor: InternalOfferingEditor): ProgramRegistrationAddOnOption[] {
  const catalog = new Map(editor.addOnCatalog.map((item) => [item.offering.id, item]))
  return editor.addOnAssignments
    .filter((assignment) => assignment.enabled)
    .sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id))
    .flatMap((assignment) => {
      const item = catalog.get(assignment.addOnOfferingId)
      if (!item || item.availability.status !== "available" || item.offering.archived || item.offering.state !== "active" || (item.serviceType !== "quantity_service" && item.serviceType !== "person_service")) return []
      const minQuantity = Math.max(1, assignment.minQuantityOverride ?? 1)
      const maxQuantity = assignment.maxQuantityOverride
      const defaultQuantity = Math.max(minQuantity, Math.min(maxQuantity ?? Number.MAX_SAFE_INTEGER, assignment.defaultQuantityOverride ?? minQuantity))
      return [{ assignmentId: assignment.id, label: assignment.labelOverride ?? item.offering.operationalName, serviceType: item.serviceType, required: assignment.required, minQuantity, maxQuantity, defaultQuantity }]
    })
}

function toListRun(record: ProgramRunEditorRecord): ProgramRun {
  const flat = structuredClone(record) as ProgramRunEditorRecord & Record<string, unknown>
  for (const key of ["comment", "registrations", "resourceBookings"]) delete flat[key]
  return flat as unknown as ProgramRun
}

function toListRegistration(record: ProgramRunEditorRegistration): ProgramRegistration {
  const flat = structuredClone(record) as ProgramRunEditorRegistration & Record<string, unknown>
  for (const key of ["customerId", "discount", "internalComments", "paid", "participantCount", "participantNames", "payments", "promo", "run", "source"]) delete flat[key]
  return flat as unknown as ProgramRegistration
}

export function createEmptyProgramRun(template?: ProgramTemplate): ProgramRunEditorRecord {
  const now = new Date()
  now.setMinutes(0, 0, 0)
  const end = new Date(now.getTime() + (template?.durationMinutes ?? 60) * 60_000)
  return {
    assignees: [],
    categoryIcon: template?.categoryIcon ?? "sparkles",
    categoryId: template?.categoryId ?? "special",
    categoryTone: template?.categoryTone ?? "rose",
    comment: "",
    endsAt: localDateTimeIso(end),
    id: "new",
    name: template?.name ?? "Новое проведение",
    paid: 0,
    participantCount: 0,
    participantLimit: template?.participantLimit ?? 1,
    registrationCount: 0,
    registrationLimit: template?.participantLimit ?? 1,
    registrations: [],
    resourceBookings: [],
    revenue: 0,
    startsAt: localDateTimeIso(now),
    status: "draft",
    templateId: template?.id ?? "",
  }
}

export function createEmptyProgramRegistration(run?: ProgramRun): ProgramRegistrationEditorRecord {
  return toRegistrationEditorRecord({
    assignees: [],
    categoryIcon: run?.categoryIcon ?? "sparkles",
    categoryTone: run?.categoryTone ?? "rose",
    clientName: "Новый клиент",
    comment: "",
    debt: 0,
    discount: 0,
    id: "new",
    paid: 0,
    participantCount: 1,
    participantNames: "",
    phone: "",
    programName: run?.name ?? "Программа не выбрана",
    programStartsAt: run?.startsAt ?? localDateTimeIso(new Date()),
    promo: "",
    runId: run?.id ?? "",
    source: "",
    status: "new",
    total: 0,
  }, run ?? null)
}

function localDateTimeIso(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0")
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? "+" : "-"
  const absoluteOffset = Math.abs(offset)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`
}

export type FullProgramsRepository = ProgramsRepository & ProgramTemplateEditorRepository & ProgramRunEditorRepository & ProgramRegistrationEditorRepository & ProgramCategoryEditorRepository
export const fixtureProgramsRepository: FullProgramsRepository = new FixtureProgramsRepository()
export const apiProgramsRepository: FullProgramsRepository = new ApiProgramsRepository()
export const programsRepository: FullProgramsRepository = useFixtureData ? fixtureProgramsRepository : apiProgramsRepository

const demoAssignee = { id: "demo-manager", initials: "МК", name: "Марина Кириллова", colorClass: "bg-sky-100 text-sky-700" }
