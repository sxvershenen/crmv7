import type {
  ProgramRegistration,
  ProgramRegistrationEditorRecord,
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
import { apiClient } from "@app/lib/api-client"
import { ProgramOccurrenceDtoSchema, ProgramRegistrationDtoSchema, ProgramTemplateDtoSchema, SessionUserSchema } from "@crm/contracts"
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
}

export interface ProgramRunEditorRepository {
  getRun(id: string): Promise<ProgramRunEditorRecord | null>
  listRunResources(): Promise<ProgramRunResourceOption[]>
  listRunTemplates(): Promise<ProgramTemplate[]>
  saveRun(run: ProgramRunEditorRecord): Promise<ProgramRunEditorRecord>
}

export interface ProgramRegistrationEditorRepository {
  getRegistration(id: string): Promise<ProgramRegistrationEditorRecord | null>
  listRegistrationRuns(): Promise<ProgramRun[]>
  saveRegistration(registration: ProgramRegistrationEditorRecord): Promise<ProgramRegistrationEditorRecord>
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
    return Promise.resolve(bookingResourcesFixture.map(({ capacity, category, id, name }) => ({ capacity, category, id, name })))
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
    this.registrationEditorData.set(id, editor)
    return Promise.resolve(structuredClone(editor))
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
}

type ApiProgramsClient = Pick<typeof apiClient, "get" | "getWithMeta" | "patch" | "post">
type Page<T> = { items: T[]; nextCursor: string | null }

const templatePageSchema = z.object({ items: z.array(ProgramTemplateDtoSchema), nextCursor: z.string().nullable() }).strict()
const occurrencePageSchema = z.object({ items: z.array(ProgramOccurrenceDtoSchema), nextCursor: z.string().nullable() }).strict()
const registrationPageSchema = z.object({ items: z.array(ProgramRegistrationDtoSchema), nextCursor: z.string().nullable() }).strict()
const sessionResponseSchema = z.object({ user: SessionUserSchema }).strict()

const runStatusToApi: Record<ProgramRunStatus, "draft" | "open" | "closed" | "completed" | "cancelled"> = {
  draft: "draft", planned: "draft", registration: "open", full: "closed", completed: "completed", cancelled: "cancelled",
}
const runStatusFromApi: Record<"draft" | "open" | "closed" | "completed" | "cancelled", ProgramRunStatus> = {
  draft: "draft", open: "registration", closed: "full", completed: "completed", cancelled: "cancelled",
}

function operationId() { return crypto.randomUUID() }
function idempotencyKey(scope: string) { return `${scope}-${crypto.randomUUID()}` }
function dateTimeStart(date: string) { return `${date}T00:00:00.000Z` }
function dateTimeEnd(date: string) { return `${date}T23:59:59.999Z` }

function assigneeFromId(id: string) {
  return { id, initials: id.slice(0, 2).toUpperCase(), name: id, colorClass: "bg-slate-100 text-slate-700" }
}

function categoryFromId(id: string | null, icon: ProgramCategory["icon"] = "sparkles", tone: ProgramCategory["tone"] = "violet"): ProgramCategory {
  const value = id ?? "uncategorized"
  return { id: value, name: id ?? "Без категории", description: "", icon, tone, templateCount: 0 }
}

function mapTemplate(dto: ReturnType<typeof ProgramTemplateDtoSchema.parse>): ProgramTemplate {
  return {
    id: dto.id, name: dto.name, version: dto.version, updatedAt: dto.updatedAt, categoryId: dto.categoryId ?? "uncategorized",
    categoryName: dto.categoryId ?? "Без категории", categoryIcon: "sparkles", categoryTone: "violet", durationMinutes: dto.durationMinutes,
    participantLimit: dto.participantLimit, basePrice: dto.basePrice.amountMinor / 100, assignees: dto.assigneeIds.map(assigneeFromId), published: dto.published,
    nextRun: dto.nextOccurrence ? { id: dto.nextOccurrence.id, startsAt: dto.nextOccurrence.startsAt } : null,
  }
}

