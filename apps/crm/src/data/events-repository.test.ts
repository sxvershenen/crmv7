import { describe, expect, it, vi } from "vitest"

import type { CrmEvent, EventQuery } from "@app/entities/events"
import { ApiEventsRepository, FixtureEventsRepository, selectEvents } from "./events-repository"

const baseQuery: EventQuery = { status: "all", category: "all", assignee: "all", date: "2026-08-24", rangeEnd: "2026-08-30", nearest: false, requiresAction: false, unpaid: false, conflict: false, sort: { key: "date", direction: "asc" } }

describe("events repository", () => {
  it("filters, sorts and keeps fixture access behind repository boundary", async () => {
    const repository = new FixtureEventsRepository()
    const data = await repository.list({ ...baseQuery, category: "offsite" })
    expect(data.events).toHaveLength(2)
    expect(data.events.every((item) => item.categoryName === "Выездное мероприятие")).toBe(true)
    expect(data.counts.in_work).toBeGreaterThan(0)
  })

  it("uses a calendar-correct nearest cutoff across month boundary", () => {
    const item = (id: string, startsAt: string): CrmEvent => ({ id, name: id, categoryId: "offsite", categoryName: "Выездное мероприятие", categoryIcon: "bus", categoryTone: "sky", clientName: "Клиент", phone: "+7", startsAt, endsAt: startsAt, guestCount: 1, status: "in_work", total: 1, paid: 0, requiresAction: false, hasConflict: false, assignees: [] })
    const result = selectEvents([item("inside", "2026-09-02T12:00:00+03:00"), item("outside", "2026-09-03T12:00:00+03:00")], { ...baseQuery, date: "2026-08-30", rangeEnd: "2026-09-05", nearest: true })
    expect(result.map((event) => event.id)).toEqual(["inside"])
  })

  it("updates status and assigns a responsible person locally", async () => {
    const repository = new FixtureEventsRepository()
    const data = await repository.list(baseQuery)
    const available = data.assignees[0]!
    expect((await repository.assign("E-3114", available)).assignees).toEqual([available])
    expect((await repository.updateStatus("E-3114", "booked")).status).toBe("booked")
  })

  it("keeps editor-only event data behind the repository boundary", async () => {
    const repository = new FixtureEventsRepository()
    const event = await repository.get("E-3108")
    expect(event).not.toBeNull()
    event!.clientComment = "Без громкой музыки после 21:00"
    event!.scenarioStages.push({ id: "stage-1", name: "Встреча гостей", durationMinutes: 45, comment: "" })
    await repository.save(event!)

    expect((await repository.get("E-3108"))?.scenarioStages.some((stage) => stage.id === "stage-1")).toBe(true)
    expect((await repository.list(baseQuery)).events.find((item) => item.id === "E-3108")).not.toHaveProperty("scenarioStages")
    expect(await repository.listResources()).not.toHaveLength(0)
  })

  it("persists a category and propagates its presentation inside the fixture boundary", async () => {
    const repository = new FixtureEventsRepository()
    const category = await repository.getCategory("wedding")
    if (!category) throw new Error("Fixture category wedding is missing")
    expect(category.relatedEvents).toHaveLength(2)
    category.name = "Свадебное торжество"
    category.tone = "violet"
    await repository.saveCategory(category)
    const data = await repository.list(baseQuery)
    expect(data.categories.find((item) => item.id === "wedding")?.name).toBe("Свадебное торжество")
    expect(data.events.find((item) => item.categoryId === "wedding")?.categoryTone).toBe("violet")
    expect(data.categories[0]).not.toHaveProperty("relatedEvents")
  })
})

describe("events API adapter", () => {
  const capabilities = { canView: true, canCreate: true, canEdit: true, canArchive: true, canChangeStatus: true, canOverrideConflict: true }
  const event = { id: "event-1", version: 2, code: "E-1", name: "API event", categoryId: "corporate", customerId: "customer-1", phone: "+7", startsAt: "2026-08-25T10:00:00.000Z", endsAt: "2026-08-25T12:00:00.000Z", guestCount: 10, total: { amountMinor: 100000, currency: "RUB" }, paid: { amountMinor: 50000, currency: "RUB" }, status: "planning", comment: "", requiresAction: false, hasConflict: false, assigneeIds: [], scenario: [], archived: false, createdAt: "2026-08-24T08:00:00.000Z", updatedAt: "2026-08-24T08:00:00.000Z", capabilities }

  it("maps status/money and sends a canonical transition", async () => {
    const post = vi.fn(async () => ({ ...event, status: "booked", version: 3 }))
    const client = {
      get: vi.fn(async (path: string) => path === "/auth/session" ? { user: { id: "manager-1", name: "Manager", role: "manager", capabilities: { ...capabilities, canCreate: true } } } : event),
      getWithMeta: vi.fn(async () => ({ data: { items: [event], nextCursor: null }, headers: new Headers(), status: 200 })),
      patch: vi.fn(async () => event),
      post,
    }
    const repository = new ApiEventsRepository(client as never)
    const data = await repository.list(baseQuery)
    expect(data.events[0]).toMatchObject({ id: "event-1", status: "in_work", total: 1000, paid: 500, clientName: "customer-1" })
    await repository.updateStatus("event-1", "booked")
    expect(post).toHaveBeenCalledWith(expect.stringContaining("/events/event-1/transition"), expect.objectContaining({ version: 2, status: "booked", operationId: expect.any(String), idempotencyKey: expect.any(String) }), expect.anything())
  })
})
