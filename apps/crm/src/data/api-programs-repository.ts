import type {
  ProgramRegistrationAddOnOption,
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
import { ApiClientError, apiClient } from "@app/lib/api-client"
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
} from "@crm/contracts"
import { z } from "zod"
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
  mapCategory,
  mapCategoryDetail,
  mapRegistration,
  mapRun,
  mapTemplate,
  registrationAddOns,
  quoteLines,
  selectPrograms,
  toApiRegistrationEditorRecord,
  toApiRunEditorRegistration,
} from "./programs-repository-model.js"

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
function operationId() { return crypto.randomUUID() }
function idempotencyKey(scope: string) { return `${scope}-${crypto.randomUUID()}` }
function canonicalId(value: string | null | undefined) { return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null }
function dateTimeStart(date: string) { return `${date}T00:00:00.000Z` }
function dateTimeEnd(date: string) { return `${date}T23:59:59.999Z` }

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
    const seenCursors = new Set<string>()
    const basePath = path
    let nextPath = basePath
    for (let page = 0; page < 100; page += 1) {
      const response = await this.client.getWithMeta(nextPath, schema)
      items.push(...response.data.items)
      const cursor = response.headers.get("x-next-cursor") ?? response.data.nextCursor
      if (!cursor) return items
      if (seenCursors.has(cursor)) throw new Error("Сервер повторил курсор списка программ")
      seenCursors.add(cursor)
      nextPath = `${basePath}&cursor=${encodeURIComponent(cursor)}`
    }
    throw new Error("Не удалось загрузить все программы")
  }
}
