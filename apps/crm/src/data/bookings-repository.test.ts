import { describe, expect, it, vi } from "vitest"

import { ApiBookingRepository, FixtureBookingRepository, bookingItemsForApi, selectBookings } from "./bookings-repository"
import { bookingsFixture } from "@app/fixtures/bookings"

const baseQuery = {
  category: "all" as const,
  date: "2026-08-23",
  rangeEnd: "2026-08-23",
  resource: "all",
  source: "all",
  amountFrom: 0,
  debtFrom: 0,
  utm: "all",
  promo: "all",
  conflictOnly: false,
  overpayOnly: false,
  sort: { key: "arrival" as const, direction: "asc" as const },
}

const customerId = "10000000-0000-4000-8000-000000000001"
const resourceId = "10000000-0000-4000-8000-000000000002"
const itemId = "10000000-0000-4000-8000-000000000003"
const bookingId = "10000000-0000-4000-8000-000000000010"
function rawBookingDetail(version = 4, sourceLeadId: string | null = null) {
  return {
    id: bookingId, code: "B-10", version, customerId, clientName: "Клиент", phone: "+70000000000", resourceId, resourceName: "Дом", category: "houses",
    date: "2026-09-10", startAt: "2026-09-10T09:00:00.000Z", endAt: "2026-09-11T09:00:00.000Z", startHour: 9, endHour: 9, preparationEndHour: 10,
    guestCount: 2, status: "draft", lifecycleStatus: "draft", amount: 1_000_00, paid: 0, paymentState: "unpaid", source: "", utm: "", promo: "", sourceLeadId, assignees: [], itemId, hasConflict: false,
    customer: { id: customerId, name: "Клиент", phone: "+70000000000", email: null }, resource: { id: resourceId, code: "house", name: "Дом", category: "houses", capacity: 4 }, payments: [], note: null, comments: [], marketing: {}, leadLink: null,
    items: [{ id: itemId, type: "accommodation", resourceId, startAt: "2026-09-10T09:00:00.000Z", endAt: "2026-09-11T09:00:00.000Z", quantity: 2, price: { amountMinor: 1_000_00, currency: "RUB" }, discount: { amountMinor: 0, currency: "RUB" }, preparationMinutes: 45, quoteSnapshotId: null, addOns: [] }],
  }
}

