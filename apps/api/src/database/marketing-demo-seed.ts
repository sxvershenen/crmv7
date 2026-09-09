import { randomUUID } from "node:crypto"
import { IsNull, type DataSource } from "typeorm"

import { BookingEntity, BookingLeadLinkEntity, LeadEntity, PromotionEntity } from "@crm/db"
import { PromotionTermsSchema, type PromotionTerms } from "@crm/contracts"

type DemoLead = {
  campaign: string
  content: string
  createdAt: string
  medium: string
  name: string
  source: string
  status: string
  term: string
}

const demoPromotions: PromotionTerms[] = [
  {
    code: "AUTUMN15", name: "Осенние выходные", active: true, discountType: "percent", value: 15,
    minimumAmountMinor: 300_000, startsAt: "2026-09-01T00:00:00.000Z", endsAt: "2026-11-01T00:00:00.000Z",
    scope: "all", resourceIds: [], offeringIds: [],
  },
  {
    code: "WEEKDAY3000", name: "Будний день", active: true, discountType: "fixed", value: 300_000,
    minimumAmountMinor: 1_000_000, startsAt: null, endsAt: null,
    scope: "all", resourceIds: [], offeringIds: [],
  },
  {
    code: "FAMILY10", name: "Семейная программа", active: false, discountType: "percent", value: 10,
    minimumAmountMinor: 0, startsAt: "2026-06-01T00:00:00.000Z", endsAt: "2026-09-01T00:00:00.000Z",
    scope: "all", resourceIds: [], offeringIds: [],
  },
]

const demoLeads: DemoLead[] = [
  { name: "Демо · Яндекс 1", source: "yandex", medium: "cpc", campaign: "autumn_weekend", content: "house_card", term: "домик на выходные", status: "success", createdAt: "2026-09-02T08:10:00.000Z" },
  { name: "Демо · Яндекс 2", source: "yandex", medium: "cpc", campaign: "autumn_weekend", content: "search", term: "отдых за городом", status: "in_progress", createdAt: "2026-09-03T09:20:00.000Z" },
  { name: "Демо · Яндекс 3", source: "yandex", medium: "cpc", campaign: "brand", content: "search", term: "свистоплясово", status: "new", createdAt: "2026-09-04T10:30:00.000Z" },
  { name: "Демо · VK 1", source: "vk", medium: "social", campaign: "family_september", content: "video", term: "", status: "waiting", createdAt: "2026-09-02T11:40:00.000Z" },
  { name: "Демо · VK 2", source: "vk", medium: "social", campaign: "family_september", content: "carousel", term: "", status: "new", createdAt: "2026-09-04T12:50:00.000Z" },
  { name: "Демо · Рассылка", source: "newsletter", medium: "email", campaign: "september_digest", content: "main_cta", term: "", status: "in_progress", createdAt: "2026-09-03T14:00:00.000Z" },
]

/** Idempotent local-only examples for visual and UX review. */
export async function seedMarketingDemoData(dataSource: DataSource, actorId: string, bookingId: string, targets: { offeringId?: string; resourceId?: string } = {}) {
  if (process.env.APP_ENV === "production") return
  const promotions = dataSource.getRepository(PromotionEntity)
  const promotionByCode = new Map<string, PromotionEntity>()
  const targetedPromotions: PromotionTerms[] = [
    ...(targets.resourceId ? [{ code: "PINE20", name: "Скидка на дом «Сосна»", active: true, discountType: "percent" as const, value: 20, minimumAmountMinor: 0, startsAt: null, endsAt: null, scope: "selected" as const, resourceIds: [targets.resourceId], offeringIds: [] }] : []),
    ...(targets.offeringId ? [{ code: "HOUSE5000", name: "Спецпредложение на размещение", active: true, discountType: "fixed" as const, value: 500_000, minimumAmountMinor: 1_000_000, startsAt: null, endsAt: null, scope: "selected" as const, resourceIds: [], offeringIds: [targets.offeringId] }] : []),
  ]
  for (const rawTerms of [...demoPromotions, ...targetedPromotions]) {
    const terms = PromotionTermsSchema.parse(rawTerms)
    let promotion = await promotions.findOneBy({ code: terms.code })
    if (!promotion) promotion = await promotions.save(promotions.create({
      id: randomUUID(), code: terms.code, terms, createdBy: actorId, updatedBy: actorId, archivedAt: null,
    }))
    promotionByCode.set(terms.code, promotion)
  }

  const leads = dataSource.getRepository(LeadEntity)
  let linkedLead: LeadEntity | null = null
  for (const item of demoLeads) {
    let lead = await leads.findOneBy({ name: item.name, source: "Маркетинг demo" })
    if (!lead) lead = await leads.save(leads.create({
      id: randomUUID(), customerId: null, name: item.name, phone: null, channel: "site",
      direction: "Проживание", requestedItem: "Подбор отдыха", desiredStartAt: null, desiredEndAt: null,
      guestCount: 2, comment: "Демонстрационная заявка маркетингового отчёта.", source: "Маркетинг demo",
      utm: { utm_source: item.source, utm_medium: item.medium, utm_campaign: item.campaign, utm_content: item.content, utm_term: item.term },
      assignees: [], nextContactAt: null, status: item.status, createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.createdAt), createdBy: actorId, updatedBy: actorId, archivedAt: null,
    }))
    if (item.name === "Демо · Яндекс 1") linkedLead = lead
  }

  const autumn = promotionByCode.get("AUTUMN15")
  const bookings = dataSource.getRepository(BookingEntity)
  const booking = await bookings.findOneBy({ id: bookingId })
  if (booking && autumn && booking.code === "BOOKING-LOCAL-001") {
    const storedPromotion = booking.snapshot.promotion as { promotionId?: unknown } | undefined
    const demoCreatedAt = new Date("2026-09-02T10:00:00.000Z")
    if (storedPromotion?.promotionId !== autumn.id || booking.createdAt.getTime() !== demoCreatedAt.getTime()) {
      booking.snapshot = {
        ...booking.snapshot,
        promotion: {
          promotionId: autumn.id, version: autumn.version, code: autumn.code, discountType: "percent",
          value: 15, eligibleAmountMinor: 480_000, discountAmountMinor: 72_000, appliedAt: demoCreatedAt.toISOString(),
        },
      }
      booking.createdAt = demoCreatedAt
      await bookings.save(booking)
    }
  }

  if (booking && linkedLead) {
    const links = dataSource.getRepository(BookingLeadLinkEntity)
    // Demo data is additive: preserve any active operator-owned relation and
    // only provide the marketing example when the booking is still unlinked.
    if (!await links.findOneBy({ bookingId: booking.id, unlinkedAt: IsNull() })) {
      await links.save(links.create({
        id: randomUUID(), bookingId: booking.id, leadId: linkedLead.id, method: "from_lead",
        linkedAt: new Date("2026-09-02T10:00:00.000Z"), linkedBy: actorId, unlinkedAt: null, unlinkedBy: null,
      }))
    }
  }
}
