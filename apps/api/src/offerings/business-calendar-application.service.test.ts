import { describe, expect, it } from "vitest"

import { BusinessCalendarApplicationService } from "./business-calendar-application.service.js"

describe("BusinessCalendarApplicationService guards", () => {
  const service = new BusinessCalendarApplicationService({} as never)

  it("fails closed for a calendar import with a missing or duplicate local day", () => {
    expect(() => (service as unknown as { assertCompleteCoverage(from: string, to: string, days: string[]): void }).assertCompleteCoverage("2027-01-01", "2027-01-04", ["2027-01-01", "2027-01-03"])).toThrow(/классифицировать каждый день/)
    expect(() => (service as unknown as { assertCompleteCoverage(from: string, to: string, days: string[]): void }).assertCompleteCoverage("2027-01-01", "2027-01-03", ["2027-01-01", "2027-01-01", "2027-01-02"])).toThrow(/повторяющиеся даты/)
  })

  it("does not permit a retired calendar to be changed or its coverage shortened", () => {
    expect(() => (service as unknown as { assertMutable(calendar: { state: string }): void }).assertMutable({ state: "retired" })).toThrow(/retired календарь/)
    expect(() => (service as unknown as { assertCoverageNotShrunk(calendar: { coverageFrom: string; coverageToExclusive: string }, from: string, to: string): void }).assertCoverageNotShrunk({ coverageFrom: "2027-01-01", coverageToExclusive: "2027-02-01" }, "2027-01-02", "2027-02-01")).toThrow(/нельзя сокращать/)
  })
})
