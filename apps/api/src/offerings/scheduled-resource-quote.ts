import { ConflictException, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { AddonOfferingTermsEntity, CatalogOfferingEntity, OfferingBindingEntity, PriceBookEntity, ResourceEntity } from "@crm/db"
import { resolveScheduledResourceQuote, type ScheduledResourceQuoteCalculation } from "@crm/domain"
import type { EntityManager } from "typeorm"

import { loadHousePricingSnapshot } from "./offering-editor-pricing-snapshots.js"

export type ScheduledResourceQuoteInput = {
  startsAt: string
  endsAt: string
  guests: number
  ratePlanKey: string | null
  currency: string
}

/** One CRM price authority for the booking editor and booking mutation. */
export async function quoteScheduledResource(manager: EntityManager, resourceId: string, input: ScheduledResourceQuoteInput): Promise<ScheduledResourceQuoteCalculation | null> {
  const selectedResource = await manager.getRepository(ResourceEntity).findOneBy({ id: resourceId })
  if (!selectedResource || selectedResource.archivedAt !== null) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND", message: "Баня или чан не найдены" })
  if (selectedResource.kind !== "bath") throw new ConflictException({ code: "BOOKING_RESOURCE_TYPE_MISMATCH", message: "Для бани или чана выберите SPA-ресурс" })
  const candidates = await manager.getRepository(CatalogOfferingEntity).createQueryBuilder("offering")
    .innerJoin(OfferingBindingEntity, "binding", "binding.offering_id = offering.id AND binding.role = 'primary' AND binding.archived_at IS NULL")
    .innerJoin(AddonOfferingTermsEntity, "terms", "terms.offering_id = offering.id AND terms.service_type = 'scheduled_resource'")
    .where("binding.resource_id = :resourceId AND offering.kind = 'addon' AND offering.archived_at IS NULL", { resourceId })
    .getMany()
  if (candidates.length === 0) return null // Existing legacy bath bookings may still use a manual amount.
  if (candidates.length !== 1) throw new ConflictException({ code: "RESOURCE_SCHEDULED_OFFERING_AMBIGUOUS", message: "У ресурса несколько тарифных предложений" })
  const offering = await manager.getRepository(CatalogOfferingEntity).createQueryBuilder("offering")
    .setLock("pessimistic_read").where("offering.id = :id", { id: candidates[0]!.id }).getOne()
  // A linked draft has no live price yet; existing manually priced bookings remain available.
  if (!offering || offering.state !== "active" || !offering.activePriceBookId) return null
  const book = await manager.getRepository(PriceBookEntity).createQueryBuilder("book")
    .setLock("pessimistic_read").where("book.id = :id AND book.offering_id = :offeringId", { id: offering.activePriceBookId, offeringId: offering.id }).getOne()
  if (!book || book.state !== "active") throw new ConflictException({ code: "RESOURCE_SCHEDULED_PRICE_INACTIVE", message: "Действующий тариф не найден" })
  const resource = await manager.getRepository(ResourceEntity).createQueryBuilder("resource")
    .setLock("pessimistic_read").where("resource.id = :resourceId", { resourceId }).getOne()
  if (!resource || resource.archivedAt !== null) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND", message: "Баня или чан не найдены" })
  if (resource.kind !== "bath" || resource.settings?.active === false) throw new ConflictException({ code: "RESOURCE_INACTIVE", message: "Баня или чан сейчас недоступны" })
  if (input.guests > resource.capacityTotal) throw new UnprocessableEntityException({ code: "RESOURCE_CAPACITY_EXCEEDED", message: `Вместимость ресурса — до ${resource.capacityTotal} гостей` })
  const start = new Date(input.startsAt)
  if (!Number.isFinite(start.getTime())) throw new UnprocessableEntityException({ code: "INVALID_INTERVAL", message: "Укажите корректное начало сеанса" })
  const parts = new Intl.DateTimeFormat("en", { timeZone: offering.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(start)
  const part = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)!.value
  const serviceDate = `${part("year")}-${part("month")}-${part("day")}`
  const toExclusive = new Date(`${serviceDate}T00:00:00.000Z`)
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1)
  const nextDate = toExclusive.toISOString().slice(0, 10)
  const snapshot = await loadHousePricingSnapshot(manager, offering, book, serviceDate, nextDate)
  return resolveScheduledResourceQuote(snapshot, { offeringId: offering.id, ...input })
}
