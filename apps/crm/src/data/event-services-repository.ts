import {
  EventServiceOfferingDossierSchema,
  EventServiceOfferingLookupResultSchema,
  EventServiceOfferingPrepareBodySchema,
  EventServiceOfferingPrepareResultSchema,
  EventServiceOfferingQuotePreviewBodySchema,
  EventServiceOfferingQuoteResultSchema,
  EventServiceOfferingSummarySchema,
  EventServiceOfferingCreateResultSchema,
  EventServiceRatePlanDraftSchema,
  EventServiceTemplateCreateBodySchema,
  EventServiceTemplateMutationBodySchema,
  EventServiceTemplateMutationResultSchema,
  EventServiceTemplateRegistryQuerySchema,
  EventServiceTemplateRegistryResponseSchema,
  EventServiceTemplateReopenBodySchema,
  EventServiceTemplateReopenResultSchema,
  BusinessCalendarListResponseSchema,
  HousePriceBookActivateBodySchema,
  HousePriceBookDraftCreateBodySchema,
  HousePriceBookDraftReplaceBodySchema,
  HousePriceBookScheduleBodySchema,
  InternalOfferingEditorSchema,
  OfferingPricingMutationResultSchema,
  PriceBookSchema,
  type EventServiceOfferingCreateResult,
  type EventServiceOfferingDossier,
  type EventServiceOfferingPrepareBody,
  type EventServiceOfferingQuotePreviewBody,
  type EventServiceOfferingQuoteResult,
  type EventServiceTemplateCreateBody,
  type EventServiceTemplateMutationBody,
  type EventServiceTemplateRegistryItem,
  type EventServiceTemplateRegistryQuery,
  type EventServiceTemplateRegistryResponse,
  type EventServiceTemplateReopenBody,
  type EventServiceOfferingSummary,
  type BusinessCalendarListResponse,
  type HousePriceBookActivateBody,
  type HousePriceBookDraftCreateBody,
  type HousePriceBookDraftReplaceBody,
  type HousePriceBookScheduleBody,
  type InternalOfferingEditor,
  type OfferingPricingMutationResult,
} from "@crm/contracts"

import { ApiClientError, apiClient } from "@app/lib/api-client"
import { useFixtureData } from "@app/lib/data-mode"

export type EventServiceTemplateResolution =
  | { resolution: "unprepared"; eventServiceTemplateId: string; eventServiceTemplateVersion: number }
  | { resolution: "ambiguous"; eventServiceTemplateId: string; eventServiceTemplateVersion: number; candidates: EventServiceOfferingSummary[] }
  | { resolution: "linked"; data: EventServiceEditorData }

export type EventServiceEditorData = {
  dossier: EventServiceOfferingDossier
  editor: InternalOfferingEditor
}

export interface EventServiceRepository {
  list(query?: Partial<EventServiceTemplateRegistryQuery>): Promise<EventServiceTemplateRegistryResponse>
  listActiveBusinessCalendars(): Promise<BusinessCalendarListResponse>
  getByTemplateId(templateId: string): Promise<EventServiceTemplateResolution>
  getByOfferingId(offeringId: string): Promise<EventServiceEditorData | null>
  create(body: EventServiceTemplateCreateBody): Promise<EventServiceOfferingCreateResult>
  updateTemplate(templateId: string, body: EventServiceTemplateMutationBody): Promise<ReturnType<typeof EventServiceTemplateMutationResultSchema.parse>>
  prepare(templateId: string, body: EventServiceOfferingPrepareBody): Promise<EventServiceEditorData>
  reopen(templateId: string, body: EventServiceTemplateReopenBody): Promise<ReturnType<typeof EventServiceTemplateReopenResultSchema.parse>>
  createDraftPriceBook(offeringId: string, body: HousePriceBookDraftCreateBody): Promise<OfferingPricingMutationResult>
  replaceDraftPriceBook(offeringId: string, priceBookId: string, body: HousePriceBookDraftReplaceBody): Promise<OfferingPricingMutationResult>
  activatePriceBook(offeringId: string, priceBookId: string, body: HousePriceBookActivateBody): Promise<OfferingPricingMutationResult>
  schedulePriceBook(offeringId: string, priceBookId: string, body: HousePriceBookScheduleBody): Promise<OfferingPricingMutationResult>
  previewQuote(offeringId: string, body: EventServiceOfferingQuotePreviewBody): Promise<EventServiceOfferingQuoteResult>
  getQuote(quoteId: string): Promise<EventServiceOfferingQuoteResult>
}

