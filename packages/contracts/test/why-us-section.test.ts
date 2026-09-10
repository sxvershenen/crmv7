import { describe, expect, it } from "vitest"
import { CmsWhyUsSectionConfigSchema, CmsWhyUsSectionDraftSchema, CmsWhyUsSectionSchema } from "../src/why-us-section.js"

const id = "distance"
const config = {
  eyebrow: "Почему мы",
  title: "Почему выбирают нас",
  description: "Конкретные доказательства вместо общих эпитетов.",
  facts: [{ id, number: "30 мин", title: "От центра Кирова", description: "Удобно добираться на авто и такси." }],
  team: { label: "Команда «Зажигай»", title: "Профессиональная команда рядом", description: "Помогаем на каждом этапе." },
}
const section = { id: "11111111-1111-4111-8111-111111111111", key: "why-us", renderer: "why-us", rendererVersion: "1", schemaVersion: 1, order: 10, config }

describe("why-us section contract", () => {
  it("keeps typed trust copy and allows incomplete drafts", () => {
    expect(CmsWhyUsSectionSchema.parse(section).config).toEqual(config)
    expect(CmsWhyUsSectionDraftSchema.parse({ eyebrow: "", title: "", description: "", facts: [], team: { label: "", title: "", description: "" } })).toEqual({ eyebrow: "", title: "", description: "", facts: [], team: { label: "", title: "", description: "" } })
  })
  it.each([
    { ...config, title: " " },
    { ...config, facts: [] },
    { ...config, facts: [{ ...config.facts[0], title: " " }] },
    { ...config, facts: [config.facts[0], config.facts[0]] },
    { ...config, team: { ...config.team, description: " " } },
    { ...config, facts: [{ ...config.facts[0], price: 1000 }] },
  ])("rejects incomplete, duplicate or undeclared published fields", (value) => {
    expect(CmsWhyUsSectionConfigSchema.safeParse(value).success).toBe(false)
  })
  it.each([{ key: "other" }, { renderer: "dynamic" }, { rendererVersion: "2" }, { schemaVersion: 2 }])("rejects unsupported section identity", (patch) => {
    expect(CmsWhyUsSectionSchema.safeParse({ ...section, ...patch }).success).toBe(false)
  })
})
