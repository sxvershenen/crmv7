import { describe, expect, it } from "vitest";
import {
  AnalyticsEventBatchSchema,
  CmsContentOutboxEventSchema,
  CmsEntityRelationSchema,
  CmsNodeCreateSchema,
  CmsNodeMutationSchema,
  CmsSectionPolicySchema,
  CmsSourceLinkSchema,
  ListingFilterDefinitionSchema,
  MediaUploadInitSchema,
  PublicPageSchema,
  PublicLeadIntakeSchema,
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

  it("accepts a public enquiry but has no public Booking creation surface", () => {
    const value = PublicLeadIntakeSchema.parse({
      requestId: id,
      idempotencyKey: "public-lead-request-0001",
      name: "Иван",
      phone: "+79990000000",
      intent: { kind: "resource", publicEntityId: secondId, startDate: "2026-09-10", endDate: "2026-09-12", guests: 4 },
      attribution: { source: "yandex", medium: "organic", campaign: null, content: null, term: null, referrer: null, landingPath: "/domiki" },
      consent: { privacyAccepted: true, policyVersion: "2026-08", capturedAt: timestamp },
    });

    expect(value.intent.kind).toBe("resource");
    expect("bookingId" in value).toBe(false);
  });

  it("accepts only signed-token analytics batches with allowlisted payloads", () => {
    expect(AnalyticsEventBatchSchema.parse({ events: [{
      eventId: id,
      occurredAt: timestamp,
      visitorToken: "signed." + "a".repeat(40),
      sessionId: secondId,
      consent: "analytics",
      purpose: "analytics",
      context: { path: "/domiki", pageNodeId: null, releaseId: null, referrer: null },
      payload: { kind: "action", actionId: "hero.book", component: "hero" },
    }] }).events).toHaveLength(1);

    expect(AnalyticsEventBatchSchema.safeParse({ events: [{
      eventId: id,
      occurredAt: timestamp,
      visitorToken: "signed." + "a".repeat(40),
      sessionId: secondId,
      consent: "analytics",
      purpose: "analytics",
      context: { path: "/", pageNodeId: null, releaseId: null, referrer: null },
      payload: { kind: "action", actionId: "hero.book", component: "hero", phone: "+79990000000" },
    }] }).success).toBe(false);
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