type EventServiceApiClient = Pick<typeof apiClient, "get" | "post" | "patch" | "request">

export class ApiEventServiceRepository implements EventServiceRepository {
  constructor(private readonly client: EventServiceApiClient = apiClient) {}

  list(input: Partial<EventServiceTemplateRegistryQuery> = {}) {
    const query = EventServiceTemplateRegistryQuerySchema.parse({ limit: 25, ...input })
    const params = new URLSearchParams({ limit: String(query.limit) })
    if (query.q) params.set("q", query.q)
    if (query.format) params.set("format", query.format)
    if (query.state) params.set("state", query.state)
    if (query.cursor) params.set("cursor", query.cursor)
    return this.client.get(`/event-services?${params.toString()}`, EventServiceTemplateRegistryResponseSchema)
  }

  listActiveBusinessCalendars() {
    return this.client.get("/business-calendars?state=active&limit=25", BusinessCalendarListResponseSchema)
  }

  async getByTemplateId(templateId: string): Promise<EventServiceTemplateResolution> {
    const result = await this.client.get(`/event-services/templates/${encodeURIComponent(templateId)}`, EventServiceOfferingLookupResultSchema)
    if (result.resolution === "unprepared") return result
    if (result.resolution === "ambiguous") return result
    const item = await this.findRegistryItem((candidate) => candidate.template.id === result.offering.eventServiceTemplateId)
    if (!item?.offering) throw new Error("Связанный формат мероприятия не найден в реестре")
    return { resolution: "linked", data: await this.loadLinked(item) }
  }

  async getByOfferingId(offeringId: string): Promise<EventServiceEditorData | null> {
    const item = await this.findRegistryItem((candidate) => candidate.offering?.offeringId === offeringId)
    return item?.offering ? this.loadLinked(item) : null
  }

  create(input: EventServiceTemplateCreateBody) {
    const body = EventServiceTemplateCreateBodySchema.parse(input)
    return this.client.post("/event-services", body, EventServiceOfferingCreateResultSchema)
  }

  updateTemplate(templateId: string, input: EventServiceTemplateMutationBody) {
    const body = EventServiceTemplateMutationBodySchema.parse(input)
    return this.client.patch(`/event-services/templates/${encodeURIComponent(templateId)}`, body, EventServiceTemplateMutationResultSchema)
  }

  async prepare(templateId: string, input: EventServiceOfferingPrepareBody) {
    const body = EventServiceOfferingPrepareBodySchema.parse(input)
    const result = await this.client.post(`/event-services/templates/${encodeURIComponent(templateId)}/prepare`, body, EventServiceOfferingPrepareResultSchema)
    const editor = await this.getOfferingEditor(result.offering.id)
    return { dossier: result, editor }
  }

  reopen(templateId: string, input: EventServiceTemplateReopenBody) {
    const body = EventServiceTemplateReopenBodySchema.parse(input)
    return this.client.post(`/event-services/templates/${encodeURIComponent(templateId)}/reopen`, body, EventServiceTemplateReopenResultSchema)
  }

  createDraftPriceBook(offeringId: string, input: HousePriceBookDraftCreateBody) {
    const body = HousePriceBookDraftCreateBodySchema.parse(input)
    return this.client.post(`/offerings/${encodeURIComponent(offeringId)}/price-books/drafts`, body, OfferingPricingMutationResultSchema)
  }

  replaceDraftPriceBook(offeringId: string, priceBookId: string, input: HousePriceBookDraftReplaceBody) {
    const body = HousePriceBookDraftReplaceBodySchema.parse(input)
    return this.client.request(`/offerings/${encodeURIComponent(offeringId)}/price-books/drafts/${encodeURIComponent(priceBookId)}`, { body, method: "PUT" }, OfferingPricingMutationResultSchema)
  }

