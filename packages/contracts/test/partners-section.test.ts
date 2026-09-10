import { describe, expect, it } from "vitest"
import { CmsPartnersSectionConfigSchema, CmsPartnersSectionDraftSchema, CmsPartnersSectionSchema } from "../src/partners-section.js"

const id = "11111111-1111-4111-8111-111111111111"
const config = { title: "Партнёры", description: "Вместе делаем отдых лучше", items: [{ id, label: "Местная пекарня" }] }
const section = { id, key: "partners", renderer: "partners", rendererVersion: "1", schemaVersion: 1, order: 10, config }

describe("partners section contract", () => {
  it("keeps ordered editorial data and allows incomplete drafts", () => {
    expect(CmsPartnersSectionSchema.parse(section).config).toEqual(config)
    expect(CmsPartnersSectionDraftSchema.parse({ title: "", description: "", items: [] })).toEqual({ title: "", description: "", items: [] })
  })
  it.each([
    { ...config, title: " " }, { ...config, items: [] },
    { ...config, items: [{ id, label: " " }] }, { ...config, items: [config.items[0], config.items[0]] },
    { ...config, priceFrom: 1000 }, { ...config, items: [{ ...config.items[0], phone: "private" }] },
    { ...config, items: Array.from({ length: 41 }, () => config.items[0]) },
  ])("rejects incomplete, duplicate, excessive or undeclared published fields", (value) => {
    expect(CmsPartnersSectionConfigSchema.safeParse(value).success).toBe(false)
  })
  it.each([{ key: "other" }, { renderer: "dynamic" }, { rendererVersion: "2" }, { schemaVersion: 2 }])("rejects unsupported section identity", (patch) => {
    expect(CmsPartnersSectionSchema.safeParse({ ...section, ...patch }).success).toBe(false)
  })
})
