import { randomUUID } from "node:crypto"

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { DataSource, In, IsNull, QueryFailedError, type EntityManager } from "typeorm"

import {
  MarketingReportSchema,
  PromotionListSchema,
  PromotionSchema,
  PromotionTermsSchema,
  type MarketingPeriod,
  type MarketingReport,
  type Promotion,
  type PromotionMutation,
  type PromotionTerms,
  type PromotionUpdate,
  type SessionUser,
} from "@crm/contracts"
import {
  CatalogOfferingEntity,
  ChangeLogEntity,
  IdempotencyKeyEntity,
  OutboxEventEntity,
  PromotionEntity,
  ResourceEntity,
} from "@crm/db"

import { canonicalSha256 } from "../offerings/offering-mutation-support.js"

type StoredReplay = Pick<IdempotencyKeyEntity, "operationId" | "idempotencyKey" | "requestHash" | "responseBody">
type PromotionReportRow = {
  promotion_id: string
  bookings: string
  confirmed_bookings: string
  discount_amount_minor: string
  booking_amount_minor: string
  paid_amount_minor: string
}
type CampaignReportRow = {
  source: string
  medium: string
  campaign: string
  content: string
  term: string
  leads: string
  qualified_leads: string
  bookings: string
  paid_amount_minor: string
}

const moscowDayStart = (day: string) => new Date(`${day}T00:00:00+03:00`)

