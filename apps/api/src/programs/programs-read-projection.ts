import { Buffer } from "node:buffer"

import { BadRequestException } from "@nestjs/common"
import { type DataSource, type EntityManager } from "typeorm"

import { ProgramRegistrationQuoteResultSchema, type SessionUser } from "@crm/contracts"
import { AcceptedOfferingQuoteLinkEntity, OfferingQuoteSnapshotEntity, ProgramOccurrenceEntity, ProgramRegistrationEntity, ProgramTemplateEntity } from "@crm/db"

import type {
  ProgramOccurrenceListQuery,
  ProgramRegistrationListQuery,
  ProgramTemplateListQuery,
} from "./programs.contracts.js"

export function programCapabilities(actor: SessionUser, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, actor.capabilities[key as keyof SessionUser["capabilities"]] === true]))
}

export function programTemplateDto(row: ProgramTemplateEntity, actor: SessionUser) { return { id: row.id, version: row.version, code: row.code, name: row.name, categoryId: row.categoryId, durationMinutes: row.durationMinutes, minimumParticipants: row.minimumParticipants, participantLimit: row.participantLimit, registrationCloseHours: row.registrationCloseHours === null ? null : Number(row.registrationCloseHours), basePrice: { amountMinor: row.basePriceAmount, currency: row.currency }, description: row.description, publication: row.publication, published: row.publication === "published", assigneeIds: row.assigneeIds, stages: (row.stages ?? []).map((stage) => ({ id: String(stage.id), name: String(stage.name), durationMinutes: Number(stage.durationMinutes), comment: String(stage.comment ?? "") })), nextOccurrence: null, archived: row.archivedAt !== null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), capabilities: programCapabilities(actor, ["canView", "canCreate", "canEdit", "canArchive", "canChangeStatus"]) } }
export async function programOccurrenceDto(manager: EntityManager, row: ProgramOccurrenceEntity, actor: SessionUser) { const aggregates = await manager.getRepository(ProgramRegistrationEntity).createQueryBuilder("registration").select("COALESCE(SUM(registration.participant_count),0)", "participants").addSelect("COUNT(registration.id)", "registrations").addSelect("COALESCE(SUM(registration.total_amount),0)", "revenue").addSelect("COALESCE(SUM(registration.paid_amount),0)", "paid").where("registration.occurrence_id = :id AND registration.archived_at IS NULL AND registration.status <> 'cancelled'", { id: row.id }).getRawOne<{ participants: string; registrations: string; revenue: string; paid: string }>(); return { id: row.id, version: row.version, code: row.code, templateId: row.templateId, name: row.name, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString(), participantLimit: row.participantLimit, registrationLimit: row.registrationLimit, participantCount: Number(aggregates?.participants ?? 0), registrationCount: Number(aggregates?.registrations ?? 0), revenue: { amountMinor: Number(aggregates?.revenue ?? 0), currency: row.currency }, paid: { amountMinor: Number(aggregates?.paid ?? 0), currency: row.currency }, status: row.status, comment: row.comment, assigneeIds: row.assigneeIds, archived: row.archivedAt !== null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), capabilities: programCapabilities(actor, ["canView", "canCreate", "canEdit", "canArchive", "canChangeStatus", "canOverrideConflict"]) } }
export async function programRegistrationDto(manager: EntityManager, row: ProgramRegistrationEntity, actor: SessionUser) {
    const link = await manager.findOne(AcceptedOfferingQuoteLinkEntity, { where: { programRegistrationId: row.id } })
    let acceptedQuote = null
    if (link) {
      const quote = await manager.findOneByOrFail(OfferingQuoteSnapshotEntity, { id: link.quoteSnapshotId })
      const result = ProgramRegistrationQuoteResultSchema.parse(quote.resultPayload)
      acceptedQuote = { quoteId: quote.id, acceptedAt: link.acceptedAt.toISOString(), total: result.total, lines: result.lines, addOns: result.inputs.addOns }
    }
    return { id: row.id, version: row.version, code: row.code, occurrenceId: row.occurrenceId, customerId: row.customerId, phone: row.phone, participantCount: row.participantCount, participantNames: row.participantNames, total: { amountMinor: row.totalAmount, currency: row.currency }, discount: { amountMinor: row.discountAmount, currency: row.currency }, paid: { amountMinor: row.paidAmount, currency: row.currency }, pricingMode: row.pricingMode as "legacy_unpriced" | "quote_required", acceptedQuote, status: row.status, promo: row.promo, source: row.source, comment: row.comment, archived: row.archivedAt !== null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), capabilities: programCapabilities(actor, ["canView", "canCreate", "canEdit", "canArchive", "canChangeStatus", "canAddPayment", "canRefund"]) }
  }