describe("BookingRepository", () => {
  it("filters categories and keeps fixture access behind the boundary", async () => {
    const result = await new FixtureBookingRepository().list({ ...baseQuery, category: "houses" })
    expect(result.bookings.length).toBeGreaterThan(0)
    expect(result.bookings.every((booking) => booking.category === "houses")).toBe(true)
    expect(result.resources.every((resource) => resource.category === "houses")).toBe(true)
  })

  it("sorts cancelled agenda operations last", async () => {
    const result = await new FixtureBookingRepository().list(baseQuery)
    expect(result.operations.at(-1)?.status).toBe("cancelled")
  })

  it("supports conflict and useful table sort filters", () => {
    const result = selectBookings(bookingsFixture, { ...baseQuery, conflictOnly: true, sort: { key: "total", direction: "desc" } })
    expect(result).toHaveLength(1)
    expect(result[0]?.status).toBe("conflict")
  })

  it("keeps editor-only composition and payment data behind the repository boundary", async () => {
    const repository = new FixtureBookingRepository()
    const booking = await repository.get("2048")

    expect(booking?.positions).toHaveLength(1)
    expect(booking?.positions[0]?.resourceName).toBe("Дом «Сосна»")
    expect(booking?.comments.length).toBeGreaterThan(0)
    expect(booking?.payments.length).toBeGreaterThan(0)
    expect(booking?.marketing.utmCampaign).toBe("late_summer_2026")

    if (!booking) throw new Error("Fixture booking 2048 is missing")
    booking.positions[0]!.total = 31_000
    booking.clientMessage = "Позвонить за день до заезда"
    await repository.save(booking)

    expect((await repository.get("2048"))?.clientMessage).toBe("Позвонить за день до заезда")
    expect((await repository.list(baseQuery)).bookings.find((item) => item.id === "2048")?.amount).toBe(31_000)
  })

  it("persists fixture self-assignment through the repository boundary", async () => {
    const repository = new FixtureBookingRepository()
    const assigned = await repository.assignSelf("2055")

    expect(assigned.assignees).toEqual(expect.arrayContaining([expect.objectContaining({ id: "demo-manager" })]))
    expect((await repository.list(baseQuery)).bookings.find((item) => item.id === "2055")?.assignees).toEqual(expect.arrayContaining([expect.objectContaining({ id: "demo-manager" })]))
  })

  it("serializes datetime-local booking values as Moscow business time", async () => {
    const booking = await new FixtureBookingRepository().get("2048")
    if (!booking) throw new Error("Fixture booking 2048 is missing")
    booking.positions[0]!.startAt = "2026-09-10T10:15"
    booking.positions[0]!.endAt = "2026-09-10T12:45"

    const [item] = bookingItemsForApi(booking)

    expect(item).toMatchObject({
      startAt: "2026-09-10T07:15:00.000Z",
      endAt: "2026-09-10T09:45:00.000Z",
    })
  })

  it("round-trips the authoritative preparation buffer instead of resetting it", async () => {
    const get = vi.fn().mockResolvedValue(rawBookingDetail())
    const repository = new ApiBookingRepository({ client: { get, patch: vi.fn(), post: vi.fn() } } as never)

    const booking = await repository.get(bookingId)
    if (!booking) throw new Error("Booking is missing")

    expect(booking.positions[0]?.preparationMinutes).toBe(45)
    expect(bookingItemsForApi(booking)[0]?.preparationMinutes).toBe(45)
  })

  it("uses stable relation intent keys for retry and creates new keys after success", async () => {
    const leadId = "20000000-0000-4000-8000-000000000001"
    const response = { link: { id: "30000000-0000-4000-8000-000000000001", bookingId, leadId, method: "manual", linkedAt: "2026-09-09T10:00:00.000Z", linkedBy: null, unlinkedAt: null, unlinkedBy: null }, bookingVersion: 5 }
    const post = vi.fn().mockRejectedValueOnce(new Error("network uncertain")).mockResolvedValue(response)
    const repository = new ApiBookingRepository({ client: { get: vi.fn(), patch: vi.fn(), post } } as never)

    await expect(repository.linkLead(bookingId, leadId, 4)).rejects.toThrow("network uncertain")
    await repository.linkLead(bookingId, leadId, 4)
    await repository.linkLead(bookingId, leadId, 4)

    const first = post.mock.calls[0]?.[1]
    const retry = post.mock.calls[1]?.[1]
    const nextIntent = post.mock.calls[2]?.[1]
    expect(retry).toMatchObject({ operationId: first.operationId, idempotencyKey: first.idempotencyKey, expectedVersion: 4, leadId, method: "manual" })
    expect(nextIntent.operationId).not.toBe(first.operationId)
    expect(nextIntent.idempotencyKey).not.toBe(first.idempotencyKey)
  })

  it("exposes relation history and prevents generic save from swallowing a relation change", async () => {
    const leadId = "20000000-0000-4000-8000-000000000001"
    const history = { items: [] }
    const get = vi.fn().mockResolvedValueOnce(rawBookingDetail()).mockResolvedValueOnce(history)
    const patch = vi.fn()
    const repository = new ApiBookingRepository({ client: { get, patch, post: vi.fn() } } as never)
    const booking = await repository.get(bookingId)
    if (!booking) throw new Error("Booking is missing")
    booking.sourceLeadId = leadId

    await expect(repository.save(booking)).rejects.toThrow("Связь с заявкой ещё не сохранена")
    expect(patch).not.toHaveBeenCalled()
    await expect(repository.leadLinkHistory(bookingId)).resolves.toEqual(history)
    expect(get).toHaveBeenLastCalledWith(`/bookings/${bookingId}/lead-link/history`, expect.anything())
  })

  it("sends unlink as an explicit versioned command", async () => {
    const post = vi.fn().mockResolvedValue({ link: null, bookingVersion: 6 })
    const repository = new ApiBookingRepository({ client: { get: vi.fn(), patch: vi.fn(), post } } as never)

    await expect(repository.unlinkLead(bookingId, 5)).resolves.toEqual({ link: null, bookingVersion: 6 })

    expect(post).toHaveBeenCalledWith(`/bookings/${bookingId}/lead-link/unlink`, {
      expectedVersion: 5,
      operationId: expect.any(String),
      idempotencyKey: expect.stringContaining("booking-lead-unlink-"),
    }, expect.anything())
  })

  it("sends expectedVersion and idempotency metadata to the booking assignment endpoint", async () => {
    const detail = {
      id: "B-1", code: "B-1", version: 4, customerId: null, clientName: "Клиент", phone: "", resourceId: null, resourceName: "Без ресурса", category: "other",
      date: "2026-08-23", startAt: "2026-08-23T10:00:00.000Z", endAt: "2026-08-23T12:00:00.000Z", startHour: 10, endHour: 12, preparationEndHour: 13,
      guestCount: 1, status: "confirmed", lifecycleStatus: "confirmed", amount: 100, paid: 0, paymentState: "unpaid", source: "", utm: "", promo: "", sourceLeadId: null, assignees: [], itemId: null, hasConflict: false,
      customer: null, resource: null, items: [], payments: [], note: null, comments: [], marketing: {}, leadLink: null,
    }
    const updated = { ...detail, version: 5, assignees: [{ id: "user-1", initials: "М", name: "Марина" }] }
    const get = vi.fn().mockResolvedValueOnce(detail).mockResolvedValueOnce(updated)
    const post = vi.fn().mockResolvedValue({})
    const repository = new ApiBookingRepository({ client: { get, patch: vi.fn(), post } } as never)

    await repository.assignSelf("B-1")

    expect(post).toHaveBeenCalledWith("/bookings/B-1/assign-self", {
      expectedVersion: 4,
      operationId: expect.any(String),
      idempotencyKey: expect.stringContaining("booking-assign-"),
    }, expect.anything())
    expect(get).toHaveBeenCalledTimes(2)
  })

  it("confirms a draft booking through the lifecycle API and accepts its composite quote", async () => {
    const customerId = "10000000-0000-4000-8000-000000000001"
    const resourceId = "10000000-0000-4000-8000-000000000002"
    const itemId = "10000000-0000-4000-8000-000000000003"
    const quoteSnapshotId = "10000000-0000-4000-8000-000000000004"
    const assignmentId = "10000000-0000-4000-8000-000000000005"
    const rawDetail = (version: number, lifecycleStatus: "draft" | "confirmed") => ({
      id: "10000000-0000-4000-8000-000000000010", code: "B-10", version, customerId, clientName: "Клиент", phone: "+70000000000", resourceId, resourceName: "Дом", category: "houses",
      date: "2026-09-10", startAt: "2026-09-10T09:00:00.000Z", endAt: "2026-09-11T09:00:00.000Z", startHour: 9, endHour: 9, preparationEndHour: 10,
      guestCount: 2, status: lifecycleStatus, lifecycleStatus, amount: 11_500_00, paid: 0, paymentState: "unpaid", source: "", utm: "", promo: "", sourceLeadId: null, assignees: [], itemId, hasConflict: false,
      customer: null, resource: { id: resourceId, name: "Дом" }, payments: [], note: null, comments: [], marketing: {}, leadLink: null,
      items: [{ id: itemId, type: "accommodation", resourceId, startAt: "2026-09-10T09:00:00.000Z", endAt: "2026-09-11T09:00:00.000Z", quantity: 2, price: { amountMinor: 11_500_00, currency: "RUB" }, discount: { amountMinor: 0, currency: "RUB" }, preparationMinutes: 0, quoteSnapshotId, addOns: [{ assignmentId, addOnOfferingId: "10000000-0000-4000-8000-000000000006", label: "Трансфер", serviceType: "quantity_service", quantity: 1, price: { amountMinor: 1_500_00, currency: "RUB" } }] }],
    })
    const get = vi.fn()
      .mockResolvedValueOnce(rawDetail(4, "draft"))
      .mockResolvedValueOnce(rawDetail(5, "draft"))
      .mockResolvedValueOnce(rawDetail(7, "confirmed"))
      .mockResolvedValueOnce(rawDetail(7, "confirmed"))
    const patch = vi.fn().mockResolvedValue({ version: 5 })
    const post = vi.fn()
      .mockResolvedValueOnce({ version: 6, status: "unconfirmed" })
      .mockResolvedValueOnce({ version: 7, status: "confirmed" })
    const repository = new ApiBookingRepository({ client: { get, patch, post } } as never)
    const booking = await repository.get("B-10")
    if (!booking) throw new Error("Booking fixture is missing")
    booking.status = "confirmed"

    const saved = await repository.save(booking)

    expect(saved.lifecycleStatus).toBe("confirmed")
    expect(post).toHaveBeenNthCalledWith(2, expect.stringContaining("/transition"), expect.objectContaining({
      expectedVersion: 6,
      status: "confirmed",
      quoteAcceptances: [{ bookingItemId: itemId, quoteSnapshotId }],
    }), expect.anything())
  })
})
