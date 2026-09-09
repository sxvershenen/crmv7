import { randomUUID } from "node:crypto"

import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { type EntityManager } from "typeorm"

import {
  InternalOfferingQuoteRequestSchema,
  InternalOfferingQuoteResultSchema,
  HouseStayQuoteOperationalContextSchema,
  OperationalQuoteAcceptanceOutboxEventSchema,
  ProgramRegistrationQuoteOperationalContextSchema,
  ProgramRegistrationQuoteResultSchema,
  ProgramRegistrationQuoteBodySchema,
  type BookingItemQuoteAcceptance,
  type SessionUser,
} from "@crm/contracts"
import {
  AcceptedOfferingQuoteLinkEntity,
  BookingEntity,
  BookingItemEntity,
  CatalogOfferingEntity,
  ChangeLogEntity,
  OfferingBindingEntity,
  OfferingQuoteSnapshotEntity,
  OutboxDeliveryEntity,
  OutboxEventEntity,
  ProgramOccurrenceEntity,
  ProgramRegistrationEntity,
  ProgramTemplateEntity,
  ResourceEntity,
} from "@crm/db"

type PreparedAcceptance = {
  item: BookingItemEntity
  quote: OfferingQuoteSnapshotEntity
  context: ReturnType<typeof HouseStayQuoteOperationalContextSchema.parse>
  request: ReturnType<typeof InternalOfferingQuoteRequestSchema.parse>
  result: ReturnType<typeof InternalOfferingQuoteResultSchema.parse>
}
export type PreparedProgramRegistrationAcceptance = {
  quote: OfferingQuoteSnapshotEntity
  result: ReturnType<typeof ProgramRegistrationQuoteResultSchema.parse>
}

