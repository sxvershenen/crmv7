import type { PromotionTerms } from "@crm/contracts"

export function promotionAvailable(terms: PromotionTerms, now: Date): boolean {
  return terms.active
    && (!terms.startsAt || new Date(terms.startsAt) <= now)
    && (!terms.endsAt || new Date(terms.endsAt) > now)
}
