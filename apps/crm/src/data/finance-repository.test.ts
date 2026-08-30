import { describe, expect, it } from "vitest"

import type { FinanceQuery } from "@app/entities/finance"
import { selectFinance } from "./finance-repository"

const baseQuery: FinanceQuery = { section: "summary", date: "2026-08-18", rangeEnd: "2026-08-24", type: "all", method: "all", refundsOnly: false, page: 1, pageSize: 5, sort: { key: "date", direction: "desc" } }

describe("FinanceRepository fixture adapter", () => {
  it("calculates summary from selected operations", () => {
    const data = selectFinance(baseQuery)
    expect(data.operations).toHaveLength(5)
    expect(data.pagination).toMatchObject({ page: 1, total: 8, totalPages: 2 })
    expect(data.summary.accrued).toBe(116900)
    expect(data.summary.paid).toBe(109000)
    expect(data.summary.refunds).toBe(7500)
  })

  it("combines category, method and operation filters", () => {
    const data = selectFinance({ ...baseQuery, section: "events", method: "transfer", type: "payment" })
    expect(data.operations.map((item) => item.id)).toEqual(["F-9041"])
  })

  it("sorts useful registry columns", () => {
    const data = selectFinance({ ...baseQuery, sort: { key: "amount", direction: "asc" } })
    expect(data.operations[0]?.id).toBe("F-9038")
  })

  it("paginates after filtering and sorting while keeping full-period aggregates", () => {
    const data = selectFinance({ ...baseQuery, page: 2 })
    expect(data.operations).toHaveLength(3)
    expect(data.pagination).toMatchObject({ page: 2, from: 6, to: 8, total: 8 })
    expect(data.summary.paid).toBe(109000)
  })
})
