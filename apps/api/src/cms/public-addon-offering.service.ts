import { createHash } from "node:crypto"

import { BadRequestException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common"
import { DataSource, In, IsNull } from "typeorm"

import {
  PublicAddOnListResponseSchema,
  PublicAddOnProjectionPinSchema,
  PublicAddOnSummaryParamsSchema,
  PublicAddOnSummarySchema,
  PublicAddOnTermsSchema,
  PublicReleasePageContentSchema,
  ReleaseDependencyRefSchema,
  type PublicAddOnListQuery,
  type PublicAddOnListResponse,
  type PublicAddOnSummary,
} from "@crm/contracts"
import { PriceRuleEntity, RatePlanEntity } from "@crm/db"

import {
  PUBLIC_ADDON_PROJECTION_CONTRACT,
  publicAddOnProjectionPinHash,
} from "../offerings/public-addon-projection.js"
import { resolvedContentHash } from "./public-content.service.js"

type ProjectionRow = {
  releaseId: string
  releaseCreatedAt: Date
  releasePublishedAt: Date | null
  nodeId: string
  revisionId: string
  resolvedContent: unknown
  resolvedContentHash: string
  dependencies: unknown
  offeringId: string
  offeringVersion: number
  offeringUpdatedAt: Date
  pricingVersion: number
  salesMode: string
  priceDisplayMode: string
  currency: string
  timezone: string
  categoryKey: string
  serviceType: string
  standalone: boolean
  minimumQuantity: number | null
  maximumQuantity: number | null
  defaultQuantity: number | null
  quantityStep: number | null
  calendarVersion: number
  calendarUpdatedAt: Date
  priceBookId: string | null
  priceBookRevision: number | null
  priceBookState: string | null
  priceBookValidFrom: string | null
  priceBookValidToExclusive: string | null
  priceBookUpdatedAt: Date | null
  titleKey: string
}

type Cursor = { title: string; id: string }
export type PublicProjectionDocument<T> = Readonly<{ data: T; etag: string; cacheTags: string[] }>

@Injectable()
export class PublicAddonOfferingService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async list(query: PublicAddOnListQuery): Promise<PublicProjectionDocument<PublicAddOnListResponse>> {
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : null
    const rows = await this.rows({
      offeringId: null,
      categoryKey: query.categoryKey ?? null,
      standalone: query.standalone ?? null,
      cursor,
      limit: query.limit + 1,
    })
    const release = await this.activeRelease()
    const pageRows = rows.slice(0, query.limit)
    const summaries = await this.summaries(pageRows)
    const last = pageRows.at(-1)
    const asOf = summaries.reduce((latest, item) => item.asOf > latest ? item.asOf : latest, release.asOf)
    const data = PublicAddOnListResponseSchema.parse({
      items: summaries,
      nextCursor: rows.length > query.limit && last ? this.encodeCursor({ title: last.titleKey, id: last.offeringId }) : null,
      releaseId: release.id,
      asOf,
    })
    return this.document(data, [`cms-release:${release.id}`, "public-offering-kind:addon", "public-offering-collection"])
  }

  async detail(offeringId: string): Promise<PublicProjectionDocument<PublicAddOnSummary>> {
    PublicAddOnSummaryParamsSchema.parse({ offeringId })
    const rows = await this.rows({ offeringId, categoryKey: null, standalone: null, cursor: null, limit: 1 })
    const row = rows[0]
    if (!row) throw this.notFound()
    const summary = (await this.summaries([row]))[0]
    if (!summary) throw this.invalidProjection()
    return this.document(summary, [
      `cms-release:${row.releaseId}`,
      `cms-node:${row.nodeId}`,
      `public-offering:${row.offeringId}`,
      "public-offering-kind:addon",
      "public-offering-collection",
    ])
  }

  private async rows(input: { offeringId: string | null; categoryKey: string | null; standalone: boolean | null; cursor: Cursor | null; limit: number }): Promise<ProjectionRow[]> {
    return this.dataSource.query(`
      SELECT release.id AS "releaseId", release.created_at AS "releaseCreatedAt",
        release.published_at AS "releasePublishedAt", item.node_id AS "nodeId",
        item.revision_id AS "revisionId", item.resolved_content AS "resolvedContent",
        item.resolved_content_hash AS "resolvedContentHash", item.dependencies,
        offering.id AS "offeringId", offering.version AS "offeringVersion",
        offering.updated_at AS "offeringUpdatedAt", offering.pricing_version AS "pricingVersion",
        offering.sales_mode AS "salesMode", offering.price_display_mode AS "priceDisplayMode",
        offering.currency, offering.timezone, terms.category_key AS "categoryKey",
        terms.service_type AS "serviceType", terms.standalone,
        terms.minimum_quantity AS "minimumQuantity", terms.maximum_quantity AS "maximumQuantity",
        terms.default_quantity AS "defaultQuantity", terms.quantity_step AS "quantityStep",
        calendar.version AS "calendarVersion", calendar.updated_at AS "calendarUpdatedAt",
        price_book.id AS "priceBookId", price_book.revision AS "priceBookRevision",
        price_book.state AS "priceBookState", TO_CHAR(price_book.valid_from, 'YYYY-MM-DD') AS "priceBookValidFrom",
        TO_CHAR(price_book.valid_to_exclusive, 'YYYY-MM-DD') AS "priceBookValidToExclusive", price_book.updated_at AS "priceBookUpdatedAt",
        LOWER(COALESCE(item.resolved_content->>'title', '')) AS "titleKey"
      FROM cms_active_release active
      JOIN cms_releases release ON release.id = active.release_id AND release.state = 'published'
      JOIN cms_release_items item ON item.release_id = release.id
      JOIN cms_nodes node ON node.id = item.node_id AND node.kind = 'addon_detail'
        AND node.status = 'active' AND node.archived_at IS NULL
      JOIN cms_source_links source ON source.node_id = item.node_id
        AND source.source_kind = 'catalog_offering'
      JOIN cms_public_profiles profile ON profile.node_id = item.node_id
        AND profile.kind = 'catalog_offering' AND profile.entity_id = source.source_id
        AND profile.archived_at IS NULL
      JOIN catalog_offerings offering ON offering.id = source.source_id
        AND offering.kind = 'addon' AND offering.state = 'active' AND offering.archived_at IS NULL
      JOIN addon_offering_terms terms ON terms.offering_id = offering.id
        AND terms.offering_kind = 'addon' AND terms.service_type IN ('quantity_service', 'person_service')
      JOIN business_calendars calendar ON calendar.id = offering.business_calendar_id
        AND calendar.archived_at IS NULL
      LEFT JOIN price_books price_book ON price_book.id = offering.active_price_book_id
        AND price_book.offering_id = offering.id AND price_book.archived_at IS NULL
      WHERE active.singleton_key = 'public'
        AND ($1::uuid IS NULL OR offering.id = $1::uuid)
        AND ($2::text IS NULL OR terms.category_key = $2::text)
        AND ($3::boolean IS NULL OR terms.standalone = $3::boolean)
        AND ($4::text IS NULL OR LOWER(COALESCE(item.resolved_content->>'title', '')) > $4::text
          OR (LOWER(COALESCE(item.resolved_content->>'title', '')) = $4::text AND offering.id > $5::uuid))
      ORDER BY LOWER(COALESCE(item.resolved_content->>'title', '')) ASC, offering.id ASC
      LIMIT $6
    `, [input.offeringId, input.categoryKey, input.standalone, input.cursor?.title ?? null, input.cursor?.id ?? null, input.limit]) as Promise<ProjectionRow[]>
  }

  private async summaries(rows: ProjectionRow[]): Promise<PublicAddOnSummary[]> {
    if (rows.length === 0) return []
    const priceBookIds = rows.flatMap((row) => row.priceBookId ? [row.priceBookId] : [])
    const plans = priceBookIds.length > 0
      ? await this.dataSource.getRepository(RatePlanEntity).findBy({ priceBookId: In(priceBookIds), archivedAt: IsNull() })
      : []
    const rules = plans.length > 0
      ? await this.dataSource.getRepository(PriceRuleEntity).findBy({ ratePlanId: In(plans.map((plan) => plan.id)), enabled: true, archivedAt: IsNull() })
      : []
    const plansByBook = new Map<string, RatePlanEntity[]>()
    for (const plan of plans) plansByBook.set(plan.priceBookId, [...(plansByBook.get(plan.priceBookId) ?? []), plan])
    const rulesByPlan = new Map<string, PriceRuleEntity[]>()
    for (const rule of rules) rulesByPlan.set(rule.ratePlanId, [...(rulesByPlan.get(rule.ratePlanId) ?? []), rule])
    return rows.map((row) => this.summary(row, plansByBook.get(row.priceBookId ?? "") ?? [], rulesByPlan))
  }

  private summary(row: ProjectionRow, plans: RatePlanEntity[], rulesByPlan: Map<string, PriceRuleEntity[]>): PublicAddOnSummary {
    const content = PublicReleasePageContentSchema.safeParse(row.resolvedContent)
    if (!content.success || content.data.kind !== "addon_detail" || resolvedContentHash(row.resolvedContent) !== row.resolvedContentHash) throw this.invalidProjection()
    const pin = PublicAddOnProjectionPinSchema.parse({
      contract: PUBLIC_ADDON_PROJECTION_CONTRACT,
      offeringId: row.offeringId,
      kind: "addon",
      nodeId: row.nodeId,
      profileRevisionId: row.revisionId,
    })
    const dependencies = ReleaseDependencyRefSchema.array().safeParse(row.dependencies)
    const dependency = dependencies.success
      ? dependencies.data.find((candidate) => candidate.type === "crm_projection" && candidate.id === row.offeringId)
      : undefined
    if (!dependency || dependency.version !== pin.contract || dependency.contentHash !== publicAddOnProjectionPinHash(pin)) throw this.invalidProjection()
    const terms = PublicAddOnTermsSchema.safeParse({
      serviceType: row.serviceType,
      standalone: row.standalone,
      categoryKey: row.categoryKey,
      quantity: {
        unit: row.serviceType === "person_service" ? "participants" : "unit",
        minimum: row.minimumQuantity,
        maximum: row.maximumQuantity,
        default: row.defaultQuantity,
        step: row.quantityStep,
      },
    })
    if (!terms.success) throw this.invalidProjection()
    const now = new Date()
    const localDate = dateInTimeZone(now, row.timezone)
    const activeBook = row.priceBookId !== null && row.priceBookState === "active"
      && row.priceBookValidFrom !== null && row.priceBookValidFrom <= localDate
      && (row.priceBookValidToExclusive === null || localDate < row.priceBookValidToExclusive)
    const amounts = activeBook ? plans.flatMap((plan) => [
      plan.baseAmountMinor,
      ...(rulesByPlan.get(plan.id) ?? []).flatMap((rule) => rule.amountMinor === null ? [] : [rule.amountMinor]),
    ]) : []
    const uniqueAmounts = [...new Set(amounts)].sort((left, right) => left - right)
    const price = row.priceDisplayMode === "exact" && uniqueAmounts.length === 1
      ? { mode: "exact" as const, amount: { amountMinor: uniqueAmounts[0]!, currency: row.currency } }
      : row.priceDisplayMode === "from" && uniqueAmounts.length > 0
        ? { mode: "from" as const, amount: { amountMinor: uniqueAmounts[0]!, currency: row.currency } }
        : { mode: "request" as const }
    const asOf = latestDate(row.releasePublishedAt, row.releaseCreatedAt, row.offeringUpdatedAt, row.calendarUpdatedAt, row.priceBookUpdatedAt).toISOString()
    return PublicAddOnSummarySchema.parse({
      offeringId: row.offeringId,
      kind: "addon",
      title: content.data.title,
      summary: content.data.summary,
      price,
      priceBasisLabel: row.serviceType === "person_service" ? "за человека" : "за единицу",
      quoteAvailable: false,
      requestAvailable: true,
      capacity: null,
      readiness: price.mode === "request" || row.salesMode === "request_only" ? "request_only" : "ready",
      timezone: row.timezone,
      currency: row.currency,
      sourceVersions: {
        offering: row.offeringVersion,
        pricing: row.pricingVersion,
        priceBook: activeBook ? row.priceBookRevision : null,
        calendar: row.calendarVersion,
        contentReleaseId: row.releaseId,
        profileRevisionId: row.revisionId,
      },
      asOf,
      terms: terms.data,
    })
  }

  private async activeRelease(): Promise<{ id: string; asOf: string }> {
    const rows = await this.dataSource.query(`
      SELECT release.id, COALESCE(release.published_at, release.created_at) AS "asOf"
      FROM cms_active_release active
      JOIN cms_releases release ON release.id = active.release_id AND release.state = 'published'
      WHERE active.singleton_key = 'public'
      LIMIT 1
    `) as Array<{ id: string; asOf: Date }>
    const row = rows[0]
    if (!row) throw this.notFound()
    return { id: row.id, asOf: row.asOf.toISOString() }
  }

  private document<T>(data: T, cacheTags: string[]): PublicProjectionDocument<T> {
    return { data, etag: `"${createHash("sha256").update(stableStringify(data)).digest("hex")}"`, cacheTags }
  }

  private encodeCursor(cursor: Cursor) { return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url") }
  private decodeCursor(value: string): Cursor {
    try {
      const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<Cursor>
      if (typeof parsed.title !== "string" || !PublicAddOnSummaryParamsSchema.safeParse({ offeringId: parsed.id }).success) throw new Error("invalid")
      return { title: parsed.title, id: parsed.id! }
    } catch {
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Некорректный cursor", fieldErrors: { cursor: ["Некорректный cursor"] }, details: {} })
    }
  }
  private notFound() { return new NotFoundException({ code: "NOT_FOUND", message: "Опубликованная дополнительная услуга не найдена" }) }
  private invalidProjection() { return new ServiceUnavailableException({ code: "PUBLIC_PROJECTION_INVALID", message: "Публичная проекция дополнительной услуги требует повторной публикации" }) }
}

function dateInTimeZone(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value)
  const byType = new Map(parts.map((part) => [part.type, part.value]))
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`
}

function latestDate(...values: Array<Date | null>): Date {
  return new Date(Math.max(...values.filter((value): value is Date => value instanceof Date).map((value) => value.getTime())))
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`
  return JSON.stringify(value)
}
