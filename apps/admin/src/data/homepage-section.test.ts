import type { CmsSection } from "@crm/contracts"
import { homepageSectionDraft, homepageSectionPolicy } from "./homepage-section"

const config = { eyebrow: null, title: "Отзывы", description: "", action: null, reviews: [{ id: "review-1", name: "Имя", text: "Текст", rating: 5 }] }
const section: CmsSection = { id: "11111111-1111-4111-8111-111111111111", key: "reviews", renderer: "homepage-section", rendererVersion: "1", schemaVersion: 1, order: 7, policy: homepageSectionPolicy(config) }

describe("homepage details draft adapter", () => {
  it("round-trips list order, explicit removal, and incomplete draft values", () => {
    expect(homepageSectionDraft(section)).toEqual(config)
    for (const reviews of [[], [...config.reviews, { id: "review-2", name: "", text: "", rating: 1 }].reverse()]) {
      expect(homepageSectionDraft({ ...section, policy: homepageSectionPolicy({ ...config, reviews }) })?.reviews).toEqual(reviews)
    }
    const faq = { eyebrow: null, title: "FAQ", description: "", action: null, faq: [{ id: "faq-1", question: "Вопрос", answer: "Ответ" }] }
    expect(homepageSectionDraft({ ...section, key: "faq", policy: homepageSectionPolicy(faq) })).toEqual(faq)
  })
  it("keeps old configs free of implicit list replacements", () => {
    const oldConfig = { eyebrow: null, title: "Отзывы", description: "", action: null }
    expect(homepageSectionDraft({ ...section, policy: homepageSectionPolicy(oldConfig) })).toEqual(oldConfig)
  })
  it("leaves unknown versions, fields and composed patches opaque and unmodified", () => {
    const policy = homepageSectionPolicy(config)
    if (policy.mode !== "override") throw new Error("expected override")
    for (const candidate of [
      { ...section, rendererVersion: "2" },
      { ...section, key: "events" },
      { ...section, policy: { ...policy, patch: { ...policy.patch, scalars: { ...policy.patch.scalars, custom: { operation: "replace", value: "keep" } } } } },
      { ...section, policy: { ...policy, patch: { ...policy.patch, objects: { extra: { operation: "replace", value: {} } } } } },
      { ...section, policy: { ...policy, patch: { ...policy.patch, keyedArrays: { reviews: {} } } } },
    ]) {
      const snapshot = structuredClone(candidate)
      expect(homepageSectionDraft(candidate as CmsSection)).toBeUndefined()
      expect(candidate).toEqual(snapshot)
    }
  })
})
