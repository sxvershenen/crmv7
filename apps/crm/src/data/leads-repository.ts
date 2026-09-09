import type { Lead, LeadQuery, LeadSortKey } from "@app/entities/leads"
import { leadsFixture } from "@app/fixtures/leads"
import { LeadDtoSchema, type LeadDto, type LeadStatus } from "@crm/contracts/leads"
import { SessionUserSchema } from "@crm/contracts/auth"
import { z } from "zod"
import { apiClient, type ApiClientError } from "@app/lib/api-client"
import { useFixtureData } from "@app/lib/data-mode"

export interface LeadRepository {
  assignSelf(id: string): Promise<Lead>
  get(id: string): Promise<Lead | null>
  list(query: LeadQuery): Promise<Lead[]>
  save(lead: Lead): Promise<Lead>
}

const collator = new Intl.Collator("ru-RU", { numeric: true, sensitivity: "base" })

const sortValue: Record<LeadSortKey, (lead: Lead) => string> = {
  id: (lead) => lead.id,
  client: (lead) => lead.clientName,
  direction: (lead) => lead.direction,
  planned: (lead) => lead.plannedAt,
  nextContact: (lead) => lead.nextContactAt,
  assignee: (lead) => lead.assignees[0]?.name ?? "",
}

export function filterAndSortLeads(data: Lead[], query: LeadQuery): Lead[] {
  const result = data.filter((lead) => {
    if (query.scope === "mine" && !lead.assignedToMe) return false
    if (query.scope === "overdue" && !lead.overdue) return false
    if (query.stage !== "all" && lead.stage !== query.stage) return false
    if (query.stage === "all" && lead.stage === "archive") return false
    if (query.direction !== "all" && lead.direction !== query.direction) return false
    if (query.source !== "all" && lead.source !== query.source) return false
    if (query.promo !== "all" && lead.promo !== query.promo) return false
    if (query.utm !== "all" && lead.utm !== query.utm) return false
    return true
  })

  const sign = query.sort.direction === "asc" ? 1 : -1
  return result.sort((left, right) => collator.compare(sortValue[query.sort.key](left), sortValue[query.sort.key](right)) * sign)
}

export class FixtureLeadRepository implements LeadRepository {
  private records = structuredClone(leadsFixture)

  async get(id: string): Promise<Lead | null> {
    return Promise.resolve(structuredClone(this.records.find((lead) => lead.id === id) ?? null))
  }

  async list(query: LeadQuery): Promise<Lead[]> {
    return Promise.resolve(filterAndSortLeads(structuredClone(this.records), query))
  }

  async assignSelf(id: string) {
    const lead = this.records.find((item) => item.id === id)
    if (!lead) throw new Error("Заявка не найдена")
    if (!lead.assignees.some((assignee) => assignee.id === "demo-manager")) lead.assignees.push({ id: "demo-manager", initials: "МК", name: "Марина Кириллова", colorClass: "bg-sky-100 text-sky-700" })
    lead.assignedToMe = true
    return structuredClone(lead)
  }

  async save(lead: Lead): Promise<Lead> {
    const index = this.records.findIndex((item) => item.id === lead.id)
    if (index >= 0) this.records[index] = structuredClone(lead)
    else this.records.unshift(structuredClone(lead))
    return Promise.resolve(structuredClone(lead))
  }
}

const stageToApi: Record<Lead["stage"], LeadStatus> = { new: "new", work: "in_progress", waiting: "waiting", success: "success", rejected: "rejected", archive: "archived" }
function stageFromApi(status: LeadStatus): Lead["stage"] { return status === "in_progress" ? "work" : status === "archived" ? "archive" : status === "spam" ? "rejected" : status }

export class ApiLeadRepository implements LeadRepository {
  private readonly records = new Map<string, LeadDto>()
  private currentUserId: string | null = null
  constructor(private readonly client: Pick<typeof apiClient, "get" | "getWithMeta" | "patch" | "post"> = apiClient) {}

  async list(query: LeadQuery) {
    const userId = query.scope === "mine" ? await this.userId() : null
    const params = new URLSearchParams({ archived: String(query.stage === "archive"), limit: "100", order: query.sort.key === "nextContact" ? "nextContactAsc" : query.sort.key === "planned" ? "desiredStartAsc" : "createdDesc" })
    if (query.stage !== "all" && query.stage !== "archive") params.set("status", stageToApi[query.stage])
    if (query.direction !== "all") params.set("direction", query.direction)
    if (query.source !== "all") params.set("source", query.source)
    if (userId) params.set("assigneeId", userId)
    const dtos: LeadDto[] = []
    let cursor: string | null = null
    for (let page = 0; page < 100; page += 1) {
      if (cursor) params.set("cursor", cursor); else params.delete("cursor")
      const response = await this.client.getWithMeta(`/leads?${params.toString()}`, LeadDtoSchema.array())
      dtos.push(...response.data)
      cursor = response.headers.get("x-next-cursor")
      if (!cursor) break
      if (page === 99) throw new Error("Не удалось загрузить все заявки")
    }
    return filterAndSortLeads(dtos.map((dto) => this.remember(dto, userId)), query)
  }

