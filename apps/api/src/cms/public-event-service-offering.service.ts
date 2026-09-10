import { createHash } from "node:crypto"

import { BadRequestException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common"
import { DataSource } from "typeorm"

import {
  PublicEventServiceListResponseSchema,
  PublicEventServiceProjectionPinSchema,
  PublicEventServiceSummaryParamsSchema,
  PublicEventServiceSummarySchema,
  PublicReleasePageContentSchema,
  ReleaseDependencyRefSchema,
  type PublicEventServiceListQuery,
  type PublicEventServiceListResponse,
  type PublicEventServiceSummary,
} from "@crm/contracts"

import { PUBLIC_EVENT_SERVICE_PROJECTION_CONTRACT, publicEventServiceProjectionPinHash } from "../offerings/public-event-service-projection.js"
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
  currency: string
  timezone: string
  calendarVersion: number
  calendarUpdatedAt: Date
  templateId: string
  templateVersion: number
  templateUpdatedAt: Date
  format: "wedding" | "corporate" | "birthday" | "other"
  durationMinutes: number
  minimumGuests: number | null
  maximumGuests: number | null
  titleKey: string
}

type Cursor = { title: string; id: string }
export type PublicEventServiceProjectionDocument<T> = Readonly<{ data: T; etag: string; cacheTags: string[] }>