  activatePriceBook(offeringId: string, priceBookId: string, input: HousePriceBookActivateBody) {
    const body = HousePriceBookActivateBodySchema.parse(input)
    return this.client.post(`/offerings/${encodeURIComponent(offeringId)}/price-books/${encodeURIComponent(priceBookId)}/activate`, body, OfferingPricingMutationResultSchema)
  }

  schedulePriceBook(offeringId: string, priceBookId: string, input: HousePriceBookScheduleBody) {
    const body = HousePriceBookScheduleBodySchema.parse(input)
    return this.client.post(`/offerings/${encodeURIComponent(offeringId)}/price-books/${encodeURIComponent(priceBookId)}/schedule`, body, OfferingPricingMutationResultSchema)
  }

  previewQuote(offeringId: string, input: EventServiceOfferingQuotePreviewBody) {
    const body = EventServiceOfferingQuotePreviewBodySchema.parse(input)
    return this.client.post(`/event-services/${encodeURIComponent(offeringId)}/quotes/preview`, body, EventServiceOfferingQuoteResultSchema)
  }

  getQuote(quoteId: string) {
    return this.client.get(`/event-services/quotes/${encodeURIComponent(quoteId)}`, EventServiceOfferingQuoteResultSchema)
  }

  private async getOfferingEditor(offeringId: string) {
    try {
      const editor = await this.client.get(`/offerings/${encodeURIComponent(offeringId)}/editor`, InternalOfferingEditorSchema)
      if (editor.offering.kind !== "event_service") throw new Error("Маршрут формата мероприятия получил предложение другого типа")
      return editor
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) throw new Error("Коммерческое предложение формата мероприятия не найдено")
      throw error
    }
  }

  private async loadLinked(item: EventServiceTemplateRegistryItem): Promise<EventServiceEditorData> {
    if (!item.offering) throw new Error("Коммерческое предложение формата мероприятия не подготовлено")
    const editor = await this.getOfferingEditor(item.offering.offeringId)
    const dossier = EventServiceOfferingDossierSchema.parse({
      offering: editor.offering,
      template: item.template,
      subjectVersion: editor.ownerVersions.subject.aggregateVersion,
      pricingVersion: editor.ownerVersions.pricing,
      addOnAssignmentsVersion: editor.ownerVersions.addOnAssignments,
      cmsReady: item.offering.cmsReady,
      publicReady: false,
      editorial: editor.editorial,
    })
    return { dossier, editor }
  }

  private async findRegistryItem(predicate: (item: EventServiceTemplateRegistryItem) => boolean): Promise<EventServiceTemplateRegistryItem | null> {
    let cursor: string | undefined
    const seen = new Set<string>()
    for (;;) {
      const page = await this.list({ limit: 100, ...(cursor ? { cursor } : {}) })
      const item = page.items.find(predicate)
      if (item) return item
      if (!page.nextCursor) return null
      if (seen.has(page.nextCursor)) throw new Error("Реестр форматов мероприятия вернул повторяющийся курсор")
      seen.add(page.nextCursor)
      cursor = page.nextCursor
    }
  }
}

type FixtureState = {
  items: EventServiceTemplateRegistryItem[]
  editors: Map<string, InternalOfferingEditor>
  quotes: Map<string, EventServiceOfferingQuoteResult>
}

const fixtureIds = {
  calendar: "11111111-1111-4111-8111-111111111111",
  template: "22222222-2222-4222-8222-222222222222",
  offering: "33333333-3333-4333-8333-333333333333",
  node: "44444444-4444-4444-8444-444444444444",
  revision: "55555555-5555-4555-8555-555555555555",
  quote: "66666666-6666-4666-8666-666666666666",
} as const

function fixtureNow() { return "2026-09-01T10:00:00.000Z" }
function fixtureTemplate(overrides: Partial<EventServiceTemplateRegistryItem["template"]> = {}) {
  return {
    archivedAt: null,
    code: "wedding_standard",
    createdAt: fixtureNow(),
    defaultDurationMinutes: 240,
    format: "wedding" as const,
    icon: "heart" as const,
    id: fixtureIds.template,
    maximumGuests: 80,
    minimumGuests: 10,
    preparationAfterMinutes: 30,
    preparationBeforeMinutes: 60,
    tone: "rose" as const,
    updatedAt: fixtureNow(),
    version: 1,
    ...overrides,
  }
}

