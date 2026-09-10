import { createHash } from "node:crypto"

import { BadRequestException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common"
import { DataSource, In, IsNull } from "typeorm"

import {
  IdSchema,
  PublicCampgroundDetailQuerySchema,
  PublicCampgroundListResponseSchema,
  PublicCampgroundProjectionPinSchema,
  PublicCampgroundSummarySchema,
  PublicReleasePageContentSchema,
  ReleaseDependencyRefSchema,
  type PublicCampgroundDetailQuery,
  type PublicCampgroundListQuery,
  type PublicCampgroundListResponse,
  type PublicCampgroundSummary,
} from "@crm/contracts"
import { PriceRuleEntity, RatePlanEntity } from "@crm/db"

import { PUBLIC_CAMPGROUND_PROJECTION_CONTRACT, publicCampgroundProjectionPinHash } from "../offerings/public-campground-projection.js"
import { resolvedContentHash } from "./public-content.service.js"

type ProjectionRow = {
  releaseId: string
  releaseCreatedAt: Date
  releasePublishedAt: Date | null
  nodeId: string
  revisionId: string
  path: string
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
  calendarVersion: number
  calendarUpdatedAt: Date
  priceBookId: string | null
  priceBookRevision: number | null
  priceBookState: string | null
  priceBookValidFrom: string | null
  priceBookValidToExclusive: string | null
  priceBookUpdatedAt: Date | null
  sellableUnit: "owned_tent" | "own_tent_pitch"
  inventoryMode: "discrete_inventory" | "shared_capacity"
  capacityTotal: number
  resourceActive: boolean
  titleKey: string
}

type Cursor = { title: string; id: string }
export type PublicCampgroundProjectionDocument<T> = Readonly<{ data: T; etag: string; cacheTags: string[] }>

@Injectable()
export class PublicCampgroundOfferingService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async list(query: PublicCampgroundListQuery): Promise<PublicCampgroundProjectionDocument<PublicCampgroundListResponse>> {
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : null
    const rows = await this.rows(null, cursor, query.limit + 1)
    const pageRows = rows.slice(0, query.limit)
    const summaries = await this.summaries(pageRows)
    const release = await this.activeRelease()
    const last = pageRows.at(-1)
    const data = PublicCampgroundListResponseSchema.parse({
      items: summaries,
      nextCursor: rows.length > query.limit && last ? this.encodeCursor({ title: last.titleKey, id: last.offeringId }) : null,
      releaseId: release.id,
      asOf: summaries.reduce((latest, item) => item.asOf > latest ? item.asOf : latest, release.asOf),
    })
    return this.document(data, [`cms-release:${release.id}`, "public-offering-kind:campground", "public-offering-collection"])
  }

  async detail(query: PublicCampgroundDetailQuery): Promise<PublicCampgroundProjectionDocument<PublicCampgroundSummary>> {
    PublicCampgroundDetailQuerySchema.parse(query)
    const rows = await this.rows(query.path, null, 1)
    const row = rows[0]
    if (!row) throw this.notFound()
    const summary = (await this.summaries([row]))[0]
    if (!summary) throw this.invalidProjection()
    return this.document(summary, [
      `cms-release:${row.releaseId}`,
      `cms-node:${row.nodeId}`,
      `public-offering:${row.offeringId}`,
      "public-offering-kind:campground",
      "public-offering-collection",
    ])
  }

  private async rows(path: string | null, cursor: Cursor | null, limit: number): Promise<ProjectionRow[]> {
    return this.dataSource.query(`
      SELECT release.id AS "releaseId", release.created_at AS "releaseCreatedAt", release.published_at AS "releasePublishedAt",
        item.node_id AS "nodeId", item.revision_id AS "revisionId", item.path,
        item.resolved_content AS "resolvedContent", item.resolved_content_hash AS "resolvedContentHash", item.dependencies,
        offering.id AS "offeringId", offering.version AS "offeringVersion", offering.updated_at AS "offeringUpdatedAt",
        offering.pricing_version AS "pricingVersion", offering.sales_mode AS "salesMode", offering.price_display_mode AS "priceDisplayMode",
        offering.currency, offering.timezone, calendar.version AS "calendarVersion", calendar.updated_at AS "calendarUpdatedAt",
        price_book.id AS "priceBookId", price_book.revision AS "priceBookRevision", price_book.state AS "priceBookState",
        TO_CHAR(price_book.valid_from, 'YYYY-MM-DD') AS "priceBookValidFrom",
        TO_CHAR(price_book.valid_to_exclusive, 'YYYY-MM-DD') AS "priceBookValidToExclusive",
        price_book.updated_at AS "priceBookUpdatedAt", terms.sellable_unit AS "sellableUnit",
        terms.inventory_mode AS "inventoryMode", resource.capacity_total AS "capacityTotal",
        (resource.settings->>'active' IS DISTINCT FROM 'false') AS "resourceActive",
        LOWER(COALESCE(item.resolved_content->>'title', '')) AS "titleKey"
      FROM cms_active_release active
      JOIN cms_releases release ON release.id = active.release_id AND release.state = 'published'
      JOIN cms_release_items item ON item.release_id = release.id
      JOIN cms_nodes node ON node.id = item.node_id AND node.kind = 'resource_detail'
        AND node.status = 'active' AND node.archived_at IS NULL
      JOIN cms_source_links source ON source.node_id = item.node_id AND source.source_kind = 'catalog_offering'
      JOIN cms_public_profiles profile ON profile.node_id = item.node_id
        AND profile.kind = 'catalog_offering' AND profile.entity_id = source.source_id AND profile.archived_at IS NULL
      JOIN catalog_offerings offering ON offering.id = source.source_id
        AND offering.kind = 'campground' AND offering.state = 'active' AND offering.archived_at IS NULL
      JOIN campground_offering_terms terms ON terms.offering_id = offering.id
        AND terms.offering_kind = 'campground' AND terms.capacity_unit = 'tent' AND terms.pricing_basis = 'per_night'
      JOIN offering_bindings binding ON binding.offering_id = offering.id AND binding.role = 'primary'
        AND binding.archived_at IS NULL AND binding.quantity_default = 1
        AND binding.capacity_impact_default = 1 AND binding.availability_required = true
      JOIN resources resource ON resource.id = binding.resource_id
        AND resource.kind IN ('camping', 'campground', 'campground_owned_tent', 'campground_own_tent_area')
        AND resource.archived_at IS NULL AND resource.capacity_total > 0
        AND resource.capacity_mode = CASE WHEN terms.sellable_unit = 'owned_tent' THEN 'fixed' ELSE 'shared' END
      JOIN resource_group_members member ON member.resource_id = resource.id
        AND member.archived_at IS NULL
        AND member.role = CASE WHEN terms.sellable_unit = 'owned_tent' THEN 'owned_tent' ELSE 'own_tent_area' END
      JOIN resource_groups resource_group ON resource_group.id = member.group_id
        AND resource_group.kind = 'campground' AND resource_group.state = 'active' AND resource_group.archived_at IS NULL
      JOIN business_calendars calendar ON calendar.id = offering.business_calendar_id
        AND calendar.state = 'active' AND calendar.archived_at IS NULL
      LEFT JOIN price_books price_book ON price_book.id = offering.active_price_book_id
        AND price_book.offering_id = offering.id AND price_book.state = 'active' AND price_book.archived_at IS NULL
      WHERE active.singleton_key = 'public'
        AND item.path LIKE '/campgrounds/%'
        AND (SELECT COUNT(*) FROM offering_bindings primary_binding
          WHERE primary_binding.offering_id = offering.id AND primary_binding.role = 'primary'
          AND primary_binding.archived_at IS NULL) = 1
        AND (SELECT COUNT(*) FROM resource_group_members sellable_member
          JOIN resource_groups sellable_group ON sellable_group.id = sellable_member.group_id
          WHERE sellable_member.resource_id = resource.id AND sellable_member.archived_at IS NULL
            AND sellable_member.role = CASE WHEN terms.sellable_unit = 'owned_tent' THEN 'owned_tent' ELSE 'own_tent_area' END
            AND sellable_group.kind = 'campground' AND sellable_group.state = 'active' AND sellable_group.archived_at IS NULL) = 1
        AND ($1::text IS NULL OR item.path = $1::text)
        AND ($2::text IS NULL OR LOWER(COALESCE(item.resolved_content->>'title', '')) > $2::text
          OR (LOWER(COALESCE(item.resolved_content->>'title', '')) = $2::text AND offering.id > $3::uuid))
      ORDER BY LOWER(COALESCE(item.resolved_content->>'title', '')) ASC, offering.id ASC
      LIMIT $4
    `, [path, cursor?.title ?? null, cursor?.id ?? null, limit]) as Promise<ProjectionRow[]>
  }

  private async summaries(rows: ProjectionRow[]): Promise<PublicCampgroundSummary[]> {
    if (!rows.length) return []
    const priceBookIds = rows.flatMap((row) => row.priceBookId ? [row.priceBookId] : [])
    const plans = priceBookIds.length
      ? await this.dataSource.getRepository(RatePlanEntity).findBy({ priceBookId: In(priceBookIds), archivedAt: IsNull() })
      : []
    const rules = plans.length
      ? await this.dataSource.getRepository(PriceRuleEntity).findBy({ ratePlanId: In(plans.map((plan) => plan.id)), enabled: true, archivedAt: IsNull() })
      : []
    const plansByBook = new Map<string, RatePlanEntity[]>()
    for (const plan of plans) plansByBook.set(plan.priceBookId, [...(plansByBook.get(plan.priceBookId) ?? []), plan])
    const rulesByPlan = new Map<string, PriceRuleEntity[]>()
    for (const rule of rules) rulesByPlan.set(rule.ratePlanId, [...(rulesByPlan.get(rule.ratePlanId) ?? []), rule])
    return rows.map((row) => this.summary(row, plansByBook.get(row.priceBookId ?? "") ?? [], rulesByPlan))
  }

  private summary(row: ProjectionRow, plans: RatePlanEntity[], rulesByPlan: Map<string, PriceRuleEntity[]>): PublicCampgroundSummary {
    const content = PublicReleasePageContentSchema.safeParse(row.resolvedContent)
    if (!content.success || content.data.kind !== "resource_detail" || content.data.path !== row.path || resolvedContentHash(row.resolvedContent) !== row.resolvedContentHash) throw this.invalidProjection()
    const pin = PublicCampgroundProjectionPinSchema.parse({ contract: PUBLIC_CAMPGROUND_PROJECTION_CONTRACT, offeringId: row.offeringId, kind: "campground", nodeId: row.nodeId, profileRevisionId: row.revisionId })
    const dependencies = ReleaseDependencyRefSchema.array().safeParse(row.dependencies)
    const dependency = dependencies.success ? dependencies.data.find((candidate) => candidate.type === "crm_projection" && candidate.id === row.offeringId) : undefined
    if (!dependency || dependency.version !== pin.contract || dependency.contentHash !== publicCampgroundProjectionPinHash(pin)) throw this.invalidProjection()
    const localDate = dateInTimeZone(new Date(), row.timezone)
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
    const ready = row.resourceActive && price.mode !== "request" && row.salesMode !== "request_only"
    const ownedTent = row.sellableUnit === "owned_tent"
    const asOf = latestDate(row.releasePublishedAt, row.releaseCreatedAt, row.offeringUpdatedAt, row.calendarUpdatedAt, row.priceBookUpdatedAt).toISOString()
    return PublicCampgroundSummarySchema.parse({
      offeringId: row.offeringId,
      kind: "campground",
      path: row.path,
      releaseId: row.releaseId,
      title: content.data.title,
      summary: content.data.summary,
      price,
      priceBasisLabel: "за ночь",
      quoteAvailable: false,
      requestAvailable: true,
      capacity: { unit: ownedTent ? "guests" : "tent", available: row.capacityTotal },
      readiness: !row.resourceActive ? "temporarily_unavailable" : ready ? "ready" : "request_only",
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
      fulfillment: {
        salesUnit: row.sellableUnit,
        allocationMode: row.inventoryMode,
        capacityUnit: "tent",
        capacityTotal: ownedTent ? 1 : row.capacityTotal,
        guestCapacityTotal: ownedTent ? row.capacityTotal : null,
        pricingMode: "rate_plan",
        availabilityMode: ready ? "resource" : "request_only",
      },
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

  private document<T>(data: T, cacheTags: string[]): PublicCampgroundProjectionDocument<T> {
    return { data, etag: `"${createHash("sha256").update(stableStringify(data)).digest("hex")}"`, cacheTags }
  }

  private encodeCursor(cursor: Cursor) { return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url") }
  private decodeCursor(value: string): Cursor {
    try {
      const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<Cursor>
      if (typeof parsed.title !== "string" || typeof parsed.id !== "string") throw new Error("invalid")
      IdSchema.parse(parsed.id)
      return { title: parsed.title, id: parsed.id! }
    } catch {
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Некорректный cursor", fieldErrors: { cursor: ["Некорректный cursor"] }, details: {} })
    }
  }

  private notFound() { return new NotFoundException({ code: "NOT_FOUND", message: "Опубликованный кемпинг не найден" }) }
  private invalidProjection() { return new ServiceUnavailableException({ code: "PUBLIC_PROJECTION_INVALID", message: "Публичная проекция кемпинга требует повторной публикации" }) }
}

function dateInTimeZone(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value)
  const byType = new Map(parts.map((part) => [part.type, part.value]))
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`
}

function latestDate(...values: Array<Date | null>): Date {
  return new Date(Math.max(...values.filter((value): value is Date => value !== null).map((value) => value.getTime())))
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`
  return JSON.stringify(value)
}
