import {
  MarketingPeriodSchema, MarketingReportSchema, PromotionListSchema,
  PromotionMutationSchema, PromotionSchema, PromotionUpdateSchema,
  type MarketingPeriod, type MarketingReport, type Promotion,
  type PromotionMutation, type PromotionUpdate,
} from "@crm/contracts"
import { apiClient } from "@app/lib/api-client"
import { useFixtureData } from "@app/lib/data-mode"
import { marketingPromotionsFixture, marketingReportFixture } from "@app/fixtures/marketing"

export interface MarketingRepository {
  list(): Promise<{ items: Promotion[]; canManage: boolean }>
  get(id: string): Promise<Promotion>
  create(input: PromotionMutation): Promise<Promotion>
  update(id: string, input: PromotionUpdate): Promise<Promotion>
  report(period: MarketingPeriod): Promise<MarketingReport>
}

export class ApiMarketingRepository implements MarketingRepository {
  constructor(private readonly client: Pick<typeof apiClient, "get" | "post" | "patch"> = apiClient) {}
  list() { return this.client.get("marketing/promotions", PromotionListSchema) }
  get(id: string) { return this.client.get(`marketing/promotions/${encodeURIComponent(id)}`, PromotionSchema) }
  create(input: PromotionMutation) { return this.client.post("marketing/promotions", PromotionMutationSchema.parse(input), PromotionSchema) }
  update(id: string, input: PromotionUpdate) { return this.client.patch(`marketing/promotions/${encodeURIComponent(id)}`, PromotionUpdateSchema.parse(input), PromotionSchema) }
  report(period: MarketingPeriod) {
    return this.client.get(`marketing/report?${new URLSearchParams(MarketingPeriodSchema.parse(period))}`, MarketingReportSchema)
  }
}

export class FixtureMarketingRepository implements MarketingRepository {
  private promotions = structuredClone(marketingPromotionsFixture)

  async list() { return { items: structuredClone(this.promotions), canManage: true } }

  async get(id: string) {
    const promotion = this.promotions.find((item) => item.id === id)
    if (!promotion) throw new Error("Промокод не найден")
    return structuredClone(promotion)
  }

  async create(input: PromotionMutation) {
    const now = new Date().toISOString()
    const created: Promotion = { id: crypto.randomUUID(), version: 1, terms: structuredClone(input.terms), createdAt: now, updatedAt: now }
    this.promotions = [created, ...this.promotions]
    return structuredClone(created)
  }

  async update(id: string, input: PromotionUpdate) {
    const index = this.promotions.findIndex((item) => item.id === id)
    const current = this.promotions[index]
    if (!current) throw new Error("Промокод не найден")
    if (current.version !== input.expectedVersion) throw new Error("Промокод уже изменён в другой сессии")
    const updated: Promotion = { ...current, version: current.version + 1, terms: structuredClone(input.terms), updatedAt: new Date().toISOString() }
    this.promotions[index] = updated
    return structuredClone(updated)
  }

  async report(period: MarketingPeriod) { return { period, ...structuredClone(marketingReportFixture) } }
}

export const fixtureMarketingRepository = new FixtureMarketingRepository()
export const marketingRepository: MarketingRepository = useFixtureData ? fixtureMarketingRepository : new ApiMarketingRepository()
