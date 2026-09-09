import type { Assignee } from "@crm/ui"
import {
  BookingProjectionResponseSchema,
  CustomerDtoSchema,
  LeadDtoSchema,
  ResourceDtoSchema,
  SessionUserSchema,
} from "@crm/contracts"
import { z } from "zod"

import type { BookingCategory } from "@app/entities/bookings"
import type { CustomerDuplicateRisk } from "@app/entities/customers"
import { bookingResourcesFixture, bookingsFixture } from "@app/fixtures/bookings"
import { customersFixture } from "@app/fixtures/customers"
import { eventAssigneesFixture } from "@app/fixtures/events"
import { leadsFixture } from "@app/fixtures/leads"
import { programAssigneesFixture } from "@app/fixtures/programs"
import { taskAssigneesFixture } from "@app/fixtures/tasks"
import { apiClient } from "@app/lib/api-client"
import { useFixtureData } from "@app/lib/data-mode"

export type AssigneeScope = "booking" | "customer" | "event" | "lead" | "program" | "task"

export type CustomerLookup = {
  duplicateRisk: CustomerDuplicateRisk
  id: string
  name: string
  phone: string
}

export type BookingLookup = {
  clientName: string
  date: string
  id: string
  phone: string
  resourceName: string
  sourceLeadId: string | null
}

export type LeadLookup = {
  clientName: string
  id: string
  phone: string
  plannedAt: string
  plannedLabel: string
  requestedItem: string
}

export type ResourceLookup = {
  category: Exclude<BookingCategory, "all">
  id: string
  name: string
}

export interface DirectoryRepository {
  listAssignees(scope: AssigneeScope): Promise<Assignee[]>
  listBookings(): Promise<BookingLookup[]>
  listCustomers(): Promise<CustomerLookup[]>
  listLeads(): Promise<LeadLookup[]>
  listResources(): Promise<ResourceLookup[]>
}

export type DirectoryData = {
  assignees: Record<AssigneeScope, Assignee[]>
  bookings: BookingLookup[]
  customers: CustomerLookup[]
  leads: LeadLookup[]
  resources: ResourceLookup[]
}

function uniqueAssignees(assignees: Assignee[]) {
  return [...new Map(assignees.map((person) => [person.id, person])).values()]
}

export class FixtureDirectoryRepository implements DirectoryRepository {
  async listAssignees(scope: AssigneeScope) {
    const source = scope === "booking"
      ? uniqueAssignees(bookingsFixture.flatMap((booking) => booking.assignees))
      : scope === "event"
        ? eventAssigneesFixture
        : scope === "program"
          ? programAssigneesFixture
          : taskAssigneesFixture
    return Promise.resolve(structuredClone(source))
  }

  async listBookings() {
    return Promise.resolve(structuredClone(bookingsFixture.map(({ clientName, date, id, phone, resourceName, sourceLeadId }) => ({ clientName, date, id, phone, resourceName, sourceLeadId }))))
  }

  async listCustomers() {
    return Promise.resolve(structuredClone(customersFixture.map(({ duplicateRisk, id, name, phone }) => ({ duplicateRisk, id, name, phone }))))
  }

  async listLeads() {
    return Promise.resolve(structuredClone(leadsFixture.map(({ clientName, id, phone, plannedAt, plannedLabel, requestedItem }) => ({ clientName, id, phone, plannedAt, plannedLabel, requestedItem }))))
  }

  async listResources() {
    return Promise.resolve(structuredClone(bookingResourcesFixture.map(({ category, id, name }) => ({ category, id, name }))))
  }
}

type DirectoryApiClient = Pick<typeof apiClient, "get" | "getWithMeta">

const sessionResponseSchema = z.object({ user: SessionUserSchema }).strict()

export class ApiDirectoryRepository implements DirectoryRepository {
  private currentUser: Assignee | null = null

  constructor(private readonly client: DirectoryApiClient = apiClient) {}

