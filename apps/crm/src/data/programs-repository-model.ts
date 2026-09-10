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
import {
  ProgramCategoryDetailSchema,
  ProgramCategorySchema,
  ProgramOccurrenceDtoSchema,
  ProgramRegistrationDtoSchema,
  ProgramRegistrationQuoteResultSchema,
  ProgramTemplateDtoSchema,
} from "@crm/contracts"
import type {
  HousePriceBookDraftCreateBody,
  InternalOfferingEditor,
  OfferingPricingMutationResult,
  ProgramOfferingPrepareResult,
  ProgramOfferingQuoteResult,
} from "@crm/contracts"

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

export type FullProgramsRepository = ProgramsRepository & ProgramTemplateEditorRepository & ProgramRunEditorRepository & ProgramRegistrationEditorRepository & ProgramCategoryEditorRepository

export function createEmptyProgramCategory(): ProgramCategoryEditorRecord {
  return { id: "new", name: "Новая категория", description: "", icon: "campfire", tone: "amber", templateCount: 0, relatedTemplates: [] }
}

const collator = new Intl.Collator("ru-RU", { numeric: true, sensitivity: "base" })

const runStatusFromApi: Record<"draft" | "open" | "closed" | "completed" | "cancelled", ProgramRunStatus> = {
  draft: "draft", open: "registration", closed: "full", completed: "completed", cancelled: "cancelled",
}

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

function assigneeFromId(id: string) {
  return { id, initials: id.slice(0, 2).toUpperCase(), name: id, colorClass: "bg-slate-100 text-slate-700" }
}

export function mapTemplate(dto: ReturnType<typeof ProgramTemplateDtoSchema.parse>, category?: ProgramCategory): ProgramTemplate {
  return {
    id: dto.id, name: dto.name, version: dto.version, updatedAt: dto.updatedAt, categoryId: dto.categoryId ?? "uncategorized",
    categoryName: category?.name ?? dto.categoryId ?? "Без категории", categoryIcon: category?.icon ?? "sparkles", categoryTone: category?.tone ?? "violet", durationMinutes: dto.durationMinutes,
    participantLimit: dto.participantLimit, basePrice: dto.basePrice.amountMinor / 100, assignees: dto.assigneeIds.map(assigneeFromId), published: dto.published,
    nextRun: dto.nextOccurrence ? { id: dto.nextOccurrence.id, startsAt: dto.nextOccurrence.startsAt } : null, capabilities: dto.capabilities,
  }
}

export function mapCategory(dto: ReturnType<typeof ProgramCategorySchema.parse>): ProgramCategory {
  return { id: dto.id, version: dto.version, name: dto.name, description: dto.description, icon: dto.icon, tone: dto.tone, templateCount: dto.templateCount }
}

export function mapCategoryDetail(dto: ReturnType<typeof ProgramCategoryDetailSchema.parse>): ProgramCategoryEditorRecord {
  return { ...mapCategory(dto), relatedTemplates: dto.relatedTemplates.map((template) => ({ id: template.id, version: template.version, name: template.name, updatedAt: template.updatedAt, categoryId: dto.id, categoryName: dto.name, categoryIcon: dto.icon, categoryTone: dto.tone, durationMinutes: 0, participantLimit: 1, basePrice: 0, assignees: [], published: false, nextRun: template.nextRun })) }
}

export function mapRun(dto: ReturnType<typeof ProgramOccurrenceDtoSchema.parse>, template?: ProgramTemplate): ProgramRun {
  return {
    id: dto.id, version: dto.version, currency: dto.revenue.currency, templateId: dto.templateId, name: dto.name, categoryId: template?.categoryId ?? "uncategorized", categoryIcon: template?.categoryIcon ?? "sparkles",
    categoryTone: template?.categoryTone ?? "violet", startsAt: dto.startsAt, endsAt: dto.endsAt, participantCount: dto.participantCount, participantLimit: dto.participantLimit,
    registrationCount: dto.registrationCount, registrationLimit: dto.registrationLimit, status: runStatusFromApi[dto.status], revenue: dto.revenue.amountMinor / 100,
    paid: dto.paid.amountMinor / 100, assignees: dto.assigneeIds.map(assigneeFromId),
  }
}

export function mapRegistration(dto: ReturnType<typeof ProgramRegistrationDtoSchema.parse>, run?: ProgramRun): ProgramRegistration {
  return {
    id: dto.id, runId: dto.occurrenceId, programName: run?.name ?? dto.occurrenceId, programStartsAt: run?.startsAt ?? dto.createdAt, categoryIcon: run?.categoryIcon ?? "sparkles",
    categoryTone: run?.categoryTone ?? "violet", clientName: dto.customerId ?? "Без клиента", phone: dto.phone, total: dto.total.amountMinor / 100,
    debt: Math.max(0, dto.total.amountMinor - dto.paid.amountMinor) / 100, status: dto.status, comment: dto.comment, assignees: [],
  }
}

export function toApiRunEditorRegistration(dto: ReturnType<typeof ProgramRegistrationDtoSchema.parse>, run: ProgramRun): ProgramRunEditorRegistration {
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

export function quoteLines(lines: ReturnType<typeof ProgramRegistrationQuoteResultSchema.parse>["lines"]): ProgramRegistrationQuote["lines"] {
  return lines.map((line) => ({ kind: line.kind, label: line.label, quantity: line.quantity, amount: line.amount.amountMinor / 100 }))
}

export function toApiRegistrationEditorRecord(dto: ReturnType<typeof ProgramRegistrationDtoSchema.parse>, run: ProgramRun | null, payments: ProgramRegistrationEditorRecord["payments"] = [], availableAddOns: ProgramRegistrationAddOnOption[] = []): ProgramRegistrationEditorRecord {
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

export function toTemplateEditorRecord(template: ProgramTemplate, relatedRuns: ProgramRun[]): ProgramTemplateEditorRecord {
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

export function toListTemplate(record: ProgramTemplateEditorRecord): ProgramTemplate {
  const flat = structuredClone(record) as ProgramTemplateEditorRecord & Record<string, unknown>
  for (const key of ["description", "minimumParticipants", "registrationCloseHours", "relatedRuns", "stages"]) delete flat[key]
  return flat as unknown as ProgramTemplate
}

export function fixturePriceBook(offeringId: string, input: ProgramPriceBookDraftInput, state: "draft" | "active") {
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

export function toRunEditorRecord(run: ProgramRun, registrations: ProgramRegistration[]): ProgramRunEditorRecord {
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

export function toRunEditorRegistration(registration: ProgramRegistration, detail?: ProgramRunEditorRegistration): ProgramRunEditorRegistration {
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

export function toRegistrationEditorRecord(registration: ProgramRunEditorRegistration, run: ProgramRun | null): ProgramRegistrationEditorRecord {
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

export function registrationAddOns(editor: InternalOfferingEditor): ProgramRegistrationAddOnOption[] {
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

export function toListRun(record: ProgramRunEditorRecord): ProgramRun {
  const flat = structuredClone(record) as ProgramRunEditorRecord & Record<string, unknown>
  for (const key of ["comment", "registrations", "resourceBookings"]) delete flat[key]
  return flat as unknown as ProgramRun
}

export function toListRegistration(record: ProgramRunEditorRegistration): ProgramRegistration {
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

export function localDateTimeIso(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0")
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? "+" : "-"
  const absoluteOffset = Math.abs(offset)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`
}