  async assignSelf(id: string) {
    const current = this.records.get(id) ?? await this.client.get(`/leads/${encodeURIComponent(id)}`, LeadDtoSchema)
    const assigned = await this.client.post(`/leads/${encodeURIComponent(id)}/assign-self`, { version: current.version }, LeadDtoSchema)
    return this.remember(assigned, await this.userId())
  }

  async get(id: string) {
    try { return this.remember(await this.client.get(`/leads/${encodeURIComponent(id)}`, LeadDtoSchema), await this.userId()) }
    catch (error) { if (error instanceof Error && "code" in error && (error as ApiClientError).code === "NOT_FOUND") return null; throw error }
  }

  async save(lead: Lead) {
    if (lead.id === "new") {
      const created = await this.client.post("/leads", this.payload(lead), LeadDtoSchema)
      return this.remember(created, await this.userId())
    }
    let current = this.records.get(lead.id) ?? await this.client.get(`/leads/${encodeURIComponent(lead.id)}`, LeadDtoSchema)
    const desiredStatus = stageToApi[lead.stage]
    const updated = await this.client.patch(`/leads/${encodeURIComponent(lead.id)}`, { version: current.version, ...this.payload(lead) }, LeadDtoSchema)
    current = updated
    if (current.status !== desiredStatus) current = await this.client.post(`/leads/${encodeURIComponent(lead.id)}/transition`, { version: current.version, status: desiredStatus }, LeadDtoSchema)
    return this.remember(current, await this.userId())
  }

  private payload(lead: Lead) {
    const current = this.records.get(lead.id)
    return {
      customerId: current?.customerId ?? null, name: lead.clientName, phone: lead.phone || null,
      channel: lead.channel || current?.channel || null, direction: lead.direction || null, requestedItem: lead.requestedItem || null,
      desiredStartAt: lead.plannedAt || null, desiredEndAt: lead.desiredEndAt || current?.desiredEndAt || null, guestCount: lead.guestCount,
      comment: lead.comment ?? current?.comment ?? "", source: lead.source || null,
      utm: { ...(current?.utm ?? {}), ...(lead.utmData ?? {}), promo: lead.promo, source: lead.utm }, assignees: lead.assignees,
      nextContactAt: lead.nextContactAt || null,
    }
  }

  private remember(dto: LeadDto, currentUserId: string | null): Lead {
    this.records.set(dto.id, dto)
    const overdue = dto.nextContactAt !== null && new Date(dto.nextContactAt).getTime() < Date.now() && !["success", "rejected", "spam", "archived"].includes(dto.status)
    return {
      id: dto.id, version: dto.version, clientName: dto.name, phone: dto.phone ?? "", channel: dto.channel ?? "", comment: dto.comment,
      desiredEndAt: dto.desiredEndAt ?? "", utmData: dto.utm, requestedItem: dto.requestedItem ?? "Без уточнения", guestCount: dto.guestCount,
      direction: dto.direction ?? "Другое", source: dto.source ?? "Другое", promo: dto.utm.promo ?? "Без промокода", utm: dto.utm.source ?? "direct",
      plannedAt: dto.desiredStartAt ?? dto.createdAt, plannedLabel: formatLeadDate(dto.desiredStartAt ?? dto.createdAt),
      nextContactAt: dto.nextContactAt ?? "", nextContactLabel: dto.nextContactAt ? formatLeadDate(dto.nextContactAt) : "Не назначен",
      assignees: dto.assignees, assignedToMe: currentUserId !== null && dto.assignees.some((person) => person.id === currentUserId), overdue, stage: stageFromApi(dto.status),
    }
  }

  private async userId() {
    if (this.currentUserId) return this.currentUserId
    const response = await this.client.get("/auth/session", z.object({ user: SessionUserSchema }).strict())
    this.currentUserId = response.user.id
    return this.currentUserId
  }
}

function formatLeadDate(value: string) { return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short" }).format(new Date(value)) }

export const fixtureLeadRepository: LeadRepository = new FixtureLeadRepository()
export const leadRepository: LeadRepository = useFixtureData ? fixtureLeadRepository : new ApiLeadRepository()