function fixtureOffering(state: "draft" | "active" | "archived" = "active", overrides: Partial<InternalOfferingEditor["offering"]> = {}) {
  return {
    activePriceBookId: null,
    archivedAt: state === "archived" ? fixtureNow() : null,
    businessCalendarId: fixtureIds.calendar,
    code: "EVENT-WEDDING",
    createdAt: fixtureNow(),
    currency: "RUB" as const,
    fulfillment: { kind: "event_service" as const },
    id: fixtureIds.offering,
    internalComment: "",
    kind: "event_service" as const,
    operationalName: "Свадебное мероприятие",
    priceDisplayMode: "from" as const,
    salesMode: "quoted" as const,
    state,
    taxMode: "tax_included" as const,
    timezone: "Europe/Moscow",
    updatedAt: fixtureNow(),
    version: 1,
    ...overrides,
  }
}

function fixtureEditorial(offering: ReturnType<typeof fixtureOffering>) {
  return {
    source: { sourceKind: "catalog_offering" as const, sourceId: offering.id, sourceVersion: offering.version, createdAt: fixtureNow() },
    node: { id: fixtureIds.node, version: 1, kind: "event_detail" as const, status: "active" as const },
    currentRevision: { id: fixtureIds.revision, revision: 1, state: "draft" as const, path: `/drafts/event-services/${offering.code.toLocaleLowerCase()}`, title: `${offering.operationalName} — страница`, contentHash: "a".repeat(64) },
    latestPublished: null,
    publication: { eligible: false as const, blockers: ["offering_not_active" as const, "safe_public_projection_missing" as const] },
  }
}

function fixtureEditor(template = fixtureTemplate(), offering = fixtureOffering()): InternalOfferingEditor {
  return InternalOfferingEditorSchema.parse({
    offering,
    addOnTerms: null,
    addOnUsages: [],
    bindings: [{ id: "77777777-7777-4777-8777-777777777777", offeringId: offering.id, version: 1, target: { type: "event_service_template", id: template.id }, role: "primary", availabilityRequired: false, defaultQuantity: 1, defaultCapacityImpact: 0, preparationBeforeMinutes: template.preparationBeforeMinutes, preparationAfterMinutes: template.preparationAfterMinutes }],
    bindingTargets: [],
    priceBooks: [],
    addOnAssignments: [],
    addOnCatalog: [],
    editorial: fixtureEditorial(offering),
    ownerVersions: { catalog: offering.version, subject: { aggregateVersion: template.version, primary: { type: "event_service_template", id: template.id, version: template.version } }, pricing: 1, draftPriceBook: null, addOnAssignments: 1, editorial: { nodeId: fixtureIds.node, nodeVersion: 1, draftRevisionId: fixtureIds.revision, contentHash: "a".repeat(64) } },
    capabilities: { catalog: { canEdit: true, canChangeState: true, canArchive: true }, subject: { canEdit: true, canManageBindings: false }, pricing: { canView: true, canEditDraft: true, canActivate: true }, addOns: { canSearch: false, canCreate: false, canAssign: false }, editorial: { canEdit: false, canReview: true, canPublish: false }, canPreviewQuote: false },
  })
}

function fixtureSummary(template: ReturnType<typeof fixtureTemplate>, offering: ReturnType<typeof fixtureOffering>): EventServiceOfferingSummary {
  return EventServiceOfferingSummarySchema.parse({ offeringId: offering.id, offeringVersion: offering.version, state: offering.state, subjectVersion: template.version, pricingVersion: 1, addOnAssignmentsVersion: 1, eventServiceTemplateId: template.id, eventServiceTemplateVersion: template.version, cmsReady: true, publicReady: false, editorialNodeId: fixtureIds.node })
}

export class FixtureEventServiceRepository implements EventServiceRepository {
  private readonly state: FixtureState

