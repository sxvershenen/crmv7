import { describe, expect, it } from "vitest"
import { CmsHomeOfferingChoiceListSchema, CmsHomeSectionConfigSchema, CmsHomeSectionDraftSchema, CmsHomeSectionSchema } from "../src/homepage-section.js"

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

const review = { id: "review-1", name: "Гость", text: "Отличный отдых", rating: 5 }
const faq = { id: "faq-1", question: "Как добраться?", answer: "По дороге" }
describe("homepage reviews and FAQ", () => {
  it("accepts existing configs and empty lists, validates release-owned details", () => {
    expect(CmsHomeSectionSchema.safeParse({ ...section, key: "reviews", config: { ...config, reviews: [review] } }).success).toBe(true)
    expect(CmsHomeSectionSchema.safeParse({ ...section, key: "faq", config: { ...config, faq: [faq] } }).success).toBe(true)
    expect(CmsHomeSectionConfigSchema.safeParse({ ...config, reviews: [], faq: [] }).success).toBe(true)
    expect(CmsHomeSectionDraftSchema.safeParse({ ...config, reviews: [{ ...review, name: "", text: "" }], faq: [{ ...faq, question: "", answer: "" }] }).success).toBe(true)
  })
  it("preserves editable review portraits and attribution in the public contract", () => {
    const presented = { ...review, avatarUrl: "https://images.example.org/guest.webp", date: "12 февраля 2025", sourceLabel: "Яндекс Карты" }
    expect(CmsHomeSectionSchema.parse({ ...section, key: "reviews", config: { ...config, reviews: [presented] } }).config.reviews).toEqual([presented])
    expect(CmsHomeSectionConfigSchema.safeParse({ ...config, reviews: [{ ...presented, avatarUrl: "http://images.example.org/guest.webp" }] }).success).toBe(false)
  })
  it.each([
    { reviews: [{ ...review, name: " " }] }, { reviews: [{ ...review, text: " " }] },
    { reviews: [{ ...review, rating: 0 }] }, { reviews: [{ ...review, rating: 6 }] }, { reviews: [{ ...review, rating: 4.5 }] },
    { reviews: [review, review] }, { reviews: [{ ...review, email: "private@example.test" }] },
    { faq: [{ ...faq, question: " " }] }, { faq: [{ ...faq, answer: " " }] }, { faq: [faq, faq] }, { faq: [{ ...faq, price: 100 }] },
  ])("blocks invalid published details", (details) => {
    expect(CmsHomeSectionConfigSchema.safeParse({ ...config, ...details }).success).toBe(false)
  })
  it("rejects details attached to another section kind", () => {
    expect(CmsHomeSectionSchema.safeParse({ ...section, config: { ...config, reviews: [review] } }).success).toBe(false)
    expect(CmsHomeSectionSchema.safeParse({ ...section, key: "reviews", config: { ...config, faq: [faq] } }).success).toBe(false)
  })
})

describe("manual homepage offerings", () => {
  const id = "22222222-2222-4222-8222-222222222222"
  it("keeps ordered CRM references only on supported sections", () => {
    const selected = { ...config, selectedOfferingIds: [id] }
    expect(CmsHomeSectionSchema.safeParse({ ...section, key: "houses", config: selected }).success).toBe(true)
    expect(CmsHomeSectionSchema.safeParse({ ...section, key: "events", config: selected }).success).toBe(false)
    expect(CmsHomeSectionConfigSchema.safeParse({ ...config, selectedOfferingIds: [id, id] }).success).toBe(false)
    expect(CmsHomeSectionConfigSchema.safeParse({ ...config, selectedOfferingIds: ["invalid"] }).success).toBe(false)
    expect(CmsHomeOfferingChoiceListSchema.safeParse({ items: [{ offeringId: id, title: "Домик", state: "draft" }], nextCursor: null }).success).toBe(true)
  })
})

describe("homepage visual cards", () => {
  const card = { id: "card-1", title: "Баня", description: "Парная", imageUrl: "/api/public/v1/media/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222" }
  it("accepts public CMS media URLs and rejects unsafe external URLs without throwing", () => {
    expect(CmsHomeSectionSchema.safeParse({ ...section, key: "sauna-chan", config: { ...config, cards: [card] } }).success).toBe(true)
    expect(CmsHomeSectionSchema.safeParse({ ...section, key: "sauna-chan", config: { ...config, cards: [{ ...card, imageUrl: "http://example.com/image.jpg" }] } }).success).toBe(false)
  })
  it("links each sauna card to at most one CRM resource", () => {
    const first = "33333333-3333-4333-8333-333333333333"
    const second = "44444444-4444-4444-8444-444444444444"
    expect(CmsHomeSectionSchema.safeParse({ ...section, key: "sauna-chan", config: { ...config, cards: [{ ...card, selectedOfferingIds: [first] }] } }).success).toBe(true)
    expect(CmsHomeSectionSchema.safeParse({ ...section, key: "sauna-chan", config: { ...config, cards: [{ ...card, selectedOfferingIds: [first, second] }] } }).success).toBe(false)
    expect(CmsHomeSectionSchema.safeParse({ ...section, key: "reviews", config: { ...config, cards: [{ ...card, selectedOfferingIds: [first] }] } }).success).toBe(false)
  })
  it("accepts direct review videos with a poster and rejects page links or videos in other sections", () => {
    const videoCard = { ...card, videoUrl: "https://example.org/forest.mp4?token=demo" }
    expect(CmsHomeSectionSchema.safeParse({ ...section, key: "reviews", config: { ...config, cards: [videoCard] } }).success).toBe(true)
    expect(CmsHomeSectionSchema.safeParse({ ...section, key: "programs", config: { ...config, cards: [videoCard] } }).success).toBe(false)
    expect(CmsHomeSectionSchema.safeParse({ ...section, key: "reviews", config: { ...config, cards: [{ ...videoCard, imageUrl: "" }] } }).success).toBe(false)
    for (const videoUrl of ["http://example.org/forest.mp4", "https://example.org/watch/forest", "javascript:alert(1)"]) {
      expect(CmsHomeSectionSchema.safeParse({ ...section, key: "reviews", config: { ...config, cards: [{ ...videoCard, videoUrl }] } }).success).toBe(false)
    }
  })
})
