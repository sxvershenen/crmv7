import { describe, expect, it } from "vitest"

import { buildLegacyOfferingBackfillReport } from "./legacy-offering-backfill.js"

describe("legacy offering backfill dry-run", () => {
  it("maps unambiguous house and campground resources without treating showOnSite as eligibility", () => {
    const report = buildLegacyOfferingBackfillReport({
      activeBusinessCalendarCount: 1,
      generatedAt: "2026-09-01T00:00:00.000Z",
      resources: [
        { id: "house", code: "HOUSE-1", kind: "house", name: "Дом", capacityMode: "fixed", capacityTotal: 4, settings: { showOnSite: true }, archived: false, alreadyBound: false },
        { id: "camp", code: "CAMP-1", kind: "campground", name: "Свои палатки", capacityMode: "shared", capacityTotal: 15, settings: {}, archived: false, alreadyBound: false },
      ],
      programs: [],
    })
    expect(report.writeCount).toBe(0)
    expect(report.summary.ready).toBe(2)
    expect(report.items[0]).toMatchObject({ proposedKind: "campground", proposedSubtype: "own_tent_area", disposition: "ready" })
    expect(report.items[1]).toMatchObject({ proposedKind: "house", disposition: "ready", signals: { showOnSite: true } })
    expect(report.items[1]!.reasons[0]).toContain("не даёт права публикации")
  })

  it("fails closed for unknown resource kinds and legacy program price semantics", () => {
    const report = buildLegacyOfferingBackfillReport({
      activeBusinessCalendarCount: 0,
      generatedAt: "2026-09-01T00:00:00.000Z",
      resources: [
        { id: "x", code: "X", kind: "mystery", name: "Неизвестно", capacityMode: "fixed", capacityTotal: 1, settings: {}, archived: false, alreadyBound: false },
      ],
      programs: [
        { id: "p", code: "P", name: "Программа", basePriceAmount: 5000, currency: "RUB", publication: "published", archived: false, alreadyBound: false },
      ],
    })
    expect(report.summary.review).toBe(2)
    expect(report.globalBlockers).toHaveLength(1)
    expect(report.items.find((item) => item.sourceType === "program_template")?.reasons[0]).toContain("pricing basis")
  })
})