  constructor(seed?: Partial<FixtureState>) {
    const template = fixtureTemplate()
    const offering = fixtureOffering()
    this.state = seed ? { items: seed.items ?? [], editors: seed.editors ?? new Map(), quotes: seed.quotes ?? new Map() } : { items: [{ template, offering: fixtureSummary(template, offering) }], editors: new Map([[offering.id, fixtureEditor(template, offering)]]), quotes: new Map() }
  }

  async list(input: Partial<EventServiceTemplateRegistryQuery> = {}) {
    const query = EventServiceTemplateRegistryQuerySchema.parse({ limit: 25, ...input })
    const items = this.state.items.filter((item) => !query.q || `${item.template.code} ${item.offering?.offeringId ?? ""}`.toLocaleLowerCase().includes(query.q.toLocaleLowerCase())).filter((item) => !query.format || item.template.format === query.format).filter((item) => !query.state || item.offering?.state === query.state)
    return { items: structuredClone(items.slice(0, query.limit)), nextCursor: null }
  }

  async listActiveBusinessCalendars() {
    return { items: [{ id: fixtureIds.calendar, code: "ru_default", version: 1, name: "Россия · стандарт", countryCode: "RU" as const, timezone: "Europe/Moscow", state: "active" as const, sourceVersion: "fixture", importedAt: fixtureNow(), updatedAt: fixtureNow(), coverage: null, contentHash: null }], nextCursor: null }
  }

  async getByTemplateId(templateId: string): Promise<EventServiceTemplateResolution> {
    const item = this.state.items.find((candidate) => candidate.template.id === templateId)
    if (!item) return { resolution: "unprepared", eventServiceTemplateId: templateId, eventServiceTemplateVersion: 1 }
    if (!item.offering) return { resolution: "unprepared", eventServiceTemplateId: item.template.id, eventServiceTemplateVersion: item.template.version }
    return { resolution: "linked", data: await this.loadLinked(item) }
  }

  async getByOfferingId(offeringId: string) {
    const item = this.state.items.find((candidate) => candidate.offering?.offeringId === offeringId)
    return item?.offering ? this.loadLinked(item) : null
  }

  async create(input: EventServiceTemplateCreateBody) {
    const body = EventServiceTemplateCreateBodySchema.parse(input)
    const template = fixtureTemplate({ id: crypto.randomUUID(), code: body.templateCode, format: body.format, icon: body.icon, tone: body.tone, defaultDurationMinutes: body.defaultDurationMinutes, minimumGuests: body.minimumGuests, maximumGuests: body.maximumGuests, preparationBeforeMinutes: body.preparationBeforeMinutes, preparationAfterMinutes: body.preparationAfterMinutes })
    const offering = fixtureOffering("draft", { id: crypto.randomUUID(), code: body.offeringCode, operationalName: body.operationalName, internalComment: body.internalComment, businessCalendarId: body.businessCalendarId, currency: body.currency, timezone: body.timezone, salesMode: body.salesMode, priceDisplayMode: body.priceDisplayMode, taxMode: body.taxMode, version: 1 })
    const editor = fixtureEditor(template, offering)
    editor.capabilities = { ...editor.capabilities, canPreviewQuote: false }
    this.state.items.unshift({ template, offering: fixtureSummary(template, offering) })
    this.state.editors.set(offering.id, editor)
    return this.dossier(template, editor)
  }

