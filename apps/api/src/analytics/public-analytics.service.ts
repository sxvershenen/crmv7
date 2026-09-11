import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto"

import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import type { Request, Response } from "express"
import { DataSource } from "typeorm"

import { AnalyticsEventBatchResponseSchema, type AnalyticsEventBatch, type AnalyticsEventBatchResponse, type PublicAnalyticsEvent } from "@crm/contracts"
import { AnalyticsEventEntity } from "@crm/db"

import { AnalyticsIdentityService } from "./analytics-identity.service.js"

const allowedConsents = new Set(["analytics", "analytics_and_marketing"])
const maxPastMs = 90 * 24 * 60 * 60 * 1000
const maxFutureMs = 5 * 60 * 1000

@Injectable()
export class PublicAnalyticsService {
  private readonly networkSecret: string

  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(ConfigService) config: ConfigService,
    @Inject(AnalyticsIdentityService) private readonly identity: AnalyticsIdentityService,
  ) {
    this.networkSecret = config.get<string>("ANALYTICS_COOKIE_SIGNING_SECRET") ?? randomBytes(32).toString("hex")
  }

  async collect(input: AnalyticsEventBatch, request: Request, response: Response): Promise<AnalyticsEventBatchResponse> {
    const now = new Date()
    const revoked = input.events.some((event) => event.eventName === "consent_changed" && event.purpose === "essential" && event.properties.kind === "consent" && event.properties.state === "denied")
    const eligible = input.events.filter((event) => allowedConsents.has(event.consent) && event.purpose === "analytics")
    if (revoked) {
      this.identity.clear(response)
      return this.response(request, 0, 0, input.events.length)
    }
    const dropped = input.events.length - eligible.length
    if (eligible.length === 0) return this.response(request, 0, 0, dropped)
    for (const [index, event] of eligible.entries()) this.assertClock(event, index, now)

    const identity = this.identity.issue(request, response, now.getTime())
    let accepted = 0
    let duplicates = 0
    await this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      for (const event of eligible) {
        const requestHash = this.hash(event)
        const inserted = await manager.query<{ event_id: string }[]>(`
          INSERT INTO analytics_ingest_dedup(event_id, request_hash, received_at)
          VALUES ($1, $2, $3)
          ON CONFLICT (event_id) DO NOTHING
          RETURNING event_id
        `, [event.eventId, requestHash, now])
        if (inserted.length === 0) {
          const existing = await manager.query<Array<{ request_hash: string }>>("SELECT request_hash FROM analytics_ingest_dedup WHERE event_id = $1", [event.eventId])
          if (existing[0]?.request_hash !== requestHash) throw new ConflictException({ code: "ANALYTICS_EVENT_CONFLICT", message: "Событие уже использовано с другими данными", details: {} })
          duplicates += 1
          continue
        }
        await manager.save(manager.create(AnalyticsEventEntity, this.toEntity(event, identity, request, now)))
        accepted += 1
      }
    })
    return this.response(request, accepted, duplicates, dropped)
  }

  private toEntity(event: PublicAnalyticsEvent, identity: { visitorId: string; sessionId: string }, request: Request, receivedAt: Date) {
    const referrerHost = event.context.referrer ? new URL(event.context.referrer).hostname.toLocaleLowerCase("en-US") : null
    return {
      id: randomUUID(), eventId: event.eventId, schemaVersion: event.schemaVersion, eventName: event.eventName,
      occurredAt: new Date(event.occurredAt), receivedAt, visitorId: identity.visitorId, sessionId: identity.sessionId,
      consent: event.consent, purpose: event.purpose, context: { path: event.context.path, pageNodeId: event.context.pageNodeId, releaseId: event.context.releaseId, sectionKey: event.context.sectionKey ?? null, contentVersion: event.context.contentVersion ?? null, viewport: event.context.viewport ?? null },
      properties: event.properties, attribution: {}, normalizedReferrerHost: referrerHost,
      networkPseudonym: this.networkPseudonym(request.ip), userAgentFamily: this.userAgentFamily(request.header("user-agent")),
      deviceClass: this.deviceClass(event), trafficClass: this.trafficClass(request.header("user-agent")),
    }
  }

  private assertClock(event: PublicAnalyticsEvent, index: number, now: Date) {
    const occurredAt = new Date(event.occurredAt).getTime()
    if (!Number.isFinite(occurredAt) || occurredAt < now.getTime() - maxPastMs || occurredAt > now.getTime() + maxFutureMs) {
      throw new BadRequestException({ code: "ANALYTICS_CLOCK_SKEW", message: "Событие имеет недопустимое время", fieldErrors: { [`events.${index}.occurredAt`]: ["Недопустимое время события"] }, details: {} })
    }
  }

  private response(request: Request, accepted: number, duplicates: number, dropped: number) {
    return AnalyticsEventBatchResponseSchema.parse({ requestId: this.requestId(request), accepted, duplicates, dropped })
  }

  private requestId(request: Request) {
    const value = request.header("x-request-id")
    return value && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value) ? value : randomUUID()
  }

  private hash(event: PublicAnalyticsEvent) { return createHash("sha256").update(JSON.stringify(event)).digest("hex") }
  private networkPseudonym(value: string | undefined) { return value ? createHmac("sha256", this.networkSecret).update(`analytics:${value}`).digest("hex") : null }
  private userAgentFamily(value: string | undefined) { if (!value) return null; if (/edg\//iu.test(value)) return "Edge"; if (/chrome\//iu.test(value)) return "Chrome"; if (/firefox\//iu.test(value)) return "Firefox"; if (/safari\//iu.test(value)) return "Safari"; return "Other" }
  private trafficClass(value: string | undefined) { return value && /(bot|crawler|spider|headless)/iu.test(value) ? "bot" : value ? "human" : "unknown" }
  private deviceClass(event: PublicAnalyticsEvent) { const width = event.context.viewport?.width; return width !== undefined ? width < 768 ? "mobile" : "desktop" : "unknown" }
}