@Injectable()
export class PublicEventServiceOfferingService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async list(query: PublicEventServiceListQuery): Promise<PublicEventServiceProjectionDocument<PublicEventServiceListResponse>> {
    const cursor = query.cursor ? this.decodeCursor(query.cursor) : null
    const rows = await this.rows(cursor, query.limit + 1)
    const pageRows = rows.slice(0, query.limit)
    const summaries = pageRows.map((row) => this.summary(row))
    const release = await this.activeRelease()
    const last = pageRows.at(-1)
    const data = PublicEventServiceListResponseSchema.parse({
      items: summaries,
      nextCursor: rows.length > query.limit && last ? this.encodeCursor({ title: last.titleKey, id: last.offeringId }) : null,
      releaseId: release.id,
      asOf: summaries.reduce((latest, item) => item.asOf > latest ? item.asOf : latest, release.asOf),
    })
    return this.document(data, [`cms-release:${release.id}`, "public-offering-kind:event-service", "public-offering-collection"])
  }

  async detail(offeringId: string): Promise<PublicEventServiceProjectionDocument<PublicEventServiceSummary>> {
    PublicEventServiceSummaryParamsSchema.parse({ offeringId })
    const rows = await this.rows(null, 1, offeringId)
    const row = rows[0]
    if (!row) throw this.notFound()
    return this.document(this.summary(row), [`cms-release:${row.releaseId}`, `cms-node:${row.nodeId}`, `public-offering:${row.offeringId}`, "public-offering-kind:event-service", "public-offering-collection"])
  }

  private async rows(cursor: Cursor | null, limit: number, offeringId: string | null = null): Promise<ProjectionRow[]> {
    return this.dataSource.query(`
      SELECT release.id AS "releaseId", release.created_at AS "releaseCreatedAt", release.published_at AS "releasePublishedAt",
        item.node_id AS "nodeId", item.revision_id AS "revisionId", item.resolved_content AS "resolvedContent",
        item.resolved_content_hash AS "resolvedContentHash", item.dependencies,
        offering.id AS "offeringId", offering.version AS "offeringVersion", offering.updated_at AS "offeringUpdatedAt",
        offering.pricing_version AS "pricingVersion", offering.currency, offering.timezone,
        calendar.version AS "calendarVersion", calendar.updated_at AS "calendarUpdatedAt",
        template.id AS "templateId", template.version AS "templateVersion", template.updated_at AS "templateUpdatedAt",
        template.format, template.default_duration_minutes AS "durationMinutes",
        template.minimum_guests AS "minimumGuests", template.maximum_guests AS "maximumGuests",
        LOWER(COALESCE(item.resolved_content->>'title', '')) AS "titleKey"
      FROM cms_active_release active
      JOIN cms_releases release ON release.id = active.release_id AND release.state = 'published'
      JOIN cms_release_items item ON item.release_id = release.id
      JOIN cms_nodes node ON node.id = item.node_id AND node.kind = 'event_detail' AND node.status = 'active' AND node.archived_at IS NULL
      JOIN cms_source_links source ON source.node_id = item.node_id AND source.source_kind = 'catalog_offering'
      JOIN cms_public_profiles profile ON profile.node_id = item.node_id AND profile.kind = 'catalog_offering' AND profile.entity_id = source.source_id AND profile.archived_at IS NULL
      JOIN catalog_offerings offering ON offering.id = source.source_id AND offering.kind = 'event_service' AND offering.state = 'active' AND offering.archived_at IS NULL
      JOIN offering_bindings binding ON binding.offering_id = offering.id AND binding.role = 'primary' AND binding.event_service_template_id IS NOT NULL AND binding.archived_at IS NULL
      JOIN event_service_templates template ON template.id = binding.event_service_template_id AND template.archived_at IS NULL
      JOIN business_calendars calendar ON calendar.id = offering.business_calendar_id AND calendar.state = 'active' AND calendar.archived_at IS NULL
      WHERE active.singleton_key = 'public'
        AND (SELECT COUNT(*) FROM cms_source_links exact_source WHERE exact_source.node_id = item.node_id AND exact_source.source_kind = 'catalog_offering') = 1
        AND (SELECT COUNT(*) FROM cms_public_profiles exact_profile WHERE exact_profile.node_id = item.node_id AND exact_profile.kind = 'catalog_offering' AND exact_profile.entity_id = source.source_id AND exact_profile.archived_at IS NULL) = 1
        AND (SELECT COUNT(*) FROM offering_bindings primary_binding WHERE primary_binding.offering_id = offering.id AND primary_binding.role = 'primary' AND primary_binding.archived_at IS NULL) = 1
        AND ($1::uuid IS NULL OR offering.id = $1::uuid)
        AND ($2::text IS NULL OR LOWER(COALESCE(item.resolved_content->>'title', '')) > $2::text OR (LOWER(COALESCE(item.resolved_content->>'title', '')) = $2::text AND offering.id > $3::uuid))
      ORDER BY LOWER(COALESCE(item.resolved_content->>'title', '')) ASC, offering.id ASC LIMIT $4
    `, [offeringId, cursor?.title ?? null, cursor?.id ?? null, limit]) as Promise<ProjectionRow[]>
  }

  private summary(row: ProjectionRow): PublicEventServiceSummary {
    const content = PublicReleasePageContentSchema.safeParse(row.resolvedContent)
    if (!content.success || content.data.kind !== "event_detail" || !content.data.path.startsWith("/events/") || resolvedContentHash(row.resolvedContent) !== row.resolvedContentHash) throw this.invalidProjection()
    const pin = PublicEventServiceProjectionPinSchema.parse({ contract: PUBLIC_EVENT_SERVICE_PROJECTION_CONTRACT, offeringId: row.offeringId, kind: "event_service", nodeId: row.nodeId, profileRevisionId: row.revisionId })
    const dependencies = ReleaseDependencyRefSchema.array().safeParse(row.dependencies)
    const matches = dependencies.success ? dependencies.data.filter((candidate) => candidate.type === "crm_projection" && candidate.id === row.offeringId) : []
    if (matches.length !== 1 || matches[0]?.version !== pin.contract || matches[0]?.contentHash !== publicEventServiceProjectionPinHash(pin)) throw this.invalidProjection()
    const asOf = latestDate(row.releasePublishedAt, row.releaseCreatedAt, row.offeringUpdatedAt, row.templateUpdatedAt, row.calendarUpdatedAt).toISOString()
    return PublicEventServiceSummarySchema.parse({
      offeringId: row.offeringId,
      kind: "event_service",
      path: content.data.path,
      releaseId: row.releaseId,
      title: content.data.title,
      summary: content.data.summary,
      price: { mode: "request" },
      priceBasisLabel: null,
      quoteAvailable: false,
      requestAvailable: true,
      capacity: null,
      readiness: "request_only",
      timezone: row.timezone,
      currency: row.currency,
      sourceVersions: { offering: row.offeringVersion, pricing: row.pricingVersion, priceBook: null, calendar: row.calendarVersion, contentReleaseId: row.releaseId, profileRevisionId: row.revisionId },
      asOf,
      format: row.format,
      fulfillment: { durationMinutes: row.durationMinutes, minimumGuests: row.minimumGuests, maximumGuests: row.maximumGuests, availabilityMode: "request_only" },
    })
  }

  private async activeRelease(): Promise<{ id: string; asOf: string }> {
    const rows = await this.dataSource.query(`SELECT release.id, COALESCE(release.published_at, release.created_at) AS "asOf" FROM cms_active_release active JOIN cms_releases release ON release.id = active.release_id AND release.state = 'published' WHERE active.singleton_key = 'public' LIMIT 1`) as Array<{ id: string; asOf: Date }>
    const row = rows[0]
    if (!row) throw this.notFound()
    return { id: row.id, asOf: row.asOf.toISOString() }
  }

  private document<T>(data: T, cacheTags: string[]): PublicEventServiceProjectionDocument<T> { return { data, etag: `"${createHash("sha256").update(stableStringify(data)).digest("hex")}"`, cacheTags } }
  private encodeCursor(cursor: Cursor) { return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url") }
  private decodeCursor(value: string): Cursor {
    try {
      const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<Cursor>
      if (typeof parsed.title !== "string" || typeof parsed.id !== "string") throw new Error("invalid")
      PublicEventServiceSummaryParamsSchema.parse({ offeringId: parsed.id })
      return { title: parsed.title, id: parsed.id }
    } catch { throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Некорректный cursor", fieldErrors: { cursor: ["Некорректный cursor"] }, details: {} }) }
  }
  private notFound() { return new NotFoundException({ code: "NOT_FOUND", message: "Опубликованное мероприятие не найдено" }) }
  private invalidProjection() { return new ServiceUnavailableException({ code: "PUBLIC_PROJECTION_INVALID", message: "Публичная проекция мероприятия требует повторной публикации" }) }
}

function latestDate(...values: Array<Date | null>) { return values.filter((value): value is Date => value !== null).reduce((latest, value) => value > latest ? value : latest, new Date(0)) }
function stableStringify(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`; return JSON.stringify(value) }
