import type { FinancePeriod } from "@app/entities/finance"

const fixturePeriodRanges: Record<FinancePeriod, [string, string]> = { today: ["2026-08-24", "2026-08-24"], week: ["2026-08-18", "2026-08-24"], month: ["2026-08-01", "2026-08-24"], quarter: ["2026-06-01", "2026-08-31"] }

function fromIso(value: string) { return new Date(`${value}T12:00:00`) }
function toIso(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}` }
function shiftDays(value: string, days: number) { const date = fromIso(value); date.setDate(date.getDate() + days); return toIso(date) }
function monthStart(value: string, offset: number) { const date = fromIso(value); date.setMonth(date.getMonth() + offset, 1); return toIso(date) }

export function financePeriodRanges(today: string, fixtureMode: boolean): Record<FinancePeriod, [string, string]> {
  if (fixtureMode) return fixturePeriodRanges
  return {
    today: [today, today],
    week: [shiftDays(today, -6), today],
    month: [monthStart(today, 0), today],
    quarter: [monthStart(today, -2), today],
  }
}
