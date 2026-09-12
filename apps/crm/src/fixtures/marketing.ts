import type { MarketingReport, Promotion } from "@crm/contracts"

const createdAt = "2026-09-01T09:00:00.000Z"

export const marketingPromotionsFixture: Promotion[] = [
  {
    id: "70000000-0000-4000-8000-000000000001",
    version: 2,
    terms: {
      code: "GLAMP3000",
      name: "Первое заселение",
      active: true,
      discountType: "fixed",
      value: 300_000,
      minimumAmountMinor: 0,
      startsAt: "2026-09-01T00:00:00.000Z",
      endsAt: "2026-10-01T00:00:00.000Z",
      scope: "all",
      resourceIds: [],
      offeringIds: [],
    },
    createdAt,
    updatedAt: "2026-09-08T11:30:00.000Z",
  },
  {
    id: "70000000-0000-4000-8000-000000000002",
    version: 1,
    terms: {
      code: "DETI1000",
      name: "Детские программы",
      active: true,
      discountType: "fixed",
      value: 100_000,
      minimumAmountMinor: 500_000,
      startsAt: "2026-09-01T00:00:00.000Z",
      endsAt: null,
      scope: "all",
      resourceIds: [],
      offeringIds: [],
    },
    createdAt,
    updatedAt: createdAt,
  },
  {
    id: "70000000-0000-4000-8000-000000000003",
    version: 3,
    terms: {
      code: "BIRTHDAY20",
      name: "День рождения",
      active: false,
      discountType: "percent",
      value: 20,
      minimumAmountMinor: 0,
      startsAt: null,
      endsAt: null,
      scope: "all",
      resourceIds: [],
      offeringIds: [],
    },
    createdAt,
    updatedAt: "2026-09-10T14:20:00.000Z",
  },
]

export const marketingReportFixture: Omit<MarketingReport, "period"> = {
  visitorsStatus: "not_configured",
  visitors: null,
  attributionModel: "lead_snapshot",
  promotions: [
    { promotionId: marketingPromotionsFixture[0]!.id, bookings: 8, confirmedBookings: 6, discountAmountMinor: 2_400_000, bookingAmountMinor: 18_600_000, paidAmountMinor: 12_400_000 },
    { promotionId: marketingPromotionsFixture[1]!.id, bookings: 4, confirmedBookings: 3, discountAmountMinor: 400_000, bookingAmountMinor: 7_200_000, paidAmountMinor: 4_800_000 },
    { promotionId: marketingPromotionsFixture[2]!.id, bookings: 2, confirmedBookings: 1, discountAmountMinor: 620_000, bookingAmountMinor: 5_100_000, paidAmountMinor: 2_700_000 },
  ],
  campaigns: [
    { source: "vk", medium: "cpc", campaign: "velvet_2026", content: "houses", term: "домик с чаном", leads: 18, qualifiedLeads: 11, bookings: 6, paidAmountMinor: 12_400_000 },
    { source: "yandex", medium: "organic", campaign: "seo", content: "houses", term: "глэмпинг киров", leads: 13, qualifiedLeads: 8, bookings: 4, paidAmountMinor: 7_800_000 },
    { source: "direct", medium: "none", campaign: "", content: "", term: "", leads: 7, qualifiedLeads: 5, bookings: 3, paidAmountMinor: 4_900_000 },
  ],
}
