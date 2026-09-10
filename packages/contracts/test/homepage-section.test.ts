import { describe, expect, it } from "vitest"
import { CmsHomeSectionConfigSchema, CmsHomeSectionDraftSchema, CmsHomeSectionSchema } from "../src/homepage-section.js"

const config = { eyebrow: "Афиша", title: "Ближайшие события", description: "Повод выбраться из города.", action: { label: "Все события", href: "/events" } }
const section = { id: "11111111-1111-4111-8111-111111111111", key: "events", renderer: "homepage-section", rendererVersion: "1", schemaVersion: 1, order: 10, config }

describe("homepage section contract", () => {
  it("accepts shared editorial fields and incomplete drafts", () => {
    expect(CmsHomeSectionSchema.parse(section).config).toEqual(config)
    expect(CmsHomeSectionDraftSchema.parse({ eyebrow: null, title: "", description: "", action: null })).toEqual({ eyebrow: null, title: "", description: "", action: null })
  })
  it.each([
    { ...config, title: " " },
    { ...config, action: { label: " ", href: "/events" } },
    { ...config, priceFrom: 1000 },
    { ...config, action: { label: "Все", href: "https://example.com" } },
  ])("rejects incomplete or undeclared published fields", (value) => {
    expect(CmsHomeSectionConfigSchema.safeParse(value).success).toBe(false)
  })
  it.each([{ key: "unknown" }, { renderer: "events" }, { rendererVersion: "2" }, { schemaVersion: 2 }])("rejects unsupported section identity", (patch) => {
    expect(CmsHomeSectionSchema.safeParse({ ...section, ...patch }).success).toBe(false)
  })
})