@Injectable()
export class MarketingService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async listPromotions(actor: SessionUser) {
    this.assertCanView(actor)
    const items = await this.dataSource.getRepository(PromotionEntity).find({
      where: { archivedAt: IsNull() }, order: { code: "ASC", id: "ASC" },
    })
    return PromotionListSchema.parse({ items: items.map((item) => this.toPromotion(item)), canManage: actor.capabilities.canManageSettings })
  }

  async getPromotion(id: string, actor: SessionUser): Promise<Promotion> {
    this.assertCanView(actor)
    return this.toPromotion(await this.requirePromotion(this.dataSource.manager, id))
  }

  async createPromotion(input: PromotionMutation, actor: SessionUser, requestId: string): Promise<Promotion> {
    this.assertCanManage(actor)
    return this.retrySerializable(() => this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = "marketing:promotions"
      const requestHash = canonicalSha256({ command: "marketing.promotion.create", input })
      const replay = await this.replay<Promotion>(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return replay

      const terms = this.normalizedTerms(input.terms)
      await this.lockCodes(manager, [terms.code])
      const duplicate = await manager.getRepository(PromotionEntity).findOneBy({ code: terms.code })
      if (duplicate) throw new ConflictException({ code: "PROMOTION_CODE_EXISTS", message: "Промокод уже существует", details: { code: terms.code } })
      await this.assertTargets(manager, terms)

      const promotion = await manager.save(manager.create(PromotionEntity, {
        id: randomUUID(), code: terms.code, terms: terms as unknown as Record<string, unknown>,
        createdBy: actor.id, updatedBy: actor.id, archivedAt: null,
      }))
      const response = this.toPromotion(promotion)
      await this.recordMutation(manager, promotion, "created", actor.id, requestId, { after: response, operationId: input.operationId })
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    }))
  }

  async updatePromotion(id: string, input: PromotionUpdate, actor: SessionUser, requestId: string): Promise<Promotion> {
    this.assertCanManage(actor)
    return this.retrySerializable(() => this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = `marketing:promotion:${id}`
      const requestHash = canonicalSha256({ command: "marketing.promotion.update", id, input })
      const replay = await this.replay<Promotion>(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return replay

      const terms = this.normalizedTerms(input.terms)
      await this.lockCodes(manager, [terms.code])
      const current = await this.requirePromotion(manager, id, true)
      if (current.version !== input.expectedVersion) throw this.versionConflict(current)
      const duplicate = await manager.getRepository(PromotionEntity).findOneBy({ code: terms.code })
      if (duplicate && duplicate.id !== current.id) throw new ConflictException({ code: "PROMOTION_CODE_EXISTS", message: "Промокод уже существует", details: { code: terms.code } })
      await this.assertTargets(manager, terms)

      const before = this.toPromotion(current)
      const changed = await manager.createQueryBuilder().update(PromotionEntity).set({
        code: terms.code, terms: terms as unknown as Record<string, unknown>, updatedBy: actor.id,
        version: () => '"version" + 1', updatedAt: () => "now()",
      }).where("id = :id AND version = :version", { id, version: input.expectedVersion }).execute()
      if (changed.affected !== 1) throw this.versionConflict(await this.requirePromotion(manager, id, true))
      const saved = await this.requirePromotion(manager, id, true)
      const response = this.toPromotion(saved)
      await this.recordMutation(manager, saved, "updated", actor.id, requestId, { before, after: response, operationId: input.operationId })
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    }))
  }

  /**
   * Booking composition calls this inside its own transaction. The shared lock
   * makes a validated code stable through calculation and snapshot persistence.
   */
  async findByCode(manager: EntityManager, code: string): Promise<Promotion> {
    const normalized = this.normalizeCode(code)
    const entity = await manager.getRepository(PromotionEntity).createQueryBuilder("promotion")
      .setLock("pessimistic_read")
      .where("promotion.code = :code", { code: normalized })
      .getOne()
    if (!entity || entity.archivedAt !== null) throw new NotFoundException({ code: "PROMOTION_NOT_FOUND", message: "Промокод не найден" })
    const promotion = this.toPromotion(entity)
    if (!this.isAvailable(promotion.terms, new Date())) {
      throw new ConflictException({ code: "PROMOTION_UNAVAILABLE", message: "Промокод сейчас недоступен", details: { code: normalized } })
    }
    return promotion
  }

  async report(period: MarketingPeriod, actor: SessionUser): Promise<MarketingReport> {
    this.assertCanView(actor)
    if (!actor.capabilities.canViewFinance) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Для отчёта с оплатами нужны права на просмотр финансов" })
    const from = moscowDayStart(period.from)
    const until = moscowDayStart(period.to)
    until.setUTCDate(until.getUTCDate() + 1)
    const [promotionRows, campaignRows] = await Promise.all([
      this.dataSource.query<PromotionReportRow[]>(`
        WITH promotion_bookings AS (
          SELECT b.id, b.status, b.total_amount,
                 b.snapshot #>> '{promotion,promotionId}' AS promotion_id,
                 CASE WHEN b.snapshot #>> '{promotion,discountAmountMinor}' ~ '^[0-9]+$'
                   THEN (b.snapshot #>> '{promotion,discountAmountMinor}')::bigint ELSE 0 END AS discount_amount_minor
          FROM bookings b
          WHERE b.archived_at IS NULL AND b.status <> 'cancelled'
            AND b.created_at >= $1 AND b.created_at < $2
            AND jsonb_typeof(b.snapshot->'promotion') = 'object'
            AND b.snapshot #>> '{promotion,promotionId}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        ), payment_ledger AS (
          SELECT p.booking_id,
                 COALESCE(SUM(CASE WHEN p.kind IN ('charge', 'adjustment') THEN p.amount WHEN p.kind = 'refund' THEN -p.amount ELSE 0 END), 0)::bigint AS paid_amount_minor
          FROM payments p
          WHERE p.booking_id IS NOT NULL
          GROUP BY p.booking_id
        )
        SELECT pb.promotion_id,
               COUNT(DISTINCT pb.id)::text AS bookings,
               COUNT(DISTINCT pb.id) FILTER (WHERE pb.status = 'confirmed')::text AS confirmed_bookings,
               COALESCE(SUM(pb.discount_amount_minor), 0)::text AS discount_amount_minor,
               COALESCE(SUM(pb.total_amount), 0)::text AS booking_amount_minor,
               COALESCE(SUM(ledger.paid_amount_minor), 0)::text AS paid_amount_minor
        FROM promotion_bookings pb
        LEFT JOIN payment_ledger ledger ON ledger.booking_id = pb.id
        GROUP BY pb.promotion_id
        ORDER BY pb.promotion_id ASC
      `, [from, until]),
      this.dataSource.query<CampaignReportRow[]>(`
        WITH campaign_facts AS (
          SELECT
            COALESCE(NULLIF(btrim(l.utm->>'utm_source'), ''), NULLIF(btrim(l.utm->>'source'), ''), '') AS source,
            COALESCE(NULLIF(btrim(l.utm->>'utm_medium'), ''), NULLIF(btrim(l.utm->>'medium'), ''), '') AS medium,
            COALESCE(NULLIF(btrim(l.utm->>'utm_campaign'), ''), NULLIF(btrim(l.utm->>'campaign'), ''), '') AS campaign,
            COALESCE(NULLIF(btrim(l.utm->>'utm_content'), ''), NULLIF(btrim(l.utm->>'content'), ''), '') AS content,
            COALESCE(NULLIF(btrim(l.utm->>'utm_term'), ''), NULLIF(btrim(l.utm->>'term'), ''), '') AS term,
            COUNT(*)::bigint AS leads,
            COUNT(*) FILTER (WHERE l.status IN ('in_progress', 'waiting', 'success'))::bigint AS qualified_leads,
            0::bigint AS bookings, 0::bigint AS paid_amount_minor
          FROM leads l
          WHERE l.created_at >= $1 AND l.created_at < $2
          GROUP BY 1, 2, 3, 4, 5
          UNION ALL
          SELECT
            COALESCE(NULLIF(btrim(l.utm->>'utm_source'), ''), NULLIF(btrim(l.utm->>'source'), ''), ''),
            COALESCE(NULLIF(btrim(l.utm->>'utm_medium'), ''), NULLIF(btrim(l.utm->>'medium'), ''), ''),
            COALESCE(NULLIF(btrim(l.utm->>'utm_campaign'), ''), NULLIF(btrim(l.utm->>'campaign'), ''), ''),
            COALESCE(NULLIF(btrim(l.utm->>'utm_content'), ''), NULLIF(btrim(l.utm->>'content'), ''), ''),
            COALESCE(NULLIF(btrim(l.utm->>'utm_term'), ''), NULLIF(btrim(l.utm->>'term'), ''), ''),
            0::bigint, 0::bigint, COUNT(DISTINCT b.id)::bigint, 0::bigint
          FROM bookings b
          JOIN booking_lead_links link ON link.booking_id = b.id AND link.unlinked_at IS NULL
          JOIN leads l ON l.id = link.lead_id
          WHERE b.archived_at IS NULL AND b.status <> 'cancelled'
            AND b.created_at >= $1 AND b.created_at < $2
          GROUP BY 1, 2, 3, 4, 5
          UNION ALL
          SELECT
            COALESCE(NULLIF(btrim(l.utm->>'utm_source'), ''), NULLIF(btrim(l.utm->>'source'), ''), ''),
            COALESCE(NULLIF(btrim(l.utm->>'utm_medium'), ''), NULLIF(btrim(l.utm->>'medium'), ''), ''),
            COALESCE(NULLIF(btrim(l.utm->>'utm_campaign'), ''), NULLIF(btrim(l.utm->>'campaign'), ''), ''),
            COALESCE(NULLIF(btrim(l.utm->>'utm_content'), ''), NULLIF(btrim(l.utm->>'content'), ''), ''),
            COALESCE(NULLIF(btrim(l.utm->>'utm_term'), ''), NULLIF(btrim(l.utm->>'term'), ''), ''),
            0::bigint, 0::bigint, 0::bigint,
            COALESCE(SUM(CASE WHEN p.kind IN ('charge', 'adjustment') THEN p.amount WHEN p.kind = 'refund' THEN -p.amount ELSE 0 END), 0)::bigint
          FROM payments p
          JOIN bookings b ON b.id = p.booking_id AND b.archived_at IS NULL AND b.status <> 'cancelled'
          JOIN booking_lead_links link ON link.booking_id = b.id AND link.unlinked_at IS NULL
          JOIN leads l ON l.id = link.lead_id
          WHERE b.created_at >= $1 AND b.created_at < $2
          GROUP BY 1, 2, 3, 4, 5
        )
        SELECT source, medium, campaign, content, term,
               SUM(leads)::text AS leads,
               SUM(qualified_leads)::text AS qualified_leads,
               SUM(bookings)::text AS bookings,
               SUM(paid_amount_minor)::text AS paid_amount_minor
        FROM campaign_facts
        GROUP BY source, medium, campaign, content, term
        ORDER BY source, medium, campaign, content, term
      `, [from, until]),
    ])
    return MarketingReportSchema.parse({
      period,
      visitorsStatus: "not_configured",
      visitors: null,
      attributionModel: "lead_snapshot",
      promotions: promotionRows.map((row) => ({
        promotionId: row.promotion_id, bookings: Number(row.bookings), confirmedBookings: Number(row.confirmed_bookings),
        discountAmountMinor: Number(row.discount_amount_minor), bookingAmountMinor: Number(row.booking_amount_minor), paidAmountMinor: Number(row.paid_amount_minor),
      })),
      campaigns: campaignRows.map((row) => ({
        source: row.source, medium: row.medium, campaign: row.campaign, content: row.content, term: row.term,
        leads: Number(row.leads), qualifiedLeads: Number(row.qualified_leads), bookings: Number(row.bookings), paidAmountMinor: Number(row.paid_amount_minor),
      })),
    })
  }

  private normalizedTerms(terms: PromotionTerms): PromotionTerms {
    const parsed = PromotionTermsSchema.parse(terms)
    return { ...parsed, code: this.normalizeCode(parsed.code) }
  }

  private normalizeCode(code: string) {
    return code.trim().toLocaleUpperCase("ru-RU")
  }

  private async assertTargets(manager: EntityManager, terms: PromotionTerms) {
    if (terms.scope !== "selected") return
    const resourceIds = [...new Set(terms.resourceIds)]
    const offeringIds = [...new Set(terms.offeringIds)]
    const [resources, offerings] = await Promise.all([
      resourceIds.length ? manager.getRepository(ResourceEntity).find({ where: { id: In(resourceIds), archivedAt: IsNull() } }) : [],
      offeringIds.length ? manager.getRepository(CatalogOfferingEntity).find({ where: { id: In(offeringIds), archivedAt: IsNull() } }) : [],
    ])
    const missingResourceIds = resourceIds.filter((id) => !resources.some((resource) => resource.id === id))
    const missingOfferingIds = offeringIds.filter((id) => !offerings.some((offering) => offering.id === id))
    if (missingResourceIds.length || missingOfferingIds.length) {
      throw new UnprocessableEntityException({
        code: "PROMOTION_TARGET_NOT_FOUND", message: "Часть целей промокода не найдена или архивирована",
        details: { resourceIds: missingResourceIds, offeringIds: missingOfferingIds },
      })
    }
  }

  private async requirePromotion(manager: EntityManager, id: string, write = false) {
    const entity = await manager.getRepository(PromotionEntity).findOne({
      where: { id }, ...(write ? { lock: { mode: "pessimistic_write" as const } } : {}),
    })
    if (!entity || entity.archivedAt !== null) throw new NotFoundException({ code: "PROMOTION_NOT_FOUND", message: "Промокод не найден" })
    return entity
  }

  private toPromotion(entity: PromotionEntity): Promotion {
    return PromotionSchema.parse({
      id: entity.id, version: entity.version, terms: entity.terms,
      createdAt: entity.createdAt.toISOString(), updatedAt: entity.updatedAt.toISOString(),
    })
  }

  private isAvailable(terms: PromotionTerms, now: Date) {
    return terms.active
      && (!terms.startsAt || new Date(terms.startsAt) <= now)
      && (!terms.endsAt || new Date(terms.endsAt) > now)
  }

  private async lockCodes(manager: EntityManager, codes: readonly string[]) {
    for (const code of [...new Set(codes)].sort()) await manager.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`promotion-code:${code}`])
  }

  private async replay<T>(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string): Promise<T | null> {
    for (const key of [`idempotency-key:${scope}:${idempotencyKey}`, `idempotency-operation:${scope}:${operationId}`].sort()) {
      await manager.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [key])
    }
    const stored = await manager.getRepository(IdempotencyKeyEntity).createQueryBuilder("key")
      .where("key.scope = :scope", { scope })
      .andWhere("(key.operation_id = :operationId OR key.idempotency_key = :idempotencyKey)", { operationId, idempotencyKey })
      .getOne() as StoredReplay | null
    if (!stored) return null
    if (stored.operationId !== operationId || stored.idempotencyKey !== idempotencyKey || stored.requestHash !== requestHash) {
      throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Ключ идемпотентности уже использован для другой операции" })
    }
    return stored.responseBody as T
  }

  private async remember(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string, response: Promotion) {
    await manager.save(manager.create(IdempotencyKeyEntity, {
      id: randomUUID(), scope, operationId, idempotencyKey, requestHash,
      responseStatus: 200, responseBody: response, createdAt: new Date(),
    }))
  }

  private async recordMutation(manager: EntityManager, promotion: PromotionEntity, action: "created" | "updated", actorId: string, requestId: string, changes: Record<string, unknown>) {
    const now = new Date()
    await manager.save(manager.create(ChangeLogEntity, {
      id: randomUUID(), entityType: "promotion", entityId: promotion.id, action, actorId, requestId, changes, createdAt: now,
    }))
    await manager.save(manager.create(OutboxEventEntity, {
      id: randomUUID(), topic: `promotion.${action}`, aggregateType: "promotion", aggregateId: promotion.id,
      payload: { promotionId: promotion.id, code: promotion.code, version: promotion.version, action },
      availableAt: now, processedAt: null, attempts: 0, createdAt: now,
    }))
  }

  private assertCanView(actor: SessionUser) {
    if (!actor.capabilities.canView) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для просмотра маркетинга" })
  }

  private assertCanManage(actor: SessionUser) {
    if (!actor.capabilities.canManageSettings) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для управления промокодами" })
  }

  private versionConflict(entity: PromotionEntity) {
    return new ConflictException({ code: "VERSION_CONFLICT", message: "Промокод был изменён другим сотрудником", details: { entityId: entity.id, serverVersion: entity.version } })
  }

  private async retrySerializable<T>(operation: () => Promise<T>, remaining = 2): Promise<T> {
    try { return await operation() } catch (error) {
      const code = error instanceof QueryFailedError ? (error.driverError as { code?: string }).code : undefined
      if (remaining > 0 && (code === "40001" || code === "40P01")) return this.retrySerializable(operation, remaining - 1)
      throw error
    }
  }
}
