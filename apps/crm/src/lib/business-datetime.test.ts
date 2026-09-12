import { describe, expect, it } from "vitest"

import { businessDate, businessDateTimeToIso, defaultBusinessDate, toBusinessDateTimeInput } from "./business-datetime"

describe("business datetime adapters", () => {
  it("round-trips Moscow wall-clock time independently of the browser timezone", () => {
    expect(businessDateTimeToIso("2026-09-10T10:15")).toBe("2026-09-10T07:15:00.000Z")
    expect(toBusinessDateTimeInput("2026-09-10T07:15:00.000Z")).toBe("2026-09-10T10:15")
  })

  it("keeps editor-local values stable and tolerates empty values", () => {
    expect(toBusinessDateTimeInput("2026-09-10T10:15")).toBe("2026-09-10T10:15")
    expect(businessDateTimeToIso("")).toBe("")
    expect(toBusinessDateTimeInput(null)).toBe("")
  })

  it("uses the current Moscow business date in API mode and keeps fixture baselines", () => {
    const nearMidnight = new Date("2026-09-10T21:30:00.000Z")
    expect(businessDate(nearMidnight)).toBe("2026-09-11")
    expect(defaultBusinessDate("2026-08-23", false, nearMidnight)).toBe("2026-09-11")
    expect(defaultBusinessDate("2026-08-23", true, nearMidnight)).toBe("2026-08-23")
  })
})
