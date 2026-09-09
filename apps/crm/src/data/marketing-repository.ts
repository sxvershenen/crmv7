import {
  MarketingPeriodSchema, MarketingReportSchema, PromotionListSchema,
  PromotionMutationSchema, PromotionSchema, PromotionUpdateSchema,
  type MarketingPeriod, type MarketingReport, type Promotion,
  type PromotionMutation, type PromotionUpdate,
} from "@crm/contracts"
import { apiClient } from "@app/lib/api-client"

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

// There is deliberately no production fallback to fixture marketing statistics.
export const marketingRepository = new ApiMarketingRepository()
