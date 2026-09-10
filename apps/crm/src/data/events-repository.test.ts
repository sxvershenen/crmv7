import { describe, expect, it, vi } from "vitest"

import type { CrmEvent, EventQuery } from "@app/entities/events"
import { ApiEventsRepository, FixtureEventsRepository, createEmptyEvent, selectEvents } from "./events-repository"

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

  it("keeps fixture quote snapshots versioned, expiring and prices assigned add-ons", async () => {
    const repository = new FixtureEventsRepository()
    const offering = (await repository.listCommercialOfferings()).items[0]
    if (!offering?.offering) throw new Error("Fixture event-service offering is missing")
    const editor = await repository.getCommercialOffering(offering.offering.offeringId)
    const ratePlanKey = editor?.priceBooks.find((book) => book.state === "active")?.ratePlans[0]?.key
    if (!ratePlanKey) throw new Error("Fixture event-service rate plan is missing")
    const saveDraft = async (addOnSelections: NonNullable<ReturnType<typeof createEmptyEvent>["addOnSelections"]> = [], guestCount = 1) => {
      const draft = createEmptyEvent()
      draft.guestCount = guestCount
      draft.pricingMode = "quote_required"
      draft.commercialOfferingId = offering.offering!.offeringId
      draft.ratePlanKey = ratePlanKey
      draft.addOnSelections = addOnSelections
      const saved = await repository.save(draft)
      return { saved, input: { ratePlanKey, currency: "RUB" as const, addOns: addOnSelections, resourceSelections: [] } }
    }

    const first = await saveDraft()
    const quote = await repository.quote(first.saved.id, first.input)
    const edited = await repository.save({ ...first.saved, clientComment: "Изменение после расчёта" })
    expect(edited.version).toBe((first.saved.version ?? 1) + 1)
    await expect(repository.acceptQuote(first.saved.id, quote.quoteId)).rejects.toThrow("устарел")

    const expiring = await saveDraft()
    const expiringQuote = await repository.quote(expiring.saved.id, expiring.input)
    const now = Date.now()
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(now + 16 * 60_000))
      await expect(repository.acceptQuote(expiring.saved.id, expiringQuote.quoteId)).rejects.toThrow("истёк")
    } finally {
      vi.useRealTimers()
    }

    const addOnSelections = [
      { assignmentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", quantity: 3 },
      { assignmentId: "ffffffff-ffff-4fff-8fff-ffffffffffff", quantity: 2 },
    ]
    const withAddOn = await saveDraft(addOnSelections, 3)
    const addOnQuote = await repository.quote(withAddOn.saved.id, withAddOn.input)
    expect(addOnQuote.provenance.addOns).toHaveLength(2)
    expect(addOnQuote.lines.filter((line) => line.kind === "addon")).toHaveLength(2)
    expect(addOnQuote.total.amountMinor).toBe(32_550)

    const invalidPerson = await saveDraft([
      { assignmentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", quantity: 1 },
      { assignmentId: "ffffffff-ffff-4fff-8fff-ffffffffffff", quantity: 2 },
    ], 3)
    await expect(repository.quote(invalidPerson.saved.id, invalidPerson.input)).rejects.toThrow("числом гостей")
  })

  it("quotes and accepts fixed fixture resources with conflict and cancellation semantics", async () => {
    const repository = new FixtureEventsRepository()
    const offering = (await repository.listCommercialOfferings()).items[0]
    if (!offering?.offering) throw new Error("Fixture event-service offering is missing")
    const editor = await repository.getCommercialOffering(offering.offering.offeringId)
    const ratePlanKey = editor?.priceBooks.find((book) => book.state === "active")?.ratePlans[0]?.key
    const resource = (await repository.listResources())[0]
    if (!ratePlanKey || !resource) throw new Error("Fixture quote resource is missing")

    const createQuotedResource = async (suffix: string) => {
      const draft = createEmptyEvent()
      draft.name = `Мероприятие с ресурсом ${suffix}`
      draft.startsAt = "2026-09-12T10:00:00.000Z"
      draft.endsAt = "2026-09-12T12:00:00.000Z"
      draft.guestCount = 36
      draft.pricingMode = "quote_required"
      draft.commercialOfferingId = offering.offering!.offeringId
      draft.ratePlanKey = ratePlanKey
      draft.resourceSelections = [{ resourceId: resource.id }]
      draft.resourceBookings = [{ id: `resource-booking-${suffix}`, resourceId: resource.id, resourceName: resource.name, startsAt: draft.startsAt, endsAt: draft.endsAt, guestCount: 36 }]
      const saved = await repository.save(draft)
      const input = { ratePlanKey, currency: "RUB" as const, addOns: [], resourceSelections: [{ resourceId: resource.id }] }
      return { saved, quote: await repository.quote(saved.id, input) }
    }

    expect(resource.id).toMatch(/^[0-9a-f-]{36}$/i)
    const first = await createQuotedResource("first")
    expect(first.quote.provenance.resourceSelections).toEqual([{ resourceId: resource.id, version: 1 }])
    const accepted = await repository.acceptQuote(first.saved.id, first.quote.quoteId)
    expect(accepted).toMatchObject({ status: "booked", acceptedQuote: { quoteId: first.quote.quoteId }, resourceSelections: [{ resourceId: resource.id }], resourceBookings: [{ resourceId: resource.id, guestCount: 1 }] })

    const conflicting = await createQuotedResource("conflict")
    await expect(repository.acceptQuote(conflicting.saved.id, conflicting.quote.quoteId)).rejects.toThrow("уже занят")

    await expect(repository.updateStatus(first.saved.id, "cancelled")).resolves.toMatchObject({ status: "cancelled" })
    await expect(repository.acceptQuote(conflicting.saved.id, conflicting.quote.quoteId)).resolves.toMatchObject({ status: "booked", resourceSelections: [{ resourceId: resource.id }] })
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
  const quotedEvent = { ...event, commercialOfferingId: "11111111-1111-4111-8111-111111111111", pricingMode: "quote_required", ratePlanKey: "standard", addOnSelections: [], resourceSelections: [], total: { amountMinor: 0, currency: "RUB" } }

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

  it("maps event editor fields to a versioned canonical patch", async () => {
    const patch = vi.fn(async () => event)
    const client = {
      get: vi.fn(async () => event),
      getWithMeta: vi.fn(async () => ({ data: { items: [event], nextCursor: null }, headers: new Headers(), status: 200 })),
      patch,
      post: vi.fn(),
    }
    const repository = new ApiEventsRepository(client as never)
    const editor = await repository.get("event-1")
    if (!editor) throw new Error("API event is missing")
    editor.name = "Новый тайминг"
    editor.total = 1250
    editor.clientComment = "Нужна детская зона"
    editor.scenarioStages = [{ id: "stage-1", name: "Встреча", durationMinutes: 30, comment: "" }]
    await repository.save(editor)

    expect(patch).toHaveBeenCalledWith("/events/event-1", expect.objectContaining({
      version: 2,
      name: "Новый тайминг",
      total: { amountMinor: 125000, currency: "RUB" },
      comment: "Нужна детская зона",
      scenario: [{ name: "Встреча", durationMinutes: 30, comment: "" }],
      operationId: expect.any(String),
      idempotencyKey: expect.any(String),
    }), expect.anything())
    const patchCall = patch.mock.calls[0] as unknown as [string, Record<string, unknown>] | undefined
    expect(patchCall?.[1] ?? {}).not.toHaveProperty("pricingMode")
  })

  it("reuses save command identity after a lost patch response", async () => {
    const committed = { ...event, version: 3, name: "Новый тайминг" }
    let eventReads = 0
    const patch = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(committed)
    const client = {
      get: vi.fn(async (path: string) => {
        if (path === "/events/event-1") return eventReads++ < 2 ? event : committed
        if (path.startsWith("/customers?")) return []
        if (path.startsWith("/resources/allocations")) return []
        if (path.startsWith("/resources?")) return []
        if (path.startsWith("/payments?")) return { items: [] }
        return event
      }),
      getWithMeta: vi.fn(),
      patch,
      post: vi.fn(),
    }
    const repository = new ApiEventsRepository(client as never)
    const editor = await repository.get("event-1")
    if (!editor) throw new Error("API event is missing")
    editor.name = "Новый тайминг"

    await expect(repository.save(editor)).rejects.toThrow("network")
    await expect(repository.save(editor)).resolves.toMatchObject({ id: "event-1", version: 3 })

    const first = patch.mock.calls[0]?.[1] as Record<string, unknown>
    const second = patch.mock.calls[1]?.[1] as Record<string, unknown>
    expect(first).toMatchObject({ version: 2, operationId: expect.any(String), idempotencyKey: expect.any(String) })
    expect(second).toMatchObject({ version: 2, operationId: first.operationId, idempotencyKey: first.idempotencyKey })
  })

  it("replays a committed create when the final save read loses its response", async () => {
    const created = { ...event, id: "44444444-4444-4444-8444-444444444444", version: 1, status: "planning" }
    let paymentReads = 0
    const post = vi.fn().mockResolvedValue(created)
    const client = {
      get: vi.fn(async (path: string) => {
        if (path.startsWith("/resources/allocations")) return []
        if (path.startsWith("/resources?")) return []
        if (path.startsWith("/payments?")) {
          paymentReads += 1
          if (paymentReads === 2) throw new Error("response lost")
          return { items: [] }
        }
        return created
      }),
      getWithMeta: vi.fn(),
      patch: vi.fn(),
      post,
    }
    const repository = new ApiEventsRepository(client as never)
    const draft = createEmptyEvent()

    await expect(repository.save(draft)).rejects.toThrow("response lost")
    await expect(repository.save(draft)).resolves.toMatchObject({ id: created.id, version: created.version })

    const first = post.mock.calls[0]?.[1] as Record<string, unknown>
    const second = post.mock.calls[1]?.[1] as Record<string, unknown>
    expect(second).toMatchObject({ operationId: first.operationId, idempotencyKey: first.idempotencyKey })
  })

  it("reuses quote command identity after a lost response", async () => {
    const quote = { quoteId: "22222222-2222-4222-8222-222222222222", eventId: "event-1", eventVersion: 2, total: { amountMinor: 125000, currency: "RUB" } }
    const post = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(quote)
    const client = { get: vi.fn().mockResolvedValueOnce(quotedEvent).mockResolvedValueOnce({ ...quotedEvent, version: 3 }), getWithMeta: vi.fn(), patch: vi.fn(), post }
    const repository = new ApiEventsRepository(client as never)
    await expect(repository.quote("event-1", { ratePlanKey: "standard", currency: "RUB", addOns: [], resourceSelections: [] })).rejects.toThrow("network")
    await expect(repository.quote("event-1", { ratePlanKey: "standard", currency: "RUB", addOns: [], resourceSelections: [] })).resolves.toEqual(quote)
    const first = post.mock.calls[0]?.[1] as Record<string, unknown>
    const second = post.mock.calls[1]?.[1] as Record<string, unknown>
    expect(first).toMatchObject({ eventId: "event-1", expectedEventVersion: 2, ratePlanKey: "standard", operationId: expect.any(String), idempotencyKey: expect.any(String) })
    expect(second).toMatchObject({ operationId: first.operationId, idempotencyKey: first.idempotencyKey })
  })

  it("reuses acceptance command identity after a lost response", async () => {
    const quote = { quoteId: "33333333-3333-4333-8333-333333333333" }
    const accepted = { ...quotedEvent, status: "booked", version: 3, acceptedQuote: quote }
    const post = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(accepted)
    const client = { get: vi.fn().mockResolvedValueOnce(quotedEvent).mockResolvedValueOnce({ ...quotedEvent, version: 3, status: "booked", acceptedQuote: quote }), getWithMeta: vi.fn(), patch: vi.fn(), post }
    const repository = new ApiEventsRepository(client as never)
    await expect(repository.acceptQuote("event-1", quote.quoteId)).rejects.toThrow("network")
    await expect(repository.acceptQuote("event-1", quote.quoteId)).resolves.toMatchObject({ status: "booked" })
    const first = post.mock.calls[0]?.[1] as Record<string, unknown>
    const second = post.mock.calls[1]?.[1] as Record<string, unknown>
    expect(first).toMatchObject({ version: 2, status: "booked", quoteAcceptance: { quoteSnapshotId: quote.quoteId }, operationId: expect.any(String), idempotencyKey: expect.any(String) })
    expect(second).toMatchObject({ operationId: first.operationId, idempotencyKey: first.idempotencyKey })
  })
})
