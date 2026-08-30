import { describe, expect, it } from "vitest"

import { FixtureBookingRepository, selectBookings } from "./bookings-repository"
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
})
