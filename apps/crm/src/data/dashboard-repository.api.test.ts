import { describe, expect, it, vi } from "vitest"

import type { DashboardItem } from "@app/entities/dashboard"

import { ApiDashboardRepository } from "./dashboard-repository"

describe("ApiDashboardRepository", () => {
  it("aggregates dashboard sections from the authoritative CRM endpoints", async () => {
    const get = vi.fn(async (path: string) => {
      if (path.startsWith("/auth/session")) return { user: { id: "user-1" } }
      if (path.startsWith("/tasks")) return [{ id: "T-1", entityId: "task-entity", title: "Просроченная задача", dueAt: "2026-08-29T10:00:00+03:00", status: "open", assignees: [], details: "" }]
      if (path.startsWith("/leads")) return [{ id: "L-1", name: "Новая заявка", phone: null, requestedItem: null, desiredStartAt: null, nextContactAt: null, guestCount: 0, status: "new", createdAt: "2026-08-30T09:00:00+03:00", assignees: [] }]
      if (path.startsWith("/bookings/projection")) return { bookings: [], operations: [], resources: [], window: {} }
      if (path.startsWith("/events")) return { items: [{ id: "event-1", name: "Мероприятие", startsAt: "2026-08-30T15:00:00+03:00", guestCount: 4, requiresAction: true, assigneeIds: [] }], nextCursor: null }
      if (path.startsWith("/programs/occurrences")) return { items: [{ id: "program-1", name: "Программа", startsAt: "2026-08-30T16:00:00+03:00", participantCount: 3, registrationCount: 2, assigneeIds: [] }], nextCursor: null }
      throw new Error(`Unexpected dashboard request: ${path}`)
    })
    const repository = new ApiDashboardRepository({ client: { get }, now: () => new Date("2026-08-30T12:00:00+03:00") } as never)

    const data = await repository.getOverview("all")
    const items = [...data.attention, ...data.today].flatMap((section) => section.items)

    expect(get).toHaveBeenCalledTimes(5)
    expect(get).toHaveBeenCalledWith(expect.stringContaining("/tasks?"), expect.anything())
    expect(get).toHaveBeenCalledWith(expect.stringContaining("/leads?"), expect.anything())
    expect(get).toHaveBeenCalledWith(expect.stringContaining("/bookings/projection?"), expect.anything())
    expect(get).toHaveBeenCalledWith(expect.stringContaining("/events?"), expect.anything())
    expect(get).toHaveBeenCalledWith(expect.stringContaining("/programs/occurrences?"), expect.anything())
    expect(items.map((item) => item.title)).toEqual(expect.arrayContaining(["Просроченная задача", "#L-1 · Новая заявка", "Мероприятие", "Программа"]))
    expect(data.attention.find((section) => section.id === "overdue-tasks")?.items[0]).toMatchObject({ href: "/tasks/T-1", badge: { label: "Просрочено" } })
    expect(data.today.find((section) => section.id === "events")?.items[0]?.contentSummary).toEqual({ value: "Мероприятие", peopleCount: 4 })
  })

  it("uses the session identity to project the mine scope", async () => {
    const get = vi.fn(async (path: string) => {
      if (path.startsWith("/auth/session")) return { user: { id: "user-1" } }
      if (path.startsWith("/tasks")) return []
      if (path.startsWith("/leads")) return []
      if (path.startsWith("/bookings/projection")) return { bookings: [], operations: [], resources: [], window: {} }
      if (path.startsWith("/events")) return { items: [], nextCursor: null }
      return { items: [], nextCursor: null }
    })
    const repository = new ApiDashboardRepository({ client: { get }, now: () => new Date("2026-08-30T12:00:00+03:00") } as never)

    await repository.getOverview("mine")

    expect(get).toHaveBeenCalledWith("/auth/session", expect.anything())
  })

  it("posts the authoritative version for supported self-assignment only", async () => {
    const post = vi.fn(async () => ({}))
    const repository = new ApiDashboardRepository({ client: { get: vi.fn(), post }, now: () => new Date("2026-08-30T12:00:00+03:00") } as never)
    const base: Omit<DashboardItem, "entityId" | "assignment"> = {
      id: "overdue-L-1", href: "/leads/L-1", title: "Lead", subtitle: "Нужна обработка", assignees: [], assignedToMe: false,
    }

    await repository.assign({ ...base, entityId: "L-1", assignment: { kind: "self", entityType: "lead", version: 3 } })
    await repository.assign({ ...base, id: "task-T-1", entityId: "T-1", href: "/tasks/T-1", assignment: { kind: "self", entityType: "task", version: 8 } })
    await repository.assign({ ...base, id: "booking-B-1", entityId: "B-1", href: "/bookings/B-1", assignment: { kind: "self", entityType: "booking", version: 13 } })

    expect(post).toHaveBeenNthCalledWith(1, "/leads/L-1/assign-self", { version: 3 }, expect.anything())
    expect(post).toHaveBeenNthCalledWith(2, "/tasks/T-1/assign-self", { version: 8 }, expect.anything())
    expect(post).toHaveBeenNthCalledWith(3, "/bookings/B-1/assign-self", { expectedVersion: 13, operationId: expect.any(String), idempotencyKey: expect.stringContaining("dashboard-booking-assign-") }, expect.anything())
    await expect(repository.assign({ ...base, entityId: "event-1", assignment: { kind: "unsupported", reason: "Назначение недоступно" } })).rejects.toThrow("Назначение недоступно")
    expect(post).toHaveBeenCalledTimes(3)
  })
})