export function encodeRegistrationCursor(row: ProgramRegistrationEntity) {
  return Buffer.from(JSON.stringify({ cursorCreatedAt: row.createdAt.toISOString(), cursorId: row.id }), "utf8").toString("base64url")
}

export function decodeRegistrationCursor(value: string): { cursorCreatedAt: Date; cursorId: string } {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { cursorCreatedAt?: unknown; cursorId?: unknown }
    const cursorCreatedAt = new Date(String(parsed.cursorCreatedAt ?? ""))
    const cursorId = String(parsed.cursorId ?? "")
    if (Number.isNaN(cursorCreatedAt.getTime()) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cursorId)) throw new Error("invalid cursor")
    return { cursorCreatedAt, cursorId }
  } catch {
    throw new BadRequestException({ code: "INVALID_CURSOR", message: "Курсор регистраций неверен" })
  }
}

export async function listProgramTemplates(dataSource: DataSource, query: ProgramTemplateListQuery, actor: SessionUser) {
  const builder = dataSource.getRepository(ProgramTemplateEntity).createQueryBuilder("template")
    .where(query.archived === true ? "template.archived_at IS NOT NULL" : "template.archived_at IS NULL")
  if (query.publication) builder.andWhere("template.publication = :publication", { publication: query.publication })
  if (query.categoryId) builder.andWhere("template.category_id = :categoryId", { categoryId: query.categoryId })
  if (query.cursor) builder.andWhere("template.created_at < :cursor", { cursor: new Date(query.cursor) })
  builder.orderBy("template.created_at", "DESC").take(query.limit + 1)
  const rows = await builder.getMany(); const page = rows.slice(0, query.limit)
  return { items: page.map((row) => programTemplateDto(row, actor)), nextCursor: rows.length > query.limit ? page.at(-1)?.createdAt.toISOString() ?? null : null }
}

export async function listProgramOccurrences(dataSource: DataSource, query: ProgramOccurrenceListQuery, actor: SessionUser) {
  const builder = dataSource.getRepository(ProgramOccurrenceEntity).createQueryBuilder("occurrence").where(query.archived === true ? "occurrence.archived_at IS NOT NULL" : "occurrence.archived_at IS NULL")
  if (query.templateId) builder.andWhere("occurrence.template_id = :templateId", { templateId: query.templateId }); if (query.status) builder.andWhere("occurrence.status = :status", { status: query.status }); if (query.from) builder.andWhere("occurrence.starts_at >= :from", { from: new Date(query.from) }); if (query.to) builder.andWhere("occurrence.starts_at < :to", { to: new Date(query.to) }); if (query.cursor) builder.andWhere("occurrence.starts_at > :cursor", { cursor: new Date(query.cursor) }); builder.orderBy("occurrence.starts_at", "ASC").take(query.limit + 1)
  const rows = await builder.getMany(); const page = rows.slice(0, query.limit); return { items: await Promise.all(page.map((row) => programOccurrenceDto(dataSource.manager, row, actor))), nextCursor: rows.length > query.limit ? page.at(-1)?.startsAt.toISOString() ?? null : null }
}

export async function listProgramRegistrations(dataSource: DataSource, query: ProgramRegistrationListQuery, actor: SessionUser) {
  const builder = dataSource.getRepository(ProgramRegistrationEntity).createQueryBuilder("registration")
    .where(query.archived === true ? "registration.archived_at IS NOT NULL" : "registration.archived_at IS NULL")
  if (query.occurrenceId) builder.andWhere("registration.occurrence_id = :occurrenceId", { occurrenceId: query.occurrenceId })
  if (query.customerId) builder.andWhere("registration.customer_id = :customerId", { customerId: query.customerId })
  if (query.status) builder.andWhere("registration.status = :status", { status: query.status })
  if (query.cursor) {
    const cursor = decodeRegistrationCursor(query.cursor)
    builder.andWhere("(date_trunc('milliseconds', registration.created_at) < :cursorCreatedAt OR (date_trunc('milliseconds', registration.created_at) = :cursorCreatedAt AND registration.id < :cursorId))", cursor)
  }
  builder.orderBy("date_trunc('milliseconds', registration.created_at)", "DESC").addOrderBy("registration.id", "DESC").take(query.limit + 1)
  const rows = await builder.getMany(); const page = rows.slice(0, query.limit)
  return { items: await Promise.all(page.map((row) => programRegistrationDto(dataSource.manager, row, actor))), nextCursor: rows.length > query.limit && page.length ? encodeRegistrationCursor(page.at(-1)!) : null }
}
