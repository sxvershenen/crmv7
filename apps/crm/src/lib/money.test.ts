import { describe, expect, it } from "vitest"

import { majorToMinor, minorToMajor } from "./money"

describe("CRM money boundary", () => {
  it("converts integer minor units to RUB major units with cents", () => {
    expect(minorToMajor(400_000)).toBe(4_000)
    expect(minorToMajor(200_001)).toBe(2_000.01)
  })

  it("round-trips major units back to integer transport units", () => {
    expect(majorToMinor(4_000)).toBe(400_000)
    expect(majorToMinor(minorToMajor(200_001))).toBe(200_001)
  })
})