  async updateTemplate(templateId: string, input: EventServiceTemplateMutationBody) {
    const body = EventServiceTemplateMutationBodySchema.parse(input)
    const item = this.state.items.find((candidate) => candidate.template.id === templateId)
    if (!item) throw new Error("Формат мероприятия не найден")
    if (body.expectedSubjectVersion !== item.template.version) throw Object.assign(new Error("Версия формата изменилась"), { status: 409 })
    const offeringChanged = body.operationalName !== undefined || body.internalComment !== undefined
    const editor = item.offering ? this.state.editors.get(item.offering.offeringId) : null
    if (offeringChanged) {
      if (!editor) throw Object.assign(new Error("Event-service offering не найден"), { status: 409 })
      if (body.expectedOfferingVersion !== editor.offering.version) throw Object.assign(new Error("Версия коммерческой записи изменилась"), { status: 409 })
      editor.offering = { ...editor.offering, ...(body.operationalName === undefined ? {} : { operationalName: body.operationalName }), ...(body.internalComment === undefined ? {} : { internalComment: body.internalComment }), version: editor.offering.version + 1, updatedAt: new Date().toISOString() }
    }
    item.template = fixtureTemplate({ ...item.template, format: body.format, ...(body.icon === undefined ? {} : { icon: body.icon }), ...(body.tone === undefined ? {} : { tone: body.tone }), defaultDurationMinutes: body.defaultDurationMinutes, minimumGuests: body.minimumGuests, maximumGuests: body.maximumGuests, preparationBeforeMinutes: body.preparationBeforeMinutes, preparationAfterMinutes: body.preparationAfterMinutes, version: item.template.version + 1, updatedAt: new Date().toISOString() })
    if (editor) { editor.ownerVersions.catalog = editor.offering.version; editor.ownerVersions.subject.aggregateVersion = item.template.version; editor.ownerVersions.subject.primary = { type: "event_service_template", id: item.template.id, version: item.template.version }; editor.bindings = editor.bindings.map((binding) => ({ ...binding, preparationBeforeMinutes: item.template.preparationBeforeMinutes, preparationAfterMinutes: item.template.preparationAfterMinutes })) }
    if (item.offering) { item.offering.offeringVersion = editor?.offering.version ?? item.offering.offeringVersion; item.offering.eventServiceTemplateVersion = item.template.version; item.offering.subjectVersion = item.template.version }
    return { template: structuredClone(item.template), subjectVersion: item.template.version }
  }

  async prepare(templateId: string, input: EventServiceOfferingPrepareBody) {
    EventServiceOfferingPrepareBodySchema.parse(input)
    const item = this.state.items.find((candidate) => candidate.template.id === templateId)
    if (!item) throw new Error("Формат мероприятия не найден")
    if (item.offering) return this.loadLinked(item)
    const offering = fixtureOffering("draft", { id: crypto.randomUUID(), operationalName: item.template.code, code: item.template.code })
    const editor = fixtureEditor(item.template, offering)
    this.state.editors.set(offering.id, editor)
    item.offering = fixtureSummary(item.template, offering)
    return this.loadLinked(item)
  }

  async reopen(templateId: string, input: EventServiceTemplateReopenBody) {
    EventServiceTemplateReopenBodySchema.parse(input)
    const item = this.state.items.find((candidate) => candidate.template.id === templateId)
    if (!item) throw new Error("Формат мероприятия не найден")
    item.template = fixtureTemplate({ ...item.template, archivedAt: null, version: item.template.version + 1, updatedAt: new Date().toISOString() })
    return { template: structuredClone(item.template), subjectVersion: item.template.version }
  }

  async createDraftPriceBook(offeringId: string, input: HousePriceBookDraftCreateBody) { return this.mutatePriceBook(offeringId, input, null) }
  async replaceDraftPriceBook(offeringId: string, priceBookId: string, input: HousePriceBookDraftReplaceBody) { return this.mutatePriceBook(offeringId, input, priceBookId) }

  async activatePriceBook(offeringId: string, priceBookId: string, input: HousePriceBookActivateBody) {
    HousePriceBookActivateBodySchema.parse(input)
    const editor = this.editor(offeringId)
    const book = editor.priceBooks.find((candidate) => candidate.id === priceBookId)
    if (!book) throw new Error("Черновик прайс-листа не найден")
    editor.priceBooks = editor.priceBooks.map((candidate) => candidate.id === priceBookId ? { ...candidate, state: "active" as const, version: candidate.version + 1, activatedAt: new Date().toISOString() } : { ...candidate, state: candidate.state === "active" ? "retired" as const : candidate.state })
    editor.offering = { ...editor.offering, state: "active", activePriceBookId: priceBookId, version: editor.offering.version + 1 }
    editor.ownerVersions.pricing += 1
    editor.capabilities.canPreviewQuote = true
    return { priceBook: structuredClone(editor.priceBooks.find((candidate) => candidate.id === priceBookId)!), pricingVersion: editor.ownerVersions.pricing }
  }

