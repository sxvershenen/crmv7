import type { BookingEditorPosition } from "@app/entities/bookings"

/** Calculation identity excludes labels and returned prices. */
export function bookingPriceKey(position: BookingEditorPosition): string {
  return JSON.stringify([position.resourceId, position.category === "bath" ? position.startAt : position.startAt.slice(0, 10), position.category === "bath" ? position.endAt : position.endAt.slice(0, 10), position.guestCount, position.category === "bath" ? position.ratePlanKey ?? null : null,
    (position.addOns ?? []).map(({ assignmentId, quantity }) => [assignmentId, quantity]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))])
}
