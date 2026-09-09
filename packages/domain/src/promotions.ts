import { DomainError } from "./errors.js";

type Promotion = { id: string; version: number; terms: { code: string; active: boolean; startsAt: string | null; endsAt: string | null; scope: "all" | "selected"; resourceIds: string[]; offeringIds: string[]; minimumAmountMinor: number; discountType: "percent" | "fixed"; value: number } };
type BookingPromotion = { promotionId: string; version: number; code: string; discountType: "percent" | "fixed"; value: number; eligibleAmountMinor: number; discountAmountMinor: number; appliedAt: string };

export type PromotionLine = { resourceId: string | null; offeringId: string | null; amountMinor: number };

/** Each gross service/add-on occurs exactly once; scope is a union, not a multiplier. */
export function calculateBookingPromotion(promotion: Promotion, lines: readonly PromotionLine[], manualDiscountMinor: number, now: Date): BookingPromotion {
  const terms = promotion.terms;
  if (!terms.active || (terms.startsAt && now < new Date(terms.startsAt)) || (terms.endsAt && now >= new Date(terms.endsAt))) {
    throw new DomainError("PROMOTION_INACTIVE", "Промокод не действует в данный момент");
  }
  if (manualDiscountMinor !== 0) throw new DomainError("PROMOTION_NOT_STACKABLE", "Промокод и ручная скидка не суммируются. Уберите ручную скидку.");
  if (lines.some(line => !Number.isSafeInteger(line.amountMinor) || line.amountMinor < 0)) throw new DomainError("PROMOTION_INVALID_AMOUNT", "Некорректная стоимость услуги");
  const eligibleAmountMinor = lines.reduce((sum, line) => sum + (terms.scope === "all" || (line.resourceId !== null && terms.resourceIds.includes(line.resourceId)) || (line.offeringId !== null && terms.offeringIds.includes(line.offeringId)) ? line.amountMinor : 0), 0);
  if (eligibleAmountMinor === 0) throw new DomainError("PROMOTION_NOT_APPLICABLE", "Промокод не распространяется на выбранные услуги");
  if (eligibleAmountMinor < terms.minimumAmountMinor) throw new DomainError("PROMOTION_MINIMUM_NOT_MET", "Не достигнута минимальная сумма услуг для промокода");
  const discountAmountMinor = Math.min(eligibleAmountMinor, terms.discountType === "fixed" ? terms.value : Math.round(eligibleAmountMinor * terms.value / 100));
  return { promotionId: promotion.id, version: promotion.version, code: terms.code, discountType: terms.discountType, value: terms.value, eligibleAmountMinor, discountAmountMinor, appliedAt: now.toISOString() };
}
