import { describe, expect, it } from "vitest"

import { formatPercentOf } from "./analytics-format"

describe("formatPercentOf", () => {
  it("formats a finite conversion", () => expect(formatPercentOf(1, 4)).toBe("25.0%"))
  it("does not invent a conversion without a denominator", () => expect(formatPercentOf(1, 0)).toBe("—"))
})
