import { describe, expect, it } from "vitest";
import { adminOpenApiDocument, publicOpenApiDocument } from "../src/phase4-openapi.js";

describe("Phase 4 OpenAPI namespace isolation", () => {
  it("publishes distinct admin and public API roots", () => {
    expect(adminOpenApiDocument.openapi).toBe("3.1.0");
    expect(publicOpenApiDocument.openapi).toBe("3.1.0");
    expect(adminOpenApiDocument.servers?.[0]?.url).toBe("/api/admin/v1");
    expect(publicOpenApiDocument.servers?.[0]?.url).toBe("/api/public/v1");
  });

  it("documents only implemented public reads and never leaks CMS administration", () => {
    const publicDocument = JSON.stringify(publicOpenApiDocument);
    expect(Object.keys(publicOpenApiDocument.paths ?? {})).toEqual([
      "/pages/resolve", "/pages/preview", "/site-settings", "/listings/resolve", "/offerings/addons", "/offerings/addons/{offeringId}", "/offerings/venues", "/offerings/venues/{offeringId}", "/offerings/programs", "/offerings/programs/{offeringId}", "/offerings/event-services", "/offerings/event-services/{offeringId}", "/offerings/houses", "/offerings/houses/detail", "/offerings/campgrounds", "/offerings/campgrounds/detail", "/media/{assetId}/{variantId}",
    ]);
    expect(publicDocument).not.toContain("CmsNodeMutation");
    expect(publicDocument).not.toContain("MediaUploadGrant");
    expect(publicDocument).not.toContain("StoredAnalyticsEvent");
    expect(publicDocument).not.toContain("crm_session");
    expect(publicDocument).not.toContain("/intake/leads");
    expect(publicDocument).not.toContain("/analytics/events");
    expect(publicDocument).not.toContain("OperationalQuoteAcceptance");
    expect(publicOpenApiDocument.paths?.["/offerings/addons"]?.get?.responses).toEqual(expect.objectContaining({ 200: expect.anything(), 304: expect.anything(), 400: expect.anything(), 404: expect.anything(), 503: expect.anything() }));
    expect(publicOpenApiDocument.paths?.["/offerings/addons/{offeringId}"]?.get?.responses).toEqual(expect.objectContaining({ 200: expect.anything(), 304: expect.anything(), 404: expect.anything(), 503: expect.anything() }));
    expect(publicOpenApiDocument.paths?.["/offerings/venues"]?.get?.responses).toEqual(expect.objectContaining({ 200: expect.anything(), 304: expect.anything(), 400: expect.anything(), 404: expect.anything(), 503: expect.anything() }));
    expect(publicOpenApiDocument.paths?.["/offerings/venues/{offeringId}"]?.get?.responses).toEqual(expect.objectContaining({ 200: expect.anything(), 304: expect.anything(), 400: expect.anything(), 404: expect.anything(), 503: expect.anything() }));
    expect(publicOpenApiDocument.paths?.["/offerings/programs"]?.get?.responses).toEqual(expect.objectContaining({ 200: expect.anything(), 304: expect.anything(), 400: expect.anything(), 404: expect.anything(), 503: expect.anything() }));
    expect(publicOpenApiDocument.paths?.["/offerings/programs/{offeringId}"]?.get?.responses).toEqual(expect.objectContaining({ 200: expect.anything(), 304: expect.anything(), 400: expect.anything(), 404: expect.anything(), 503: expect.anything() }));
    expect(publicOpenApiDocument.paths?.["/offerings/event-services"]?.get?.responses).toEqual(expect.objectContaining({ 200: expect.anything(), 304: expect.anything(), 400: expect.anything(), 404: expect.anything(), 503: expect.anything() }));
    expect(publicOpenApiDocument.paths?.["/offerings/event-services/{offeringId}"]?.get?.responses).toEqual(expect.objectContaining({ 200: expect.anything(), 304: expect.anything(), 400: expect.anything(), 404: expect.anything(), 503: expect.anything() }));
  });

  it("keeps implemented content operations authenticated in admin OpenAPI", () => {
    const paths = adminOpenApiDocument.paths ?? {};
    expect(paths["/auth/login"]?.post?.security).toEqual([]);
    expect(paths["/auth/session"]?.get?.security).toEqual([{ sessionCookie: [] }]);
    expect(paths["/auth/change-password"]?.post?.security).toEqual([{ sessionCookie: [] }]);
    expect(paths["/content/nodes"]?.get?.security).toEqual([{ sessionCookie: [] }]);
    expect(paths["/content/nodes/{id}"]?.patch?.security).toEqual([{ sessionCookie: [] }]);
    expect(paths["/media/uploads"]?.post?.security).toEqual([{ sessionCookie: [] }]);
    expect(paths["/media/uploads/{uploadId}/content"]?.put?.security).toEqual([]);
    expect(paths["/releases/{id}/publish"]).toBeUndefined();
    expect(paths["/offerings"]?.get?.security).toEqual([{ sessionCookie: [] }]);
    expect(paths["/offerings/addons"]?.post?.security).toEqual([{ sessionCookie: [] }]);
    expect(paths["/offerings/{offeringId}/addon-terms"]?.put).toBeDefined();
    expect(paths["/offerings/binding-targets"]?.get?.security).toEqual([{ sessionCookie: [] }]);
    expect(paths["/offerings/{offeringId}/quotes/preview"]?.post).toBeDefined();
    expect(paths["/deliveries"]?.get?.security).toEqual([{ sessionCookie: [] }]);
    expect(paths["/deliveries/{consumer}/{eventId}/replay"]?.post).toBeDefined();
    expect(publicOpenApiDocument.paths?.["/deliveries"]).toBeUndefined();
  });

  it("documents every implemented content lifecycle operation", () => {
    const paths = adminOpenApiDocument.paths ?? {};
    expect(paths["/content/nodes"]?.get).toBeDefined();
    expect(paths["/content/nodes"]?.post).toBeDefined();
    expect(paths["/content/nodes/{id}"]?.patch).toBeDefined();
    expect(paths["/content/nodes/{id}/submit-review"]?.post).toBeDefined();
    expect(paths["/content/nodes/{id}/return-to-draft"]?.post).toBeDefined();
    expect(paths["/content/nodes/{id}/archive"]?.post).toBeDefined();
    expect(paths["/content/revisions/{revisionId}/preview-token"]?.post).toBeDefined();
    expect(paths["/content/nodes/{id}/approve"]?.post).toBeDefined();
    expect(paths["/releases/build"]?.post).toBeDefined();
    expect(paths["/releases/{id}/activate"]?.post).toBeDefined();
    expect(paths["/releases/{id}/rollback"]?.post).toBeDefined();
  });

  it("keeps shared offering routes in internal and admin documents but out of public", async () => {
    const { internalOpenApiDocument } = await import("../src/openapi.js");
    const sharedPaths = [
      "/offerings",
      "/offerings/addons",
      "/offerings/binding-targets",
      "/offerings/{offeringId}/addon-terms",
      "/offerings/{offeringId}/editor",
      "/offerings/{offeringId}/price-books/drafts",
      "/offerings/{offeringId}/price-books/drafts/{priceBookId}",
      "/offerings/{offeringId}/price-books/{priceBookId}/activate",
      "/offerings/{offeringId}/price-books/{priceBookId}/schedule",
      "/offerings/{offeringId}/quotes/preview",
      "/business-calendars",
      "/business-calendars/{calendarId}",
      "/business-calendars/{calendarId}/import",
      "/business-calendars/{calendarId}/overrides/{date}",
      "/business-calendars/{calendarId}/state",
      "/offerings/{offeringId}/bindings",
      "/addons",
      "/offerings/{offeringId}/add-ons",
      "/offerings/{offeringId}/add-ons/custom",
    ];
    for (const path of sharedPaths) {
      expect(adminOpenApiDocument.paths?.[path]).toBeDefined();
      expect(internalOpenApiDocument.paths?.[path]).toBeDefined();
      if (path === "/offerings/addons") {
        expect(publicOpenApiDocument.paths?.[path]?.get).toBeDefined();
        expect(publicOpenApiDocument.paths?.[path]?.post).toBeUndefined();
      } else {
        expect(publicOpenApiDocument.paths?.[path]).toBeUndefined();
      }
    }
    expect(adminOpenApiDocument.components?.schemas?.OfferingEditorialLocator).toBeDefined();
    expect(internalOpenApiDocument.components?.schemas?.OfferingEditorialLocator).toBeDefined();
    expect(JSON.stringify(publicOpenApiDocument)).not.toContain("OfferingEditorialLocator");
  });
});