  async schedulePriceBook(offeringId: string, priceBookId: string, input: HousePriceBookScheduleBody) {
    const parsed = HousePriceBookScheduleBodySchema.parse(input)
    const editor = this.editor(offeringId)
    const book = editor.priceBooks.find((candidate) => candidate.id === priceBookId)
    if (!book) throw new Error("Черновик прайс-листа не найден")
    const next = { ...book, state: "scheduled" as const, scheduledActivationAt: parsed.scheduledActivationAt, version: book.version + 1 }
    editor.priceBooks = editor.priceBooks.map((candidate) => candidate.id === priceBookId ? next : candidate)
    editor.ownerVersions.pricing += 1
    return { priceBook: structuredClone(next), pricingVersion: editor.ownerVersions.pricing }
  }

  async previewQuote(offeringId: string, input: EventServiceOfferingQuotePreviewBody) {
    const body = EventServiceOfferingQuotePreviewBodySchema.parse(input)
    const editor = this.editor(offeringId)
    const priceBook = editor.priceBooks.find((candidate) => candidate.id === editor.offering.activePriceBookId) ?? editor.priceBooks.find((candidate) => candidate.state === "active")
    const plan = priceBook?.ratePlans.find((candidate) => candidate.key === body.ratePlanKey)
    if (!priceBook || !plan) throw new Error("Для формата мероприятия нет активного пакета")
    const serviceDate = serviceDateInTimezone(body.startsAt, editor.offering.timezone)
    const extra = Math.max(0, body.guests - (plan.includedQuantity ?? 0))
    const extraAmount = extra * (plan.baseExtraUnitAmount ?? 0)
    const now = new Date()
    const preparationStartsAt = new Date(Date.parse(body.startsAt) - editor.bindings[0]!.preparationBeforeMinutes * 60_000).toISOString()
    const preparationEndsAt = new Date(Date.parse(body.endsAt) + editor.bindings[0]!.preparationAfterMinutes * 60_000).toISOString()
    const binding = editor.bindings[0]!
    const result: EventServiceOfferingQuoteResult = { quoteType: "event_service_preview", acceptanceReady: false, quoteId: crypto.randomUUID(), offeringId, eventServiceTemplateId: editor.ownerVersions.subject.primary?.id ?? fixtureIds.template, calculatedAt: now.toISOString(), validUntil: new Date(now.getTime() + 900_000).toISOString(), leadDays: null, currency: editor.offering.currency, inputs: { startsAt: body.startsAt, endsAt: body.endsAt, serviceDate, durationMinutes: Math.round((Date.parse(body.endsAt) - Date.parse(body.startsAt)) / 60_000), guests: body.guests, timezone: editor.offering.timezone, ratePlanKey: body.ratePlanKey }, lines: [{ kind: "base", label: plan.label, serviceDate, quantity: 1, unitAmount: { amountMinor: plan.baseAmount, currency: editor.offering.currency }, amount: { amountMinor: plan.baseAmount, currency: editor.offering.currency }, ratePlanId: plan.id ?? crypto.randomUUID(), ratePlanVersion: plan.version ?? 1, matchedRuleId: null, matchedRuleVersion: null, explanation: "flat_package" }, ...(extra > 0 ? [{ kind: "extra_unit" as const, label: "Дополнительные гости", serviceDate, quantity: extra, unitAmount: { amountMinor: plan.baseExtraUnitAmount ?? 0, currency: editor.offering.currency }, amount: { amountMinor: extraAmount, currency: editor.offering.currency }, ratePlanId: plan.id ?? crypto.randomUUID(), ratePlanVersion: plan.version ?? 1, matchedRuleId: null, matchedRuleVersion: null, explanation: "extra_guests" }] : [])], total: { amountMinor: plan.baseAmount + extraAmount, currency: editor.offering.currency }, provenance: { offeringVersion: editor.offering.version, subjectVersion: editor.ownerVersions.subject.aggregateVersion, eventServiceTemplateVersion: editor.ownerVersions.subject.primary?.version ?? 1, offeringBindingId: binding.id, offeringBindingVersion: binding.version, pricingVersion: editor.ownerVersions.pricing, addOnsVersion: editor.ownerVersions.addOnAssignments, priceBookId: priceBook.id, priceBookVersion: priceBook.version, businessCalendarId: editor.offering.businessCalendarId, businessCalendarVersion: 1, businessCalendarSourceVersion: "fixture", businessCalendarDateId: fixtureIds.calendar, businessCalendarDateVersion: 1, businessCalendarDateOverrideId: null, businessCalendarDateOverrideVersion: null, preparationBeforeMinutes: binding.preparationBeforeMinutes, preparationAfterMinutes: binding.preparationAfterMinutes, preparationStartsAt, preparationEndsAt, matchedRuleIds: [] }, immutableSnapshot: true }
    this.state.quotes.set(result.quoteId, result)
    return structuredClone(result)
  }