@Injectable()
export class OperationalQuoteAcceptanceService {
  async acceptBookingItems(manager: EntityManager, booking: BookingEntity, acceptances: readonly BookingItemQuoteAcceptance[], actor: SessionUser, requestId: string, operationId: string) {
    const byItem = new Map<string, BookingItemQuoteAcceptance>()
    for (const acceptance of acceptances) byItem.set(acceptance.bookingItemId, acceptance)
    if (byItem.size !== acceptances.length) throw failure("QUOTE_BOOKING_ITEM_DUPLICATE", "Позиция бронирования может принять только один расчёт")
    const itemIds = [...byItem.keys()].sort()
    const items = await manager.createQueryBuilder(BookingItemEntity, "item").setLock("pessimistic_write")
      .where("item.booking_id = :bookingId AND item.id IN (:...ids) AND item.archived_at IS NULL", { bookingId: booking.id, ids: [...byItem.keys()].sort() })
      .orderBy("item.id", "ASC").getMany()
    if (items.length !== byItem.size) throw failure("QUOTE_BOOKING_ITEM_NOT_FOUND", "Одна из позиций бронирования не найдена или архивирована")
    const quoteIds = [...new Set(acceptances.map((item) => item.quoteSnapshotId))].sort()
    if (quoteIds.length !== acceptances.length) throw failure("QUOTE_SNAPSHOT_DUPLICATE", "Расчёт может быть принят только для одной позиции")
    const snapshots = await manager.createQueryBuilder(OfferingQuoteSnapshotEntity, "quote").setLock("pessimistic_write")
      .where("quote.id IN (:...ids)", { ids: quoteIds }).orderBy("quote.id", "ASC").getMany()
    if (snapshots.length !== quoteIds.length) throw new NotFoundException({ code: "QUOTE_NOT_FOUND", message: "Расчёт не найден" })
    const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]))
    const prepared = items.map((item) => this.prepare(item, snapshotById.get(byItem.get(item.id)!.quoteSnapshotId)!))

    // The order is deliberately global across the batch. Do not move context
    // locks into the per-item validation path: opposite payload ordering must
    // still acquire identical lock sequences.
    const offeringIds = [...new Set(prepared.map((entry) => entry.quote.offeringId))].sort()
    const offerings = await manager.createQueryBuilder(CatalogOfferingEntity, "offering").setLock("pessimistic_write")
      .where("offering.id IN (:...ids)", { ids: offeringIds }).orderBy("offering.id", "ASC").getMany()
    if (offerings.length !== offeringIds.length) throw failure("QUOTE_TARGET_UNSUPPORTED", "Расчёт не относится к доступному house offering")
    const offeringById = new Map(offerings.map((offering) => [offering.id, offering]))
    const bindings = await manager.createQueryBuilder(OfferingBindingEntity, "binding").setLock("pessimistic_write")
      .where("binding.offering_id IN (:...ids) AND binding.role = 'primary' AND binding.archived_at IS NULL", { ids: offeringIds })
      .orderBy("binding.offering_id", "ASC").addOrderBy("binding.id", "ASC").getMany()
    const bindingByOffering = new Map<string, OfferingBindingEntity>()
    for (const binding of bindings) {
      if (bindingByOffering.has(binding.offeringId)) throw failure("QUOTE_CONTEXT_MISMATCH", "У предложения несколько primary Resource binding")
      bindingByOffering.set(binding.offeringId, binding)
    }
    const resourceIds = [...new Set(prepared.map((entry) => entry.context.primaryResourceId))].sort()
    const resources = await manager.createQueryBuilder(ResourceEntity, "resource").setLock("pessimistic_write")
      .where("resource.id IN (:...ids)", { ids: resourceIds }).orderBy("resource.id", "ASC").getMany()
    const resourceById = new Map(resources.map((resource) => [resource.id, resource]))

    const existing = await manager.createQueryBuilder(AcceptedOfferingQuoteLinkEntity, "link").setLock("pessimistic_write")
      .where("link.quote_snapshot_id IN (:...quoteIds) OR link.booking_item_id IN (:...itemIds)", { quoteIds, itemIds })
      .orderBy("link.quote_snapshot_id", "ASC").addOrderBy("link.booking_item_id", "ASC").getOne()
    if (existing) throw failure("QUOTE_ALREADY_ACCEPTED", "Расчёт или позиция уже приняты", { quoteSnapshotId: existing.quoteSnapshotId, bookingItemId: existing.bookingItemId })
    const now = await this.databaseNow(manager)
    for (const entry of prepared) await this.acceptOne(manager, booking, entry, offeringById, bindingByOffering, resourceById, actor, requestId, operationId, now)
  }

  async prepareProgramRegistration(manager: EntityManager, registration: ProgramRegistrationEntity, occurrence: ProgramOccurrenceEntity, quoteSnapshotId: string): Promise<PreparedProgramRegistrationAcceptance> {
    const quote = await manager.createQueryBuilder(OfferingQuoteSnapshotEntity, "quote").setLock("pessimistic_write").where("quote.id = :id", { id: quoteSnapshotId }).getOne()
    if (!quote) throw new NotFoundException({ code: "QUOTE_NOT_FOUND", message: "Расчёт не найден" })
    if (quote.quoteType !== "program_registration") throw failure("QUOTE_NOT_ACCEPTANCE_READY", "Template preview нельзя принять как регистрацию", { quoteSnapshotId })
    const context = ProgramRegistrationQuoteOperationalContextSchema.safeParse(quote.operationalContext)
    const request = ProgramRegistrationQuoteBodySchema.safeParse(quote.requestPayload)
    const result = ProgramRegistrationQuoteResultSchema.safeParse(quote.resultPayload)
    if (!context.success || !request.success || !result.success) throw failure("QUOTE_SNAPSHOT_INVALID", "Сохранённый расчёт регистрации имеет неверный формат")
    const offering = await manager.createQueryBuilder(CatalogOfferingEntity, "offering").setLock("pessimistic_write").where("offering.id = :id", { id: quote.offeringId }).getOne()
    const template = await manager.createQueryBuilder(ProgramTemplateEntity, "template").setLock("pessimistic_write").where("template.id = :id", { id: occurrence.templateId }).getOne()
    const existing = await manager.createQueryBuilder(AcceptedOfferingQuoteLinkEntity, "link").setLock("pessimistic_write").where("link.quote_snapshot_id = :quoteId OR link.program_registration_id = :registrationId", { quoteId: quote.id, registrationId: registration.id }).getOne()
    if (existing) throw failure("QUOTE_ALREADY_ACCEPTED", "Расчёт или регистрация уже приняты", { quoteSnapshotId: quote.id, programRegistrationId: registration.id })
    const now = await this.databaseNow(manager)
    const exact = result.data.quoteId === quote.id && result.data.offeringId === quote.offeringId
      && result.data.programOccurrenceId === occurrence.id && result.data.programOccurrenceVersion === occurrence.version
      && result.data.programTemplateId === occurrence.templateId && request.data.expectedOccurrenceVersion === occurrence.version
      && result.data.inputs.participants === registration.participantCount
      && result.data.inputs.startsAt === occurrence.startsAt.toISOString() && result.data.inputs.endsAt === occurrence.endsAt.toISOString()
      && context.data.programOccurrenceId === occurrence.id && context.data.programOccurrenceVersion === occurrence.version
      && context.data.programTemplateId === occurrence.templateId && context.data.programTemplateVersion === quote.programTemplateVersion
    if (!exact || !offering || offering.kind !== "program" || offering.state !== "active" || offering.archivedAt !== null || offering.version !== quote.offeringVersion || offering.subjectVersion !== context.data.subjectVersion || offering.pricingVersion !== quote.pricingVersion || offering.addonAssignmentsVersion !== quote.addOnAssignmentsVersion || offering.activePriceBookId !== quote.priceBookId || !template || template.archivedAt !== null || template.version !== context.data.programTemplateVersion || quote.validUntil <= now) throw failure(quote.validUntil <= now ? "QUOTE_EXPIRED" : "QUOTE_CONTEXT_MISMATCH", quote.validUntil <= now ? "Срок действия расчёта истёк" : "Расчёт не соответствует регистрации или проведение изменилось", { quoteSnapshotId: quote.id })
    return { quote, result: result.data }
  }

  async recordProgramRegistration(manager: EntityManager, registration: ProgramRegistrationEntity, prepared: PreparedProgramRegistrationAcceptance, actor: SessionUser, requestId: string, operationId: string) {
    const now = await this.databaseNow(manager)
    const link = await manager.save(manager.create(AcceptedOfferingQuoteLinkEntity, { id: randomUUID(), quoteSnapshotId: prepared.quote.id, bookingItemId: null, eventId: null, programRegistrationId: registration.id, targetVersion: registration.version, acceptedAt: now, acceptedBy: actor.id, operationId, requestId, entrySurface: "internal" }))
    const event = OperationalQuoteAcceptanceOutboxEventSchema.parse({ schemaVersion: 1, eventId: randomUUID(), eventType: "crm.operational_quote.accepted", occurredAt: link.acceptedAt.toISOString(), actorId: actor.id, requestId, operationId, entrySurface: "internal", target: { type: "program_registration", id: registration.id, aggregateId: registration.occurrenceId, version: registration.version }, quote: { quoteSnapshotId: prepared.quote.id, offeringId: prepared.quote.offeringId, offeringVersion: prepared.quote.offeringVersion, pricingVersion: prepared.quote.pricingVersion, addOnsVersion: prepared.quote.addOnAssignmentsVersion, priceBookVersion: prepared.quote.priceBookVersion, calendarVersion: prepared.quote.businessCalendarVersion, currency: prepared.result.currency } })
    await manager.save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "program_registration", entityId: registration.id, action: "quote_accepted", actorId: actor.id, requestId, changes: { quoteSnapshotId: prepared.quote.id, acceptanceId: link.id, occurrenceId: registration.occurrenceId, registrationVersion: registration.version }, createdAt: link.acceptedAt }))
    await manager.save(manager.create(OutboxEventEntity, { id: event.eventId, topic: event.eventType, aggregateType: "program_registration", aggregateId: registration.id, payload: event as unknown as Record<string, unknown>, availableAt: link.acceptedAt, processedAt: null, attempts: 0, createdAt: link.acceptedAt }))
    await manager.save(manager.create(OutboxDeliveryEntity, { eventId: event.eventId, consumer: "sse", status: "pending", attempts: 0, availableAt: link.acceptedAt, processedAt: null, lastError: null, createdAt: link.acceptedAt, updatedAt: link.acceptedAt }))
  }

  private prepare(item: BookingItemEntity, quote: OfferingQuoteSnapshotEntity): PreparedAcceptance {
    const context = quote.operationalContext === null ? null : HouseStayQuoteOperationalContextSchema.safeParse(quote.operationalContext)
    if (!context?.success) throw failure("QUOTE_NOT_ACCEPTANCE_READY", "Расчёт не содержит совместимого operational context", { quoteSnapshotId: quote.id })
    const request = InternalOfferingQuoteRequestSchema.safeParse(quote.requestPayload)
    const result = InternalOfferingQuoteResultSchema.safeParse(quote.resultPayload)
    if (!request.success || request.data.period.type !== "stay" || !result.success || result.data.quoteId !== quote.id || result.data.offeringId !== quote.offeringId || request.data.offeringId !== quote.offeringId) throw failure("QUOTE_SNAPSHOT_INVALID", "Сохранённый расчёт имеет неверный формат")
    return { item, quote, context: context.data, request: request.data, result: result.data }
  }

  private async acceptOne(manager: EntityManager, booking: BookingEntity, entry: PreparedAcceptance, offerings: ReadonlyMap<string, CatalogOfferingEntity>, bindings: ReadonlyMap<string, OfferingBindingEntity>, resources: ReadonlyMap<string, ResourceEntity>, actor: SessionUser, requestId: string, operationId: string, now: Date) {
    const { item, quote, context, request, result } = entry
    if (quote.validUntil <= now) throw failure("QUOTE_EXPIRED", "Срок действия расчёта истёк", { quoteSnapshotId: quote.id })
    const offering = offerings.get(quote.offeringId)
    if (!offering || offering.kind !== "house" || offering.archivedAt !== null) throw failure("QUOTE_TARGET_UNSUPPORTED", "Расчёт не относится к доступному house offering")
    const binding = bindings.get(offering.id)
    const resource = resources.get(context.primaryResourceId)
    if (!binding?.resourceId || binding.resourceId !== context.primaryResourceId || !resource || resource.archivedAt !== null || resource.version !== context.primaryResourceVersion || offering.subjectVersion !== context.subjectVersion) throw failure("QUOTE_CONTEXT_MISMATCH", "Условия исполнения предложения изменились после расчёта")
    if (item.type !== "accommodation" || item.resourceId !== context.primaryResourceId) throw failure("QUOTE_ITEM_MISMATCH", "Расчёт не соответствует позиции бронирования")
    if (item.currency !== result.currency || item.priceAmount !== result.total.amountMinor || item.discountAmount !== 0) throw failure("QUOTE_AMOUNT_MISMATCH", "Сумма или валюта позиции не соответствует расчёту")
    const arrival = localDate(item.startAt, offering.timezone), departure = localDate(item.endAt, offering.timezone)
    if (request.period.type !== "stay") throw failure("QUOTE_SNAPSHOT_INVALID", "Сохранённый расчёт имеет неверный формат")
    if (request.period.arrivalDate !== arrival || request.period.departureDate !== departure || request.quantities.units !== 1 || request.quantities.guests !== item.quantity) throw failure("QUOTE_PERIOD_MISMATCH", "Период или количество гостей не соответствует расчёту")
    const requestedAddOns = request.addOns
      .map(({ assignmentId, quantity }) => ({ assignmentId, quantity }))
      .sort((left, right) => left.assignmentId.localeCompare(right.assignmentId))
    const selectedAddOns = item.addOnSelections
      .map(({ assignmentId, quantity }) => ({ assignmentId, quantity }))
      .sort((left, right) => left.assignmentId.localeCompare(right.assignmentId))
    if (JSON.stringify(requestedAddOns) !== JSON.stringify(selectedAddOns)) throw failure("QUOTE_ADDONS_MISMATCH", "Состав дополнительных услуг не соответствует расчёту")
    if (selectedAddOns.length > 0 && item.quoteSnapshotId !== quote.id) throw failure("QUOTE_ADDONS_MISMATCH", "Позиция бронирования не связана с выбранным расчётом дополнительных услуг")
    const link = await manager.save(manager.create(AcceptedOfferingQuoteLinkEntity, { id: randomUUID(), quoteSnapshotId: quote.id, bookingItemId: item.id, eventId: null, programRegistrationId: null, targetVersion: booking.version, acceptedAt: now, acceptedBy: actor.id, operationId, requestId, entrySurface: "internal" }))
    const event = OperationalQuoteAcceptanceOutboxEventSchema.parse({ schemaVersion: 1, eventId: randomUUID(), eventType: "crm.operational_quote.accepted", occurredAt: now.toISOString(), actorId: actor.id, requestId, operationId, entrySurface: "internal", target: { type: "booking_item", id: item.id, aggregateId: booking.id, version: booking.version }, quote: { quoteSnapshotId: quote.id, offeringId: quote.offeringId, offeringVersion: quote.offeringVersion, pricingVersion: quote.pricingVersion, addOnsVersion: quote.addOnAssignmentsVersion, priceBookVersion: quote.priceBookVersion, calendarVersion: quote.businessCalendarVersion, currency: result.currency } })
    await manager.save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "booking_item", entityId: item.id, action: "quote_accepted", actorId: actor.id, requestId, changes: { quoteSnapshotId: quote.id, acceptanceId: link.id, bookingId: booking.id, bookingVersion: booking.version }, createdAt: now }))
    await manager.save(manager.create(OutboxEventEntity, { id: event.eventId, topic: event.eventType, aggregateType: "booking_item", aggregateId: item.id, payload: event as unknown as Record<string, unknown>, availableAt: now, processedAt: null, attempts: 0, createdAt: now }))
    await manager.save(manager.create(OutboxDeliveryEntity, { eventId: event.eventId, consumer: "sse", status: "pending", attempts: 0, availableAt: now, processedAt: null, lastError: null, createdAt: now, updatedAt: now }))
  }

  private async databaseNow(manager: EntityManager) { const rows = await manager.query("SELECT clock_timestamp() AS now") as Array<{ now: Date | string }>; return new Date(rows[0]!.now) }
}

function localDate(value: Date, timezone: string) { const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value); const get = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)!.value; return `${get("year")}-${get("month")}-${get("day")}` }
function failure(code: string, message: string, details: Record<string, unknown> = {}) { return new UnprocessableEntityException({ code, message, details }) }