function mapRun(dto: ReturnType<typeof ProgramOccurrenceDtoSchema.parse>, template?: ProgramTemplate): ProgramRun {
  return {
    id: dto.id, templateId: dto.templateId, name: dto.name, categoryId: template?.categoryId ?? "uncategorized", categoryIcon: template?.categoryIcon ?? "sparkles",
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

export class ApiProgramsRepository implements ProgramsRepository {
  private readonly templates = new Map<string, ReturnType<typeof ProgramTemplateDtoSchema.parse>>()
  private readonly occurrences = new Map<string, ReturnType<typeof ProgramOccurrenceDtoSchema.parse>>()
  private readonly registrations = new Map<string, ReturnType<typeof ProgramRegistrationDtoSchema.parse>>()

  constructor(private readonly client: ApiProgramsClient = apiClient) {}

  async list(query: ProgramQuery): Promise<ProgramsDataset> {
    const [templates, occurrences, registrations] = await Promise.all([
      this.listAll("/programs/templates?archived=false&limit=100", templatePageSchema),
      this.listAll(`/programs/occurrences?archived=false&from=${encodeURIComponent(dateTimeStart(query.date))}&to=${encodeURIComponent(dateTimeEnd(query.rangeEnd))}&limit=100`, occurrencePageSchema),
      this.listAll(`/programs/registrations?archived=false&limit=100`, registrationPageSchema),
    ])
    for (const dto of templates) this.templates.set(dto.id, dto)
    for (const dto of occurrences) this.occurrences.set(dto.id, dto)
    for (const dto of registrations) this.registrations.set(dto.id, dto)
    const templateModels = templates.map(mapTemplate)
    const templateById = new Map(templateModels.map((template) => [template.id, template]))
    const runModels = occurrences.map((dto) => mapRun(dto, templateById.get(dto.templateId)))
    const runById = new Map(runModels.map((run) => [run.id, run]))
    const registrationModels = registrations.map((dto) => mapRegistration(dto, runById.get(dto.occurrenceId)))
    return selectPrograms({ categories: this.categories(templateModels), templates: templateModels, runs: runModels, registrations: registrationModels }, query)
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

  private async currentUser() { return (await this.client.get("/auth/session", sessionResponseSchema)).user }
  private async templateDto(id: string) { return this.templates.get(id) ?? await this.client.get(`/programs/templates/${encodeURIComponent(id)}`, ProgramTemplateDtoSchema) }
  private async occurrenceDto(id: string) { return this.occurrences.get(id) ?? await this.client.get(`/programs/occurrences/${encodeURIComponent(id)}`, ProgramOccurrenceDtoSchema) }
  private async registrationDto(id: string) { return this.registrations.get(id) ?? await this.client.get(`/programs/registrations/${encodeURIComponent(id)}`, ProgramRegistrationDtoSchema) }

  private categories(templates: ProgramTemplate[]) {
    const categories = new Map<string, ProgramCategory>()
    for (const template of templates) {
      const category = categories.get(template.categoryId) ?? categoryFromId(template.categoryId, template.categoryIcon, template.categoryTone)
      category.templateCount += 1
      categories.set(template.categoryId, category)
    }
    return [...categories.values()]
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
    customerId: null,
    internalComments: [{ id: `registration-comment-${registration.id}-1`, author: "Марина Кириллова", createdLabel: "Сегодня, 13:48", text: "Клиент подтвердил состав группы и получил памятку участника." }, { id: `registration-comment-${registration.id}-2`, author: "Алексей Воронов", createdLabel: "23 авг, 18:12", text: "Проверил промокод и итоговую стоимость." }],
    payments: registration.paid > 0 ? [{ amount: registration.paid, comment: "Предоплата", date: "2026-08-23", id: `registration-payment-${registration.id}-1`, kind: "payment", method: "card" }] : [],
    run: run ? structuredClone(run) : null,
  }
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

export const programsRepository: ProgramsRepository & ProgramTemplateEditorRepository & ProgramRunEditorRepository & ProgramRegistrationEditorRepository & ProgramCategoryEditorRepository = new FixtureProgramsRepository()
export const apiProgramsRepository: ProgramsRepository = new ApiProgramsRepository()

const demoAssignee = { id: "demo-manager", initials: "МК", name: "Марина Кириллова", colorClass: "bg-sky-100 text-sky-700" }