  async getQuote(quoteId: string) {
    const result = this.state.quotes.get(quoteId)
    if (!result) throw new Error("Снимок расчёта не найден")
    return structuredClone(result)
  }

  private editor(offeringId: string) { const editor = this.state.editors.get(offeringId); if (!editor) throw new Error("Предложение формата мероприятия не найдено"); return editor }
  private async loadLinked(item: EventServiceTemplateRegistryItem) { const editor = this.editor(item.offering!.offeringId); return { dossier: this.dossier(item.template, editor), editor: structuredClone(editor) } }
  private dossier(template: EventServiceTemplateRegistryItem["template"], editor: InternalOfferingEditor): EventServiceOfferingDossier { return EventServiceOfferingDossierSchema.parse({ offering: editor.offering, template, subjectVersion: editor.ownerVersions.subject.aggregateVersion, pricingVersion: editor.ownerVersions.pricing, addOnAssignmentsVersion: editor.ownerVersions.addOnAssignments, cmsReady: Boolean(editor.editorial), publicReady: false, editorial: editor.editorial }) }
  private async mutatePriceBook(offeringId: string, input: HousePriceBookDraftCreateBody | HousePriceBookDraftReplaceBody, priceBookId: string | null) {
    const editor = this.editor(offeringId)
    const expected = input.expectedPricingVersion
    if (expected !== editor.ownerVersions.pricing) throw Object.assign(new Error("Цены были изменены"), { status: 409 })
    const parsedPlans = input.ratePlans.map((plan) => EventServiceRatePlanDraftSchema.parse(plan))
    const now = new Date().toISOString()
    const current = priceBookId ? editor.priceBooks.find((candidate) => candidate.id === priceBookId) : null
    if (priceBookId && !current) throw new Error("Черновик прайс-листа не найден")
    const supersedesPriceBookId = "supersedesPriceBookId" in input ? input.supersedesPriceBookId : current?.supersedesPriceBookId ?? editor.offering.activePriceBookId
    const resolvedPriceBookId = current?.id ?? crypto.randomUUID()
    const priceBook = PriceBookSchema.parse({ id: resolvedPriceBookId, offeringId, version: (current?.version ?? 0) + 1, revision: current?.revision ?? 1, state: "draft", name: input.name, currency: editor.offering.currency, timezone: editor.offering.timezone, validFrom: input.validFrom, validToExclusive: input.validToExclusive, changeReason: input.changeReason, scheduledActivationAt: null, activatedAt: null, retiredAt: null, supersedesPriceBookId, ratePlans: parsedPlans.map((plan) => { const ratePlanId = plan.id ?? crypto.randomUUID(); return { ...plan, id: ratePlanId, priceBookId: resolvedPriceBookId, version: plan.id ? 2 : 1, rules: plan.rules.map((rule) => ({ ...rule, id: rule.id ?? crypto.randomUUID(), ratePlanId, version: 1 })) } }), createdAt: current?.createdAt ?? now, updatedAt: now })
    editor.priceBooks = current ? editor.priceBooks.map((candidate) => candidate.id === current.id ? priceBook : candidate) : [priceBook, ...editor.priceBooks]
    editor.ownerVersions.pricing += 1
    editor.ownerVersions.draftPriceBook = { id: priceBook.id, version: priceBook.version }
    return { priceBook: structuredClone(priceBook), pricingVersion: editor.ownerVersions.pricing }
  }
}

function serviceDateInTimezone(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value))
}

export const eventServiceRepository: EventServiceRepository = useFixtureData ? new FixtureEventServiceRepository() : new ApiEventServiceRepository()
