import { describe, expect, it } from "vitest"

import { businessDateTimeToIso, toBusinessDateTimeInput } from "./business-datetime"

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
})