  async listAssignees(scope: AssigneeScope) {
    void scope
    if (this.currentUser) return [structuredClone(this.currentUser)]
    const { user } = await this.client.get("/auth/session", sessionResponseSchema)
    const nameParts = user.name.trim().split(/\s+/u)
    this.currentUser = {
      id: user.id,
      name: user.name,
      initials: nameParts.slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("ru-RU") ?? "").join("") || "?",
      colorClass: "bg-sky-100 text-sky-700",
    }
    return [structuredClone(this.currentUser)]
  }

  async listBookings() {
    const today = new Date()
    const from = `${today.getUTCFullYear() - 5}-01-01`
    const to = `${today.getUTCFullYear() + 10}-12-31`
    const params = new URLSearchParams({
      date: from, rangeEnd: to, category: "all", resource: "all", source: "all",
      amountFrom: "0", debtFrom: "0", utm: "all", promo: "all", conflictOnly: "false",
      overpayOnly: "false", sort: "arrival", order: "asc",
    })
    const data = await this.client.get(`/bookings/projection?${params.toString()}`, BookingProjectionResponseSchema)
    return data.bookings.map((booking) => ({
      clientName: booking.clientName, date: booking.date, id: booking.id, phone: booking.phone,
      resourceName: booking.resourceName, sourceLeadId: booking.sourceLeadId,
    }))
  }

  async listCustomers() {
    const rows = await this.allPages("/customers", CustomerDtoSchema)
    return rows.map((customer) => ({
      duplicateRisk: customer.duplicateRisk, id: customer.id, name: customer.name, phone: customer.phone ?? "",
    }))
  }

  async listLeads() {
    const rows = await this.allPages("/leads", LeadDtoSchema)
    return rows.map((lead) => ({
      clientName: lead.name, id: lead.id, phone: lead.phone ?? "", plannedAt: lead.desiredStartAt ?? lead.createdAt,
      plannedLabel: lead.desiredStartAt ? formatDirectoryDate(lead.desiredStartAt) : "Дата не указана",
      requestedItem: lead.requestedItem ?? lead.direction ?? "Не указано",
    }))
  }

  async listResources() {
    const rows = await this.client.get("/resources?archived=false&limit=100", ResourceDtoSchema.array())
    return rows.flatMap((resource) => {
      const category = resourceCategory(resource.kind)
      return category ? [{ category, id: resource.id, name: resource.name }] : []
    })
  }

  private async allPages<T>(path: string, schema: z.ZodType<T>) {
    const rows: T[] = []
    let cursor: string | null = null
    for (let page = 0; page < 100; page += 1) {
      const params = new URLSearchParams({ archived: "false", limit: "100" })
      if (cursor) params.set("cursor", cursor)
      const response = await this.client.getWithMeta(`${path}?${params.toString()}`, schema.array())
      rows.push(...response.data)
      cursor = response.headers.get("x-next-cursor")
      if (!cursor) return rows
    }
    throw new Error("Не удалось загрузить справочник полностью")
  }
}

function formatDirectoryDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
}

function resourceCategory(kind: string): Exclude<BookingCategory, "all"> | null {
  const normalized = kind.toLocaleLowerCase("ru-RU")
  if (["house", "houses"].includes(normalized)) return "houses"
  if (["camping", "campground", "campground_own_tent_area"].includes(normalized)) return "camping"
  if (["campground_owned_tent"].includes(normalized)) return "tents"
  if (["tent", "tents"].includes(normalized)) return "tents"
  if (["bath"].includes(normalized)) return "bath"
  if (["venue", "venues"].includes(normalized)) return "venues"
  return null
}

export async function loadDirectoryData(repository: DirectoryRepository): Promise<DirectoryData> {
  const scopes: AssigneeScope[] = ["booking", "customer", "event", "lead", "program", "task"]
  const [assigneeLists, bookings, customers, leads, resources] = await Promise.all([
    Promise.all(scopes.map((scope) => repository.listAssignees(scope))),
    repository.listBookings(),
    repository.listCustomers(),
    repository.listLeads(),
    repository.listResources(),
  ])
  return {
    assignees: Object.fromEntries(scopes.map((scope, index) => [scope, assigneeLists[index] ?? []])) as Record<AssigneeScope, Assignee[]>,
    bookings,
    customers,
    leads,
    resources,
  }
}

export const fixtureDirectoryRepository: DirectoryRepository = new FixtureDirectoryRepository()
export const directoryRepository: DirectoryRepository = useFixtureData ? fixtureDirectoryRepository : new ApiDirectoryRepository()
