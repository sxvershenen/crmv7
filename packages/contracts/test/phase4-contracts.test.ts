import { describe, expect, it } from "vitest";
import {
  AnalyticsAggregateQuerySchema,
  AnalyticsAggregateResponseSchema,
  AnalyticsEventBatchSchema,
  CmsContentOutboxEventSchema,
  CmsEntityRelationSchema,
  CmsNodeCreateSchema,
  CmsNodeMutationSchema,
  CmsSectionPolicySchema,
  CmsSourceLinkSchema,
  ListingFilterDefinitionSchema,
  MediaAssetUsageQuerySchema,
  MediaReplacementUploadInitSchema,
  MediaUploadInitSchema,
  PublicPageSchema,
  PublicLeadIntakeSchema,
  PublicLeadIntakeResponseSchema,
  ReleaseManifestSchema,
} from "../src/index.js";

const id = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const timestamp = "2026-08-31T12:00:00+03:00";

describe("Phase 4 contracts", () => {
  it("expresses explicit inheritance, disabling and bounded override patching", () => {
    expect(CmsSectionPolicySchema.parse({ mode: "inherit" })).toEqual({ mode: "inherit" });
    expect(CmsSectionPolicySchema.parse({ mode: "disabled" })).toEqual({ mode: "disabled" });
    expect(CmsSectionPolicySchema.safeParse({ mode: "override", patch: { scalars: {}, objects: {}, keyedArrays: {} }, extra: true }).success).toBe(false);
  });

  it("does not expose the operational Event aggregate as a public profile kind", () => {
    expect(CmsEntityRelationSchema.safeParse({ kind: "event", entityId: id }).success).toBe(false);
    expect(CmsEntityRelationSchema.parse({ kind: "public_event_offering", entityId: id }).kind).toBe("public_event_offering");
  });

  it("allows catalog offerings as CMS locators without turning the link into eligibility", () => {
    const link = CmsSourceLinkSchema.parse({
      sourceKind: "catalog_offering", sourceId: id, sourceVersion: 2, syncState: "draft", createdAt: timestamp,
    });
    expect(link.sourceKind).toBe("catalog_offering");
    expect(link).not.toHaveProperty("publicProfileId");
    expect(link).not.toHaveProperty("publishable");
  });

  it("requires typed listing metadata instead of arbitrary filter query fields", () => {
    expect(ListingFilterDefinitionSchema.parse({
      id: "capacity", label: "Вместимость", field: "capacity", source: "crm_public_projection",
      valueType: "number", operators: ["range"], control: "range", urlKey: "guests",
    })).toMatchObject({ normalization: "none", indexPolicy: "canonical_to_base" });
  });

  it("rejects unsafe media sizes before an upload grant is issued", () => {
    expect(MediaUploadInitSchema.safeParse({ filename: "bomb.png", mimeType: "image/png", byteSize: 100_000_001, checksumSha256: "a".repeat(64) }).success).toBe(false);
  });

  it("keeps replacement uploads versioned and usage filters bounded and strict", () => {
    expect(MediaReplacementUploadInitSchema.parse({
      expectedVersion: 3, filename: "hero-v2.png", mimeType: "image/png", byteSize: 1024, checksumSha256: "a".repeat(64),
    }).expectedVersion).toBe(3);
    expect(MediaReplacementUploadInitSchema.safeParse({
      filename: "hero-v2.png", mimeType: "image/png", byteSize: 1024, checksumSha256: "a".repeat(64),
    }).success).toBe(false);
    expect(MediaAssetUsageQuerySchema.parse({ path: "/media-test", published: "false", limit: "25" })).toEqual({ path: "/media-test", published: false, limit: 25 });
    expect(MediaAssetUsageQuerySchema.safeParse({ path: "/media-test/", limit: 25 }).success).toBe(false);
    expect(MediaAssetUsageQuerySchema.safeParse({ limit: 201 }).success).toBe(false);
    expect(MediaAssetUsageQuerySchema.safeParse({ limit: 25, label: "untrusted" }).success).toBe(false);
  });

  it("accepts a public enquiry but has no public Booking creation surface", () => {
    const value = PublicLeadIntakeSchema.parse({
      operationId: id,
      idempotencyKey: "public-lead-request-0001",
      name: "Иван",
      phone: "+79990000000",
      intent: { kind: "resource", publicEntityId: secondId, startDate: "2026-09-10", endDate: "2026-09-12", guests: 4 },
      attribution: { source: "yandex", medium: "organic", campaign: null, content: null, term: null, referrer: null, landingPath: "/domiki" },
      consent: { privacyAccepted: true, policyVersion: "2026-08" },
    });

    expect(value.intent.kind).toBe("resource");
    expect("bookingId" in value).toBe(false);
    expect("requestId" in value).toBe(false);
    expect(PublicLeadIntakeSchema.safeParse({ ...value, requestId: id }).success).toBe(false);
    expect(PublicLeadIntakeSchema.safeParse({ ...value, consent: { ...value.consent, capturedAt: timestamp } }).success).toBe(false);
    expect(PublicLeadIntakeSchema.safeParse({ ...value, intent: { ...value.intent, startDate: "2026-02-30" } }).success).toBe(false);
    expect(PublicLeadIntakeResponseSchema.parse({ requestId: id, accepted: true, receivedAt: timestamp })).not.toHaveProperty("leadId");
  });

  it("accepts only signed-token analytics batches with allowlisted payloads", () => {
    expect(AnalyticsEventBatchSchema.parse({ events: [{
      eventId: id,
      schemaVersion: 1,
      occurredAt: timestamp,
      eventName: "cta_clicked",
      consent: "analytics",
      purpose: "analytics",
      context: { path: "/domiki", pageNodeId: null, releaseId: null, referrer: null },
      properties: { kind: "action", actionId: "hero.book", component: "hero" },
    }] }).events).toHaveLength(1);

    expect(AnalyticsEventBatchSchema.safeParse({ events: [{
      eventId: id,
      schemaVersion: 1,
      occurredAt: timestamp,
      eventName: "cta_clicked",
      consent: "analytics",
      purpose: "analytics",
      context: { path: "/", pageNodeId: null, releaseId: null, referrer: null },
      properties: { kind: "action", actionId: "hero.book", component: "hero", phone: "+79990000000" },
    }] }).success).toBe(false);

    const consentEvent = {
      eventId: secondId,
      schemaVersion: 1 as const,
      occurredAt: timestamp,
      eventName: "consent_changed" as const,
      consent: "denied" as const,
      purpose: "essential" as const,
      context: { path: "/", pageNodeId: null, releaseId: null, referrer: null },
      properties: {
        kind: "consent" as const,
        state: "denied" as const,
        policyVersion: "v1",
        timestamp,
        source: "privacy-settings" as const,
      },
    };
    expect(AnalyticsEventBatchSchema.parse({ events: [consentEvent] }).events[0]?.properties).toMatchObject({
      timestamp,
      source: "privacy-settings",
    });
    expect(AnalyticsEventBatchSchema.safeParse({ events: [{
      ...consentEvent,
      properties: { ...consentEvent.properties, source: "query-string" },
    }] }).success).toBe(false);
    expect(AnalyticsEventBatchSchema.safeParse({ events: [{
      ...consentEvent,
      properties: { ...consentEvent.properties, timestamp: "not-a-timestamp" },
    }] }).success).toBe(false);
    expect(AnalyticsEventBatchSchema.safeParse({ events: [{
      ...consentEvent,
      properties: { kind: "consent", state: "denied", policyVersion: "v1", source: "privacy-settings" },
    }] }).success).toBe(false);
    expect(AnalyticsEventBatchSchema.safeParse({ events: [{
      ...consentEvent,
      properties: { kind: "consent", state: "denied", policyVersion: "v1" },
    }] }).success).toBe(true);
  });

  it("keeps aggregate reads date-shaped, dimension-safe and free of raw analytics fields", () => {
    expect(AnalyticsAggregateQuerySchema.parse({
      from: "2026-09-01", to: "2026-09-30", interval: "day", pageNodeId: id, sectionKey: "hero.primary",
    })).toMatchObject({ pageNodeId: id, sectionKey: "hero.primary" });
    expect(AnalyticsAggregateQuerySchema.safeParse({ from: "2026-02-30", to: "2026-03-01", interval: "day" }).success).toBe(false);
    expect(AnalyticsAggregateQuerySchema.safeParse({ from: "2026-09-01", to: "2026-09-30", interval: "day", sectionKey: "Hero Primary" }).success).toBe(false);

    const response = AnalyticsAggregateResponseSchema.parse({ uniqueVisitors: 2, items: [{
      period: "2026-09-01", pageNodeId: null, sectionKey: null,
      pageViews: 3, uniqueVisitors: 2, actions: 1, leads: 1, bookings: 0, payments: 1,
    }] });
    expect(response.items[0]).not.toHaveProperty("path");
    expect(response.items[0]).not.toHaveProperty("referrer");
    expect(AnalyticsAggregateResponseSchema.safeParse({ items: [{ ...response.items[0], path: "/private" }] }).success).toBe(false);
  });

  it("requires immutable exact release dependencies and compare-and-swap lineage", () => {
    expect(ReleaseManifestSchema.parse({
      id,
      sequence: 1,
      state: "published",
      baseReleaseId: null,
      routes: [{
        path: "/",
        nodeId: secondId,
        revisionId: id,
        resolvedContentHash: "a".repeat(64),
        dependencyRefs: [{ type: "node_revision", id, version: "1", contentHash: "a".repeat(64) }],
      }],
      manifestHash: "b".repeat(64),
      createdBy: secondId,
      createdAt: timestamp,
      publishedAt: timestamp,
    }).routes[0]?.dependencyRefs[0]?.version).toBe("1");
  });

  it("publishes materialized section config and rejects authoring inheritance policy", () => {
    const page = {
      nodeId: id,
      revisionId: secondId,
      releaseId: id,
      kind: "landing",
      path: "/svadby",
      title: "Свадьбы",
      summary: null,
      sections: [{ id, key: "hero", renderer: "hero", rendererVersion: "1", schemaVersion: 1, order: 10, config: { title: "Свадьбы" } }],
      seo: { title: "Свадьбы", description: "Площадки и сценарии для загородной свадьбы." },
      dependencies: [],
      generatedAt: timestamp,
      cache: { etag: "release-page", maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300, tags: [] },
      freshness: { contentVersion: "a".repeat(64), crmProjectionAsOf: null, ready: true },
    };
    expect(PublicPageSchema.parse(page).sections[0]).toHaveProperty("config");
    expect(PublicPageSchema.safeParse({ ...page, sections: [{ ...page.sections[0], config: undefined, policy: { mode: "inherit" } }] }).success).toBe(false);
  });

  it("keeps CMS writes strict, versioned and idempotent", () => {
    const create = CmsNodeCreateSchema.parse({
      operationId: id,
      idempotencyKey: "cms-create-operation-0001",
      kind: "landing",
      route: { path: "/svadby", slug: "svadby", parentNodeId: null, sortOrder: 10 },
      title: "Свадьбы на базе отдыха",
      seo: { title: "Свадьбы на базе отдыха", description: "Площадки и сценарии для загородной свадьбы." },
    });
    expect(create).toMatchObject({ sections: [], relations: [], schemaVersion: 1 });
    expect(CmsNodeMutationSchema.safeParse({ operationId: id, idempotencyKey: "cms-update-operation-0001", expectedVersion: 1 }).success).toBe(false);
    expect(CmsNodeCreateSchema.safeParse({ ...create, unexpected: true }).success).toBe(false);
  });

  it("defines an allowlisted CMS outbox payload without embedding page content", () => {
    const event = CmsContentOutboxEventSchema.parse({
      eventId: id,
      eventType: "cms.content.revision.created",
      occurredAt: timestamp,
      actorId: secondId,
      requestId: "request-1",
      nodeId: id,
      nodeVersion: 2,
      revisionId: secondId,
      revision: 2,
      state: "draft",
    });
    expect(event.eventType).toBe("cms.content.revision.created");
    expect("sections" in event).toBe(false);
  });
});
