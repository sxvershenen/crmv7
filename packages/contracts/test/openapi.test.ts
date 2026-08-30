import { describe, expect, it } from "vitest";
import { internalOpenApiDocument } from "../src/index.js";

describe("internal OpenAPI document", () => {
  it("is generated from canonical schemas and covers internal routes", () => {
    expect(internalOpenApiDocument.openapi).toBe("3.1.0");
    expect(Object.keys(internalOpenApiDocument.paths ?? {})).toEqual(expect.arrayContaining([
      "/auth/login", "/auth/session", "/auth/change-password", "/tasks", "/tasks/{code}", "/tasks/{code}/assign-self",
      "/resources", "/resources/availability", "/resources/{code}", "/resources/{code}/availability", "/resources/allocations",
      "/bookings", "/bookings/{id}", "/bookings/{id}/transition", "/bookings/{id}/archive",
      "/payments", "/payments/summary", "/finance", "/saved-views", "/saved-views/{id}", "/health", "/live/events", "/search",
    ]));
    expect(internalOpenApiDocument.components?.schemas).toEqual(expect.objectContaining({
      ApiError: expect.any(Object), SessionUser: expect.any(Object), TaskCreate: expect.any(Object),
      TaskDto: expect.any(Object), SavedViewDto: expect.any(Object), AvailabilityResult: expect.any(Object), ResourceDto: expect.any(Object),
      ResourceAllocationCreate: expect.any(Object), BookingDto: expect.any(Object), BookingCreate: expect.any(Object),
      BookingUpdate: expect.any(Object), BookingTransition: expect.any(Object), PaymentDto: expect.any(Object), PaymentOperation: expect.any(Object),
      FinanceQuery: expect.any(Object), FinanceDatasetDto: expect.any(Object), SearchQuery: expect.any(Object), SearchResult: expect.any(Object), SearchResponse: expect.any(Object),
    }));
    expect(internalOpenApiDocument.components?.securitySchemes).toEqual(expect.objectContaining({
      sessionCookie: expect.objectContaining({ type: "apiKey", in: "cookie", name: "sv_session" }),
    }));
    expect(internalOpenApiDocument.paths?.["/tasks"]?.get?.security).toEqual([{ sessionCookie: [] }]);
    expect(internalOpenApiDocument.paths?.["/auth/login"]?.post?.security).toEqual([]);
    expect(internalOpenApiDocument.paths?.["/tasks"]?.get?.responses?.["401"]).toEqual(expect.objectContaining({
      content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
    }));
  });
});
