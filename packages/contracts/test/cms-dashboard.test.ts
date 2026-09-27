import { describe, expect, it } from "vitest"

import { CmsDashboardResponseSchema } from "../src/index.js"

const dashboard = {
  productionRelease: "REL-12",
  publishedAt: "2026-09-01T10:00:00.000Z",
  drafts: 2,
  metrics: [
    { id: "pages", label: "Страницы", value: "4", detail: "3 в production" },
    { id: "seo", label: "SEO-качество", value: "3 / 4", detail: "1 страниц с рисками" },
    { id: "media", label: "Медиа", value: "8", detail: "0 файлов в обработке" },
    { id: "release", label: "Черновики", value: "2", detail: "1 на проверке" },
  ],
  attention: [],
  activity: [{ id: "change-1", actor: "Марина", action: "обновил", target: "Главная", when: "2026-09-01T09:00:00.000Z", status: "draft" }],
}

describe("CmsDashboard contract", () => {
  it("accepts the strict direct response", () => expect(CmsDashboardResponseSchema.parse(dashboard)).toEqual(dashboard))
  it("rejects unknown fields and metrics outside the compact four-card shape", () => {
    expect(CmsDashboardResponseSchema.safeParse({ ...dashboard, unexpected: true }).success).toBe(false)
    expect(CmsDashboardResponseSchema.safeParse({ ...dashboard, funnel: { visitors: 0, leads: 1, bookings: 0, paid: 0 } }).success).toBe(false)
    expect(CmsDashboardResponseSchema.safeParse({ ...dashboard, metrics: dashboard.metrics.slice(0, 3) }).success).toBe(false)
  })
})
