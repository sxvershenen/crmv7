import { describe, expect, it } from "vitest"
import { materializeRelease } from "./cms-publication.service.js"

const id = "11111111-1111-4111-8111-111111111111"
const revisionId = "22222222-2222-4222-8222-222222222222"
const base = { eyebrow: null, title: "Отзывы и FAQ", description: "", action: null }
const reviews = [{ id: "second", name: "Второй гость", text: "Второй отзыв", rating: 4 }, { id: "first", name: "Первый гость", text: "Первый отзыв", rating: 5 }]
const faq = [{ id: "question", question: "Вопрос?", answer: "Ответ" }]
function candidate(config: Record<string, unknown>, key = "reviews") {
  return {
    node: { id, kind: "home", status: "active" }, sourceKind: null, safeProjectionDependency: null,
    revision: { id: revisionId, nodeId: id, revision: 1, state: "approved", path: "/", slug: "home", parentNodeId: null, title: "Главная", summary: null,
      sections: [{ id, key, renderer: "homepage-section", rendererVersion: "1", schemaVersion: 1, order: 10, policy: { mode: "override", patch: { scalars: Object.fromEntries(Object.entries(config).map(([field, value]) => [field, { operation: "replace", value }])), objects: {}, keyedArrays: {} } } }],
      seo: { title: "Главная", description: "Описание главной" }, relations: [], contentHash: "a".repeat(64),
    },
  }
}

describe("publication of homepage details", () => {
  it.each([["reviews", { ...base, reviews }], ["faq", { ...base, faq }]] as const)("pins %s details, including order, in a release-owned snapshot", (key, config) => {
    const input = candidate(config, key)
    const result = materializeRelease([input] as never)
    expect(result.issues).toEqual([])
    expect(result.routes[0]?.content.sections[0]?.config).toEqual(config)
    expect(result.routes[0]?.dependencies).toEqual(expect.arrayContaining([expect.objectContaining({ id: revisionId })]))
    input.revision.sections[0]!.policy.patch.scalars.title = { operation: "replace", value: "Changed draft" }
    expect(result.routes[0]?.content.sections[0]?.config.title).toBe(base.title)
  })
  it.each([{ ...base, reviews: [] }, base])("publishes empty and legacy details without inventing content", (config) => {
    const result = materializeRelease([candidate(config)] as never)
    expect(result.issues).toEqual([])
    expect(result.routes[0]?.content.sections[0]?.config).toEqual(config)
  })
  it.each([
    ["reviews", { ...base, reviews: [{ ...reviews[0], name: " " }] }],
    ["reviews", { ...base, reviews: [reviews[0], reviews[0]] }],
    ["reviews", { ...base, reviews: [{ ...reviews[0], rating: 6 }] }],
    ["faq", { ...base, faq: [{ ...faq[0], answer: " " }] }],
    ["faq", { ...base, faq: [{ ...faq[0], privateNote: "hidden" }] }],
  ])("blocks invalid %s content during publication", (key, config) => {
    expect(materializeRelease([candidate(config as Record<string, unknown>, key as string)] as never).issues).toEqual([expect.objectContaining({ code: "CMS_HOMEPAGE_SECTION_INVALID" })])
  })
})
