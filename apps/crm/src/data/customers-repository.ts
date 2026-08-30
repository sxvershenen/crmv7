import type { Customer, CustomerDuplicateRisk, CustomerQuery, CustomerSortKey } from "@app/entities/customers"
import { customersFixture } from "@app/fixtures/customers"
import { CustomerDtoSchema, type CustomerDto } from "@crm/contracts/customers"
import { apiClient, type ApiClientError } from "@app/lib/api-client"
import { useFixtureData } from "@app/lib/data-mode"

export interface CustomerRepository {
  list(query: CustomerQuery): Promise<Customer[]>
}

export interface CustomerEditorRepository {
  get(id: string): Promise<Customer | null>
  save(customer: Customer): Promise<Customer>
}

const collator = new Intl.Collator("ru-RU", { numeric: true, sensitivity: "base" })
const duplicateRiskOrder: Record<CustomerDuplicateRisk, number> = { none: 0, possible: 1, high: 2 }

const sortValue: Record<CustomerSortKey, (customer: Customer) => string | number> = {
  client: (customer) => customer.name,
  leads: (customer) => customer.leadCount,
  bookings: (customer) => customer.bookingCount,
  tasks: (customer) => customer.taskCount,
  turnover: (customer) => customer.turnover,
  debt: (customer) => customer.debt,
  duplicateRisk: (customer) => duplicateRiskOrder[customer.duplicateRisk],
  nextContact: (customer) => customer.nextContactAt ?? "9999-12-31",
  assignee: (customer) => customer.assignees[0]?.name ?? "",
}

export function selectCustomers(data: Customer[], query: CustomerQuery): Customer[] {
  const flags = new Set(query.flags)
  const sign = query.sort.direction === "asc" ? 1 : -1

  return data
    .filter((customer) => {
      if (query.type !== "all" && customer.type !== query.type) return false
      if (query.channel !== "all" && !customer.channels.includes(query.channel)) return false
      if (flags.has("archive") ? !customer.archived : customer.archived) return false
      if (flags.has("active") && !customer.hasActive) return false
      if (flags.has("debt") && customer.debt <= 0) return false
      if (flags.has("duplicates") && customer.duplicateRisk === "none") return false
      if (query.lastVisitDays !== null && customer.lastVisitDaysAgo > query.lastVisitDays) return false
      return true
    })
    .sort((left, right) => {
      const a = sortValue[query.sort.key](left)
      const b = sortValue[query.sort.key](right)
      const compared = typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b))
      return compared * sign
    })
}

export class FixtureCustomerRepository implements CustomerRepository, CustomerEditorRepository {
  private data = structuredClone(customersFixture)

  async list(query: CustomerQuery): Promise<Customer[]> {
    return Promise.resolve(selectCustomers(structuredClone(this.data), query))
  }

  async get(id: string): Promise<Customer | null> {
    return Promise.resolve(structuredClone(this.data.find((customer) => customer.id === id) ?? null))
  }

  async save(customer: Customer): Promise<Customer> {
    const next = structuredClone(customer)
    const index = this.data.findIndex((item) => item.id === customer.id)
    if (index >= 0) this.data[index] = next
    else this.data.unshift(next)
    return Promise.resolve(structuredClone(next))
  }
}

type VersionedCustomer = Customer & { version: number }

export class ApiCustomerRepository implements CustomerRepository, CustomerEditorRepository {
  private readonly records = new Map<string, CustomerDto>()
  constructor(private readonly client: Pick<typeof apiClient, "get" | "getWithMeta" | "patch" | "post"> = apiClient) {}

  async list(query: CustomerQuery) {
    const params = new URLSearchParams({ archived: String(query.flags.includes("archive")), limit: "100", order: "createdDesc" })
    if (query.type !== "all") params.set("type", query.type)
    if (query.flags.includes("debt")) params.set("hasDebt", "true")
    const dtos: CustomerDto[] = []
    let cursor: string | null = null
    for (let page = 0; page < 100; page += 1) {
      if (cursor) params.set("cursor", cursor); else params.delete("cursor")
      const response = await this.client.getWithMeta(`/customers?${params.toString()}`, CustomerDtoSchema.array())
      dtos.push(...response.data)
      cursor = response.headers.get("x-next-cursor")
      if (!cursor) break
      if (page === 99) throw new Error("Не удалось загрузить всех клиентов")
    }
    return selectCustomers(dtos.map((dto) => this.remember(dto)), query)
  }

  async get(id: string) {
    try { return this.remember(await this.client.get(`/customers/${encodeURIComponent(id)}`, CustomerDtoSchema)) }
    catch (error) { if (error instanceof Error && "code" in error && (error as ApiClientError).code === "NOT_FOUND") return null; throw error }
  }

  async save(customer: Customer) {
    if (customer.id === "new") {
      const created = await this.client.post("/customers", {
        name: customer.name, type: customer.type, phones: customer.phone ? [customer.phone] : [], channels: customer.channels,
        email: null, notes: "", duplicateRisk: customer.duplicateRisk, assignees: customer.assignees,
      }, CustomerDtoSchema)
      return this.remember(created)
    }
    const current = this.records.get(customer.id) ?? await this.client.get(`/customers/${encodeURIComponent(customer.id)}`, CustomerDtoSchema)
    if (customer.archived && !current.archived) {
      return this.remember(await this.client.post(`/customers/${encodeURIComponent(customer.id)}/archive`, { version: current.version }, CustomerDtoSchema))
    }
    const updated = await this.client.patch(`/customers/${encodeURIComponent(customer.id)}`, {
      version: current.version, name: customer.name, type: customer.type, phones: customer.phone ? [customer.phone] : [],
      channels: customer.channels, duplicateRisk: customer.duplicateRisk, assignees: customer.assignees,
    }, CustomerDtoSchema)
    return this.remember(updated)
  }

  private remember(dto: CustomerDto): VersionedCustomer {
    this.records.set(dto.id, dto)
    const lastVisitDaysAgo = dto.lastVisitAt ? Math.max(0, Math.floor((Date.now() - new Date(dto.lastVisitAt).getTime()) / 86_400_000)) : Number.MAX_SAFE_INTEGER
    return {
      id: dto.id, version: dto.version, name: dto.name, phone: dto.phone ?? "", type: dto.type,
      channels: dto.channels.filter((channel): channel is Customer["channels"][number] => ["Сайт", "Телефон", "Telegram", "VK", "Email"].includes(channel)),
      leadCount: dto.leadCount, activeLeadCount: dto.activeLeadCount, bookingCount: dto.bookingCount, futureBookingCount: dto.futureBookingCount,
      taskCount: dto.taskCount, turnover: dto.turnover / 100, debt: dto.debt / 100, duplicateRisk: dto.duplicateRisk,
      nextContactAt: dto.nextContactAt, nextContactLabel: dto.nextContactAt ? formatDate(dto.nextContactAt) : null,
      lastVisitDaysAgo, hasActive: dto.activeLeadCount > 0 || dto.futureBookingCount > 0, archived: dto.archived, assignees: dto.assignees,
    }
  }
}

function formatDate(value: string) { return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(new Date(value)) }

export const fixtureCustomerRepository: CustomerRepository & CustomerEditorRepository = new FixtureCustomerRepository()
export const customerRepository: CustomerRepository & CustomerEditorRepository = useFixtureData ? fixtureCustomerRepository : new ApiCustomerRepository()
