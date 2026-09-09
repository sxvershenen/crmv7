import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import type { ZodType } from "zod";
import {
  CmsNodeArchiveSchema,
  CmsNodeCreateSchema,
  CmsNodeDetailSchema,
  CmsNodeIdParamsSchema,
  CmsNodeListQuerySchema,
  CmsNodeListResponseSchema,
  CmsNodeMutationSchema,
  CmsNodePublishResultSchema,
  CmsNodePublishSchema,
  CmsNodeTransitionSchema,
} from "./content.js";
import { ApiErrorSchema } from "./errors.js";
import {
  CmsReleaseActivateInputSchema,
  CmsReleaseBuildInputSchema,
  CmsReleaseDetailSchema,
  CmsReleaseIdParamsSchema,
} from "./publication.js";
import {
  CmsPreviewDocumentSchema,
  CmsPreviewTokenIssueSchema,
  CmsPreviewTokenResponseSchema,
  CmsRevisionIdParamsSchema,
  PublicPagePreviewQuerySchema,
  PublicPageResolveQuerySchema,
  PublicPageSchema,
  PublicListingHttpQuerySchema,
  PublicListingResultSchema,
} from "./public-site.js";
import { CmsSiteSettingsDetailSchema, CmsSiteSettingsMutationSchema, CmsSiteSettingsPublishSchema, PublicSiteSettingsSchema } from "./site-settings.js";
import {
  MediaAssetArchiveSchema,
  MediaAssetDetailSchema,
  MediaAssetIdParamsSchema,
  MediaAssetListQuerySchema,
  MediaAssetListResponseSchema,
  MediaAssetMetadataMutationSchema,
  MediaUploadGrantSchema,
  MediaUploadIdParamsSchema,
  MediaUploadInitSchema,
  MediaUploadTokenQuerySchema,
} from "./media.js";
import { AddOnOfferingCreateBodySchema, AddOnOfferingCreateResultSchema, AddOnTermsMutationBodySchema, AddOnTermsMutationResultSchema, HousePriceBookActivateBodySchema, HousePriceBookDraftCreateBodySchema, HousePriceBookDraftReplaceBodySchema, HousePriceBookScheduleBodySchema, InternalHouseOfferingQuoteBodySchema, InternalOfferingEditorSchema, InternalOfferingQuoteResultSchema, OfferingBindingTargetLookupQuerySchema, OfferingBindingTargetLookupResponseSchema, OfferingEditorialLocatorSchema, OfferingListOpenApiQuerySchema, OfferingListResponseSchema, OfferingPricingMutationResultSchema, ProgramOfferingLookupResultSchema, ProgramOfferingPrepareBodySchema, ProgramOfferingPrepareResultSchema, ProgramOfferingQuotePreviewBodySchema, ProgramOfferingQuoteResultSchema, PublicAddOnListQuerySchema, PublicAddOnListResponseSchema, PublicAddOnSummaryParamsSchema, PublicAddOnSummarySchema } from "./offerings.js";
import { AddOnLibraryQuerySchema, AddOnLibraryResponseSchema, BusinessCalendarCreateSchema, BusinessCalendarDetailSchema, BusinessCalendarImportBodySchema, BusinessCalendarListQuerySchema, BusinessCalendarListResponseSchema, BusinessCalendarMutationBodySchema, BusinessCalendarMutationResultSchema, BusinessCalendarOverrideReplaceBodySchema, BusinessCalendarStateTransitionBodySchema, HouseOfferingBindingsReplaceBodySchema, OfferingAddOnAssignmentsReplaceBodySchema, OfferingAddOnAssignmentsReplaceResultSchema, OfferingBindingsReplaceResultSchema, OfferingCustomAddOnCreateBodySchema, OfferingCustomAddOnCreateResultSchema } from "./offerings.js";
import { OutboxDeliveryDetailParamsSchema, OutboxDeliveryHealthSchema, OutboxDeliveryListResponseSchema, OutboxDeliveryQuerySchema, OutboxDeliveryReplayInputSchema, OutboxDeliveryReplayResultSchema, OutboxDeliverySchema } from "./outbox.js";
import { CmsDashboardResponseSchema } from "./cms-dashboard.js";
import { AuthUserResponseSchema, ChangePasswordInputSchema, LoginRequestSchema, OkResponseSchema } from "./auth.js";

extendZodWithOpenApi(z);

const openApiMethod = (z.object({}) as z.ZodType & { openapi: unknown }).openapi;

function createRegister(registry: OpenAPIRegistry) {
  return function register<T extends ZodType>(name: string, schema: T): T {
    if (typeof (schema as T & { openapi?: unknown }).openapi !== "function") {
      Object.defineProperty(schema, "openapi", { configurable: true, value: openApiMethod });
    }
    return registry.register(name, schema);
  };
}

function json(schema: ZodType) {
  return { "application/json": { schema } };
}

function errorResponse(description: string, schema: ZodType) {
  return { description, content: json(schema) };
}

const adminRegistry = new OpenAPIRegistry();
const adminRegister = createRegister(adminRegistry);
adminRegistry.registerComponent("securitySchemes", "sessionCookie", { type: "apiKey", in: "cookie", name: "sv_session", description: "Default cookie name; deployments may override SESSION_COOKIE_NAME." });

const adminError = adminRegister("AdminApiError", ApiErrorSchema);
const cmsDetail = adminRegister("CmsNodeDetail", CmsNodeDetailSchema);
const cmsList = adminRegister("CmsNodeListResponse", CmsNodeListResponseSchema);
const cmsListQuery = adminRegister("CmsNodeListQuery", CmsNodeListQuerySchema);
const cmsCreate = adminRegister("CmsNodeCreate", CmsNodeCreateSchema);
const cmsMutation = adminRegister("CmsNodeMutation", CmsNodeMutationSchema);
const cmsTransition = adminRegister("CmsNodeTransition", CmsNodeTransitionSchema);
const cmsArchive = adminRegister("CmsNodeArchive", CmsNodeArchiveSchema);
const cmsPublish = adminRegister("CmsNodePublish", CmsNodePublishSchema);
const cmsPublishResult = adminRegister("CmsNodePublishResult", CmsNodePublishResultSchema);
const siteSettingsDetail = adminRegister("CmsSiteSettingsDetail", CmsSiteSettingsDetailSchema);
const siteSettingsMutation = adminRegister("CmsSiteSettingsMutation", CmsSiteSettingsMutationSchema);
const siteSettingsPublish = adminRegister("CmsSiteSettingsPublish", CmsSiteSettingsPublishSchema);
const idParams = adminRegister("CmsNodeIdParams", CmsNodeIdParamsSchema);
const previewRevisionParams = adminRegister("CmsRevisionIdParams", CmsRevisionIdParamsSchema);
const previewTokenIssue = adminRegister("CmsPreviewTokenIssue", CmsPreviewTokenIssueSchema);
const previewTokenResponse = adminRegister("CmsPreviewTokenResponse", CmsPreviewTokenResponseSchema);
const releaseIdParams = adminRegister("CmsReleaseIdParams", CmsReleaseIdParamsSchema);
const releaseBuild = adminRegister("CmsReleaseBuildInput", CmsReleaseBuildInputSchema);
const releaseActivate = adminRegister("CmsReleaseActivateInput", CmsReleaseActivateInputSchema);
const releaseDetail = adminRegister("CmsReleaseDetail", CmsReleaseDetailSchema);
const mediaAssetId = adminRegister("MediaAssetIdParams", MediaAssetIdParamsSchema);
const mediaUploadId = adminRegister("MediaUploadIdParams", MediaUploadIdParamsSchema);
const mediaUploadToken = adminRegister("MediaUploadTokenQuery", MediaUploadTokenQuerySchema);
const mediaListQuery = adminRegister("MediaAssetListQuery", MediaAssetListQuerySchema);
const mediaList = adminRegister("MediaAssetListResponse", MediaAssetListResponseSchema);
const mediaDetail = adminRegister("MediaAssetDetail", MediaAssetDetailSchema);
const mediaUploadInit = adminRegister("MediaUploadInit", MediaUploadInitSchema);
const mediaUploadGrant = adminRegister("MediaUploadGrant", MediaUploadGrantSchema);
const mediaMutation = adminRegister("MediaAssetMetadataMutation", MediaAssetMetadataMutationSchema);
const mediaArchive = adminRegister("MediaAssetArchive", MediaAssetArchiveSchema);
const offeringListQuery = adminRegister("OfferingListQuery", OfferingListOpenApiQuerySchema);
const offeringList = adminRegister("OfferingListResponse", OfferingListResponseSchema);
const addOnOfferingCreate = adminRegister("AddOnOfferingCreateBody", AddOnOfferingCreateBodySchema);
const addOnOfferingCreateResult = adminRegister("AddOnOfferingCreateResult", AddOnOfferingCreateResultSchema);
const addOnTermsMutation = adminRegister("AddOnTermsMutationBody", AddOnTermsMutationBodySchema);
const addOnTermsMutationResult = adminRegister("AddOnTermsMutationResult", AddOnTermsMutationResultSchema);
const offeringBindingTargetLookupQuery = adminRegister("OfferingBindingTargetLookupQuery", OfferingBindingTargetLookupQuerySchema);
const offeringBindingTargetLookup = adminRegister("OfferingBindingTargetLookupResponse", OfferingBindingTargetLookupResponseSchema);
adminRegister("OfferingEditorialLocator", OfferingEditorialLocatorSchema);
const internalOfferingEditor = adminRegister("InternalOfferingEditor", InternalOfferingEditorSchema);
const housePriceBookDraftCreate = adminRegister("HousePriceBookDraftCreateBody", HousePriceBookDraftCreateBodySchema);
const housePriceBookDraftReplace = adminRegister("HousePriceBookDraftReplaceBody", HousePriceBookDraftReplaceBodySchema);
const housePriceBookActivate = adminRegister("HousePriceBookActivateBody", HousePriceBookActivateBodySchema);
const housePriceBookSchedule = adminRegister("HousePriceBookScheduleBody", HousePriceBookScheduleBodySchema);
const offeringPricingMutationResult = adminRegister("OfferingPricingMutationResult", OfferingPricingMutationResultSchema);
const internalHouseOfferingQuote = adminRegister("InternalHouseOfferingQuoteBody", InternalHouseOfferingQuoteBodySchema);
const internalOfferingQuoteResult = adminRegister("InternalOfferingQuoteResult", InternalOfferingQuoteResultSchema);
const programOfferingLookupResult = adminRegister("ProgramOfferingLookupResult", ProgramOfferingLookupResultSchema);
const programOfferingPrepare = adminRegister("ProgramOfferingPrepareBody", ProgramOfferingPrepareBodySchema);
const programOfferingPrepareResult = adminRegister("ProgramOfferingPrepareResult", ProgramOfferingPrepareResultSchema);
const programOfferingQuotePreview = adminRegister("ProgramOfferingQuotePreviewBody", ProgramOfferingQuotePreviewBodySchema);
const programOfferingQuoteResult = adminRegister("ProgramOfferingQuoteResult", ProgramOfferingQuoteResultSchema);
const offeringIdParams = adminRegister("OfferingIdParams", z.object({ offeringId: z.string().uuid() }).strict());
const programTemplateOfferingParams = adminRegister("ProgramTemplateOfferingParams", z.object({ programTemplateId: z.string().uuid() }).strict());
const offeringPriceBookParams = adminRegister("OfferingPriceBookParams", z.object({ offeringId: z.string().uuid(), priceBookId: z.string().uuid() }).strict());
const calendarIdParams = adminRegister("BusinessCalendarIdParams", z.object({ calendarId: z.string().uuid() }).strict());
const calendarDateParams = adminRegister("BusinessCalendarDateParams", z.object({ calendarId: z.string().uuid(), date: z.string().date() }).strict());
const calendarListQuery = adminRegister("BusinessCalendarListQuery", BusinessCalendarListQuerySchema);
const calendarList = adminRegister("BusinessCalendarListResponse", BusinessCalendarListResponseSchema);
const calendarCreate = adminRegister("BusinessCalendarCreate", BusinessCalendarCreateSchema);
const calendarDetail = adminRegister("BusinessCalendarDetail", BusinessCalendarDetailSchema);
const calendarMutation = adminRegister("BusinessCalendarMutationBody", BusinessCalendarMutationBodySchema);
const calendarImport = adminRegister("BusinessCalendarImportBody", BusinessCalendarImportBodySchema);
const calendarOverrideReplace = adminRegister("BusinessCalendarOverrideReplaceBody", BusinessCalendarOverrideReplaceBodySchema);
const calendarStateTransition = adminRegister("BusinessCalendarStateTransitionBody", BusinessCalendarStateTransitionBodySchema);
const calendarMutationResult = adminRegister("BusinessCalendarMutationResult", BusinessCalendarMutationResultSchema);
const houseBindingsReplace = adminRegister("HouseOfferingBindingsReplaceBody", HouseOfferingBindingsReplaceBodySchema);
const bindingsReplaceResult = adminRegister("OfferingBindingsReplaceResult", OfferingBindingsReplaceResultSchema);
const addOnLibraryQuery = adminRegister("AddOnLibraryQuery", AddOnLibraryQuerySchema);
const addOnLibrary = adminRegister("AddOnLibraryResponse", AddOnLibraryResponseSchema);
const addOnAssignmentsReplace = adminRegister("OfferingAddOnAssignmentsReplaceBody", OfferingAddOnAssignmentsReplaceBodySchema);
const addOnAssignmentsReplaceResult = adminRegister("OfferingAddOnAssignmentsReplaceResult", OfferingAddOnAssignmentsReplaceResultSchema);
const customAddOnCreate = adminRegister("OfferingCustomAddOnCreateBody", OfferingCustomAddOnCreateBodySchema);
const customAddOnCreateResult = adminRegister("OfferingCustomAddOnCreateResult", OfferingCustomAddOnCreateResultSchema);
const deliveryQuery = adminRegister("OutboxDeliveryQuery", OutboxDeliveryQuerySchema);
const deliveryDetailParams = adminRegister("OutboxDeliveryDetailParams", OutboxDeliveryDetailParamsSchema);
const deliveryDetail = adminRegister("OutboxDelivery", OutboxDeliverySchema);
const deliveryList = adminRegister("OutboxDeliveryListResponse", OutboxDeliveryListResponseSchema);
const deliveryHealth = adminRegister("OutboxDeliveryHealth", OutboxDeliveryHealthSchema);
const deliveryReplay = adminRegister("OutboxDeliveryReplayInput", OutboxDeliveryReplayInputSchema);
const deliveryReplayResult = adminRegister("OutboxDeliveryReplayResult", OutboxDeliveryReplayResultSchema);
const cmsDashboard = adminRegister("CmsDashboardResponse", CmsDashboardResponseSchema);
const authUserResponse = adminRegister("AuthUserResponse", AuthUserResponseSchema);
const loginRequest = adminRegister("LoginRequest", LoginRequestSchema);
const changePassword = adminRegister("ChangePasswordInput", ChangePasswordInputSchema);
const okResponse = adminRegister("OkResponse", OkResponseSchema);

const adminPrivate = { security: [{ sessionCookie: [] as string[] }] };
const adminPublic = { security: [] as { sessionCookie: string[] }[] };
adminRegistry.registerPath({ method: "post", path: "/auth/login", ...adminPublic, tags: ["Auth"], summary: "Create the shared cookie session from the CMS surface", request: { body: { required: true, content: json(loginRequest) } }, responses: { 200: { description: "Authenticated user", content: json(authUserResponse) }, 400: errorResponse("Invalid credentials payload", adminError), 401: errorResponse("Invalid credentials", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/auth/logout", ...adminPrivate, tags: ["Auth"], summary: "End the shared cookie session from the CMS surface", responses: { 200: { description: "Session ended", content: json(okResponse) }, 401: errorResponse("Session required", adminError) } });
adminRegistry.registerPath({ method: "get", path: "/auth/session", ...adminPrivate, tags: ["Auth"], summary: "Get the current shared session user from the CMS surface", responses: { 200: { description: "Current session user", content: json(authUserResponse) }, 401: errorResponse("Session required", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/auth/change-password", ...adminPrivate, tags: ["Auth"], summary: "Change the current password and revoke all shared sessions", request: { body: { required: true, content: json(changePassword) } }, responses: { 200: { description: "Password changed and sessions revoked", content: json(okResponse) }, 400: errorResponse("Invalid password payload", adminError), 401: errorResponse("Current password is incorrect", adminError) } });
adminRegistry.registerPath({ method: "get", path: "/dashboard", ...adminPrivate, tags: ["Dashboard"], summary: "Read authoritative CMS overview and CRM conversion facts", responses: { 200: { description: "CMS dashboard", content: json(cmsDashboard) }, 401: errorResponse("Session required", adminError), 403: errorResponse("Content view capability denied", adminError) } });
adminRegistry.registerPath({ method: "get", path: "/content/nodes", ...adminPrivate, tags: ["Content"], summary: "List and search CMS nodes", request: { query: cmsListQuery }, responses: { 200: { description: "Cursor page of CMS nodes", content: json(cmsList) }, 400: errorResponse("Invalid cursor or filter", adminError), 401: errorResponse("Session required", adminError), 403: errorResponse("Content view capability denied", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/content/nodes", ...adminPrivate, tags: ["Content"], summary: "Create a CMS node and its first draft", request: { body: { required: true, content: json(cmsCreate) } }, responses: { 201: { description: "Created CMS node", content: json(cmsDetail) }, 400: errorResponse("Invalid content", adminError), 401: errorResponse("Session required", adminError), 403: errorResponse("Content edit capability denied", adminError), 409: errorResponse("Route placement or idempotency conflict", adminError) } });
adminRegistry.registerPath({ method: "get", path: "/content/nodes/{id}", ...adminPrivate, tags: ["Content"], summary: "Read a CMS node, working revision and latest published metadata", request: { params: idParams }, responses: { 200: { description: "CMS node", content: json(cmsDetail) }, 401: errorResponse("Session required", adminError), 403: errorResponse("Content view capability denied", adminError), 404: errorResponse("Node not found", adminError) } });
adminRegistry.registerPath({ method: "patch", path: "/content/nodes/{id}", ...adminPrivate, tags: ["Content"], summary: "Create the next immutable CMS draft revision", request: { params: idParams, body: { required: true, content: json(cmsMutation) } }, responses: { 200: { description: "CMS node with new draft", content: json(cmsDetail) }, 400: errorResponse("Invalid mutation", adminError), 401: errorResponse("Session required", adminError), 403: errorResponse("Content edit capability denied", adminError), 409: errorResponse("Version, route placement or idempotency conflict", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/content/nodes/{id}/submit-review", ...adminPrivate, tags: ["Content"], summary: "Submit the current draft for review without changing its content", request: { params: idParams, body: { required: true, content: json(cmsTransition) } }, responses: { 200: { description: "Review revision", content: json(cmsDetail) }, 403: errorResponse("Content edit capability denied", adminError), 409: errorResponse("Invalid state or version conflict", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/content/nodes/{id}/return-to-draft", ...adminPrivate, tags: ["Content"], summary: "Return a review revision to draft without changing its content", request: { params: idParams, body: { required: true, content: json(cmsTransition) } }, responses: { 200: { description: "Draft revision", content: json(cmsDetail) }, 403: errorResponse("Content review capability denied", adminError), 409: errorResponse("Invalid state or version conflict", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/content/nodes/{id}/archive", ...adminPrivate, tags: ["Content"], summary: "Archive a CMS node", request: { params: idParams, body: { required: true, content: json(cmsArchive) } }, responses: { 200: { description: "Archived CMS node", content: json(cmsDetail) }, 403: errorResponse("Content edit capability denied", adminError), 409: errorResponse("Version conflict", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/content/nodes/{id}/publish", ...adminPrivate, tags: ["Content"], summary: "Publish this page directly; immutable publication journal stays internal", request: { params: idParams, body: { required: true, content: json(cmsPublish) } }, responses: { 200: { description: "Published page", content: json(cmsPublishResult) }, 403: errorResponse("Publication capability denied", adminError), 409: errorResponse("Version or concurrent publication conflict", adminError), 422: errorResponse("Page validation failed", adminError) } });
adminRegistry.registerPath({ method: "get", path: "/site-settings", ...adminPrivate, tags: ["Site settings"], summary: "Read draft and published navigation/site settings", responses: { 200: { description: "Versioned site settings", content: json(siteSettingsDetail) }, 403: errorResponse("Content view capability denied", adminError) } });
adminRegistry.registerPath({ method: "patch", path: "/site-settings", ...adminPrivate, tags: ["Site settings"], summary: "Save navigation and global site settings as a draft", request: { body: { required: true, content: json(siteSettingsMutation) } }, responses: { 200: { description: "Saved settings draft", content: json(siteSettingsDetail) }, 403: errorResponse("Content edit capability denied", adminError), 409: errorResponse("Version conflict", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/site-settings/publish", ...adminPrivate, tags: ["Site settings"], summary: "Publish navigation and site settings directly", request: { body: { required: true, content: json(siteSettingsPublish) } }, responses: { 200: { description: "Published settings", content: json(siteSettingsDetail) }, 403: errorResponse("Publication capability denied", adminError), 409: errorResponse("Version or concurrent publication conflict", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/content/revisions/{revisionId}/preview-token", ...adminPrivate, tags: ["Content"], summary: "Issue a short-lived noindex preview token for one revision", request: { params: previewRevisionParams, body: { required: true, content: json(previewTokenIssue) } }, responses: { 200: { description: "Preview token", content: json(previewTokenResponse) }, 403: errorResponse("Content view capability denied", adminError), 404: errorResponse("Revision not found", adminError), 503: errorResponse("Preview signing secret is not configured", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/content/nodes/{id}/approve", ...adminPrivate, tags: ["Content"], summary: "Approve a reviewed immutable revision for release building", request: { params: idParams, body: { required: true, content: json(cmsTransition) } }, responses: { 200: { description: "Approved revision", content: json(cmsDetail) }, 403: errorResponse("Content review capability denied", adminError), 409: errorResponse("Invalid state or version conflict", adminError) } });
adminRegistry.registerPath({ method: "get", path: "/releases/{id}", ...adminPrivate, tags: ["Publication"], summary: "Read an immutable CMS release manifest", request: { params: releaseIdParams }, responses: { 200: { description: "Release detail", content: json(releaseDetail) }, 403: errorResponse("Content view capability denied", adminError), 404: errorResponse("Release not found", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/releases/build", ...adminPrivate, tags: ["Publication"], summary: "Validate and build an immutable ready release from approved revisions", request: { body: { required: true, content: json(releaseBuild) } }, responses: { 201: { description: "Ready immutable release", content: json(releaseDetail) }, 403: errorResponse("Publication capability denied", adminError), 422: errorResponse("Release materialization or dependency validation failed", adminError), 409: errorResponse("Base release conflict", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/releases/{id}/activate", ...adminPrivate, tags: ["Publication"], summary: "Atomically activate one ready release using the active-release version and base-release CAS", request: { params: releaseIdParams, body: { required: true, content: json(releaseActivate) } }, responses: { 200: { description: "Published active release", content: json(releaseDetail) }, 403: errorResponse("Publication capability denied", adminError), 409: errorResponse("Active release or ready release changed", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/releases/{id}/rollback", ...adminPrivate, tags: ["Publication"], summary: "Clone a historical published release into a new immutable release and atomically activate it", request: { params: releaseIdParams, body: { required: true, content: json(releaseActivate) } }, responses: { 200: { description: "New active rollback release", content: json(releaseDetail) }, 403: errorResponse("Publication capability denied", adminError), 409: errorResponse("Active release changed or source is not published", adminError) } });
adminRegistry.registerPath({ method: "get", path: "/media/assets", ...adminPrivate, tags: ["Media"], summary: "List media assets and processing state", request: { query: mediaListQuery }, responses: { 200: { description: "Media assets", content: json(mediaList) }, 403: errorResponse("Content view capability denied", adminError) } });
adminRegistry.registerPath({ method: "get", path: "/media/assets/{assetId}", ...adminPrivate, tags: ["Media"], summary: "Read variants, metadata and refreshed usage graph", request: { params: mediaAssetId }, responses: { 200: { description: "Media asset detail", content: json(mediaDetail) }, 404: errorResponse("Asset not found", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/media/uploads", ...adminPrivate, tags: ["Media"], summary: "Issue a scoped, expiring local/S3-compatible upload grant", request: { body: { required: true, content: json(mediaUploadInit) } }, responses: { 201: { description: "Scoped upload grant", content: json(mediaUploadGrant) }, 409: errorResponse("Duplicate content hash", adminError), 422: errorResponse("Media type or filename rejected", adminError) } });
adminRegistry.registerPath({ method: "put", path: "/media/uploads/{uploadId}/content", security: [], tags: ["Media"], summary: "Consume a signed upload grant and process one image", request: { params: mediaUploadId, query: mediaUploadToken, body: { required: true, content: { "application/octet-stream": { schema: z.string() } } } }, responses: { 200: { description: "Ready processed media asset" }, 401: errorResponse("Upload grant invalid or expired", adminError), 413: errorResponse("Upload too large", adminError), 422: errorResponse("Checksum, MIME, magic or decode policy failed", adminError) } });
adminRegistry.registerPath({ method: "patch", path: "/media/assets/{assetId}", ...adminPrivate, tags: ["Media"], summary: "Update alt, rights and focal metadata with optimistic concurrency", request: { params: mediaAssetId, body: { required: true, content: json(mediaMutation) } }, responses: { 200: { description: "Updated media asset", content: json(mediaDetail) }, 409: errorResponse("Version conflict", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/media/assets/{assetId}/archive", ...adminPrivate, tags: ["Media"], summary: "Archive an asset only when no published usage exists", request: { params: mediaAssetId, body: { required: true, content: json(mediaArchive) } }, responses: { 200: { description: "Archived media asset", content: json(mediaDetail) }, 409: errorResponse("Published usage or version conflict", adminError) } });
adminRegistry.registerPath({ method: "get", path: "/offerings", ...adminPrivate, tags: ["Offerings"], summary: "List stay or add-on offerings through the shared operational service", request: { query: offeringListQuery }, responses: { 200: { description: "Typed offering catalog", content: json(offeringList) }, 403: errorResponse("Operational or content view capability denied", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/offerings/addons", ...adminPrivate, tags: ["Offerings"], summary: "Create an operational add-on with its canonical CMS draft", request: { body: { required: true, content: json(addOnOfferingCreate) } }, responses: { 201: { description: "Add-on and editorial locator created", content: json(addOnOfferingCreateResult) }, 409: errorResponse("Code, owner or idempotency conflict", adminError), 422: errorResponse("Add-on terms are invalid", adminError) } });
adminRegistry.registerPath({ method: "put", path: "/offerings/{offeringId}/addon-terms", ...adminPrivate, tags: ["Offerings"], summary: "Replace add-on operational terms with subject CAS", request: { params: offeringIdParams, body: { required: true, content: json(addOnTermsMutation) } }, responses: { 200: { description: "Add-on terms replaced", content: json(addOnTermsMutationResult) }, 409: errorResponse("Subject version or idempotency conflict", adminError), 422: errorResponse("Add-on terms are invalid", adminError) } });
adminRegistry.registerPath({ method: "get", path: "/offerings/binding-targets", ...adminPrivate, tags: ["Offerings"], summary: "Search typed resource targets through the shared operational service", request: { query: offeringBindingTargetLookupQuery }, responses: { 200: { description: "Resource binding target cursor page", content: json(offeringBindingTargetLookup) }, 403: errorResponse("Operational or content view capability denied", adminError), 422: errorResponse("Invalid cursor", adminError) } });
adminRegistry.registerPath({ method: "get", path: "/offerings/{offeringId}/editor", ...adminPrivate, tags: ["Offerings"], summary: "Read the shared composite house editor", request: { params: offeringIdParams }, responses: { 200: { description: "Offering editor projection", content: json(internalOfferingEditor) }, 403: errorResponse("Operational or content view capability denied", adminError), 404: errorResponse("Offering not found", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/offerings/{offeringId}/price-books/drafts", ...adminPrivate, tags: ["Offerings"], summary: "Create a shared operational price-book draft", request: { params: offeringIdParams, body: { required: true, content: json(housePriceBookDraftCreate) } }, responses: { 201: { description: "Draft created", content: json(offeringPricingMutationResult) }, 409: errorResponse("Pricing version or idempotency conflict", adminError), 422: errorResponse("Draft validation failed", adminError) } });
adminRegistry.registerPath({ method: "put", path: "/offerings/{offeringId}/price-books/drafts/{priceBookId}", ...adminPrivate, tags: ["Offerings"], summary: "Replace a shared operational price-book draft", request: { params: offeringPriceBookParams, body: { required: true, content: json(housePriceBookDraftReplace) } }, responses: { 200: { description: "Draft replaced", content: json(offeringPricingMutationResult) }, 409: errorResponse("Pricing version, state or idempotency conflict", adminError), 422: errorResponse("Draft validation failed", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/offerings/{offeringId}/price-books/{priceBookId}/activate", ...adminPrivate, tags: ["Offerings"], summary: "Activate a shared immutable house price book", request: { params: offeringPriceBookParams, body: { required: true, content: json(housePriceBookActivate) } }, responses: { 200: { description: "Price book activated", content: json(offeringPricingMutationResult) }, 409: errorResponse("Pricing version, period or state conflict", adminError), 422: errorResponse("Activation readiness failed", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/offerings/{offeringId}/price-books/{priceBookId}/schedule", ...adminPrivate, tags: ["Offerings"], summary: "Schedule a shared immutable house price book", request: { params: offeringPriceBookParams, body: { required: true, content: json(housePriceBookSchedule) } }, responses: { 200: { description: "Price book scheduled", content: json(offeringPricingMutationResult) }, 409: errorResponse("Pricing version, period or state conflict", adminError), 422: errorResponse("Schedule readiness failed", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/offerings/{offeringId}/quotes/preview", ...adminPrivate, tags: ["Offerings"], summary: "Calculate and persist a shared immutable house quote preview", request: { params: offeringIdParams, body: { required: true, content: json(internalHouseOfferingQuote) } }, responses: { 200: { description: "Immutable quote snapshot", content: json(internalOfferingQuoteResult) }, 409: errorResponse("Idempotency conflict", adminError), 422: errorResponse("Quote or pricing configuration invalid", adminError) } });
adminRegistry.registerPath({ method: "get", path: "/programs/{programTemplateId}/offering", ...adminPrivate, tags: ["Programs", "Offerings"], summary: "Resolve a prepared program offering after reload", request: { params: programTemplateOfferingParams }, responses: { 200: { description: "Unprepared, linked or ambiguous program offering resolution", content: json(programOfferingLookupResult) }, 404: errorResponse("Program template not found", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/programs/{programTemplateId}/offering", ...adminPrivate, tags: ["Programs", "Offerings"], summary: "Atomically prepare a program offering and canonical program_detail draft", request: { params: programTemplateOfferingParams, body: { required: true, content: json(programOfferingPrepare) } }, responses: { 201: { description: "Program offering prepared", content: json(programOfferingPrepareResult) }, 409: errorResponse("Template version, idempotency or legacy CMS reconciliation conflict", adminError), 422: errorResponse("Program offering preparation is invalid", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/programs/{programTemplateId}/offering/quotes/preview", ...adminPrivate, tags: ["Programs", "Offerings"], summary: "Persist a non-acceptance-ready ProgramTemplate quote preview", request: { params: programTemplateOfferingParams, body: { required: true, content: json(programOfferingQuotePreview) } }, responses: { 200: { description: "Immutable template preview", content: json(programOfferingQuoteResult) }, 409: errorResponse("Idempotency or offering resolution conflict", adminError), 422: errorResponse("Program pricing is invalid", adminError) } });
adminRegistry.registerPath({ method: "get", path: "/business-calendars", ...adminPrivate, tags: ["Business calendars"], summary: "List operational business calendars", request: { query: calendarListQuery }, responses: { 200: { description: "Calendar cursor page", content: json(calendarList) }, 403: errorResponse("Operational capability denied", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/business-calendars", ...adminPrivate, tags: ["Business calendars"], summary: "Create a draft operational business calendar", request: { body: { required: true, content: json(calendarCreate) } }, responses: { 201: { description: "Calendar created", content: json(calendarMutationResult) }, 409: errorResponse("Code or idempotency conflict", adminError) } });
adminRegistry.registerPath({ method: "get", path: "/business-calendars/{calendarId}", ...adminPrivate, tags: ["Business calendars"], summary: "Read calendar coverage, imported days and overrides", request: { params: calendarIdParams }, responses: { 200: { description: "Calendar detail", content: json(calendarDetail) }, 404: errorResponse("Calendar not found", adminError) } });
adminRegistry.registerPath({ method: "patch", path: "/business-calendars/{calendarId}", ...adminPrivate, tags: ["Business calendars"], summary: "Rename an operational business calendar", request: { params: calendarIdParams, body: { required: true, content: json(calendarMutation) } }, responses: { 200: { description: "Calendar updated", content: json(calendarMutationResult) }, 409: errorResponse("Version or idempotency conflict", adminError) } });
adminRegistry.registerPath({ method: "put", path: "/business-calendars/{calendarId}/import", ...adminPrivate, tags: ["Business calendars"], summary: "Atomically import or correct complete calendar coverage", request: { params: calendarIdParams, body: { required: true, content: json(calendarImport) } }, responses: { 200: { description: "Calendar imported", content: json(calendarMutationResult) }, 409: errorResponse("Version or idempotency conflict", adminError), 422: errorResponse("Coverage cannot be shortened or has gaps", adminError) } });
adminRegistry.registerPath({ method: "put", path: "/business-calendars/{calendarId}/overrides/{date}", ...adminPrivate, tags: ["Business calendars"], summary: "Replace or remove one audited calendar override", request: { params: calendarDateParams, body: { required: true, content: json(calendarOverrideReplace) } }, responses: { 200: { description: "Override replaced", content: json(calendarMutationResult) }, 409: errorResponse("Version or idempotency conflict", adminError), 422: errorResponse("Date is outside imported coverage", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/business-calendars/{calendarId}/state", ...adminPrivate, tags: ["Business calendars"], summary: "Activate or retire a business calendar", request: { params: calendarIdParams, body: { required: true, content: json(calendarStateTransition) } }, responses: { 200: { description: "Calendar state changed", content: json(calendarMutationResult) }, 409: errorResponse("State, reference or version conflict", adminError), 422: errorResponse("Calendar coverage is not activation-ready", adminError) } });
adminRegistry.registerPath({ method: "put", path: "/offerings/{offeringId}/bindings", ...adminPrivate, tags: ["Offerings"], summary: "Atomically replace typed house resource bindings", request: { params: offeringIdParams, body: { required: true, content: json(houseBindingsReplace) } }, responses: { 200: { description: "Bindings replaced", content: json(bindingsReplaceResult) }, 409: errorResponse("Subject version or idempotency conflict", adminError), 422: errorResponse("Binding target is invalid", adminError) } });
adminRegistry.registerPath({ method: "get", path: "/addons", ...adminPrivate, tags: ["Offerings"], summary: "Search the reusable add-on library", request: { query: addOnLibraryQuery }, responses: { 200: { description: "Add-on cursor page", content: json(addOnLibrary) }, 403: errorResponse("Operational capability denied", adminError) } });
adminRegistry.registerPath({ method: "put", path: "/offerings/{offeringId}/add-ons", ...adminPrivate, tags: ["Offerings"], summary: "Atomically replace offering add-on assignments", request: { params: offeringIdParams, body: { required: true, content: json(addOnAssignmentsReplace) } }, responses: { 200: { description: "Add-on assignments replaced", content: json(addOnAssignmentsReplaceResult) }, 409: errorResponse("Add-on version or idempotency conflict", adminError), 422: errorResponse("Add-on target or quantity configuration is invalid", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/offerings/{offeringId}/add-ons/custom", ...adminPrivate, tags: ["Offerings"], summary: "Atomically create and assign an offering-specific add-on", request: { params: offeringIdParams, body: { required: true, content: json(customAddOnCreate) } }, responses: { 201: { description: "Custom add-on created and assigned", content: json(customAddOnCreateResult) }, 409: errorResponse("Add-on version, code or idempotency conflict", adminError), 422: errorResponse("Custom add-on configuration is invalid", adminError) } });
adminRegistry.registerPath({ method: "get", path: "/deliveries", ...adminPrivate, tags: ["Delivery"], summary: "List sanitized outbox delivery state", request: { query: deliveryQuery }, responses: { 200: { description: "Sanitized delivery cursor page", content: json(deliveryList) }, 403: errorResponse("Integration management capability denied", adminError) } });
adminRegistry.registerPath({ method: "get", path: "/deliveries/health", ...adminPrivate, tags: ["Delivery"], summary: "Read per-consumer delivery queue health without payload or error text", responses: { 200: { description: "Sanitized queue health", content: json(deliveryHealth) }, 403: errorResponse("Integration management capability denied", adminError) } });
adminRegistry.registerPath({ method: "get", path: "/deliveries/{consumer}/{eventId}", ...adminPrivate, tags: ["Delivery"], summary: "Read one sanitized outbox delivery", request: { params: deliveryDetailParams }, responses: { 200: { description: "Sanitized delivery", content: json(deliveryDetail) }, 403: errorResponse("Integration management capability denied", adminError), 404: errorResponse("Delivery not found", adminError) } });
adminRegistry.registerPath({ method: "post", path: "/deliveries/{consumer}/{eventId}/replay", ...adminPrivate, tags: ["Delivery"], summary: "Audit and replay a failed or dead-letter delivery using CAS idempotency", request: { params: deliveryDetailParams, body: { required: true, content: json(deliveryReplay) } }, responses: { 200: { description: "Replay journal and reset delivery", content: json(deliveryReplayResult) }, 403: errorResponse("Integration management capability denied", adminError), 404: errorResponse("Delivery not found", adminError), 409: errorResponse("Replay state or idempotency conflict", adminError) } });

export const adminOpenApiDocument = new OpenApiGeneratorV31(adminRegistry.definitions).generateDocument({
  openapi: "3.1.0",
  info: { title: "CMS Admin API", version: "1.0.0", description: "Authenticated CMS operations that are currently implemented by the admin service." },
  servers: [{ url: "/api/admin/v1" }],
  security: [{ sessionCookie: [] }],
});

const publicRegistry = new OpenAPIRegistry();
const publicRegister = createRegister(publicRegistry);
const publicError = publicRegister("PublicApiError", ApiErrorSchema);
const publicPage = publicRegister("PublicPage", PublicPageSchema);
const previewDocument = publicRegister("CmsPreviewDocument", CmsPreviewDocumentSchema);
const resolveQuery = publicRegister("PublicPageResolveQuery", PublicPageResolveQuerySchema);
const previewQuery = publicRegister("PublicPagePreviewQuery", PublicPagePreviewQuerySchema);
const publicSiteSettings = publicRegister("PublicSiteSettings", PublicSiteSettingsSchema);
const publicListingQuery = publicRegister("PublicListingHttpQuery", PublicListingHttpQuerySchema);
const publicListingResult = publicRegister("PublicListingResult", PublicListingResultSchema);
const publicMediaParams = publicRegister("PublicMediaVariantParams", z.object({ assetId: z.string().uuid(), variantId: z.string().uuid() }).strict());
const publicAddOnListQuery = publicRegister("PublicAddOnListQuery", PublicAddOnListQuerySchema);
const publicAddOnList = publicRegister("PublicAddOnListResponse", PublicAddOnListResponseSchema);
const publicAddOnSummaryParams = publicRegister("PublicAddOnSummaryParams", PublicAddOnSummaryParamsSchema);
const publicAddOnSummary = publicRegister("PublicAddOnSummary", PublicAddOnSummarySchema);

publicRegistry.registerPath({ method: "get", path: "/pages/resolve", tags: ["Pages"], summary: "Resolve one published page from the authoritative active release", request: { query: resolveQuery }, responses: { 200: { description: "Published page", headers: { ETag: { schema: { type: "string" } }, "Cache-Control": { schema: { type: "string" } } }, content: json(publicPage) }, 304: { description: "The ETag matches the active release content" }, 404: errorResponse("Published page not found", publicError), 503: errorResponse("Active release is invalid", publicError) } });
publicRegistry.registerPath({ method: "get", path: "/pages/preview", tags: ["Pages"], summary: "Read a signed short-lived CMS authoring snapshot", request: { query: previewQuery }, responses: { 200: { description: "Private noindex authoring snapshot; renderable stays false until inheritance is materialized", headers: { "X-Robots-Tag": { schema: { type: "string", example: "noindex, nofollow, noarchive" } }, "Cache-Control": { schema: { type: "string", example: "private, no-store, max-age=0" } } }, content: json(previewDocument) }, 404: errorResponse("Preview token or revision is not available", publicError), 503: errorResponse("Preview signing secret is not configured", publicError) } });
publicRegistry.registerPath({ method: "get", path: "/site-settings", tags: ["Site settings"], summary: "Read navigation and global settings pinned by the active publication", responses: { 200: { description: "Published site settings", content: json(publicSiteSettings) }, 404: errorResponse("Site settings are not published", publicError) } });
publicRegistry.registerPath({ method: "get", path: "/listings/resolve", tags: ["Listings"], summary: "Resolve a release-pinned public listing with server-validated filters and stable pagination", request: { query: publicListingQuery }, responses: { 200: { description: "Safe resource or program card projections", headers: { "X-Robots-Tag": { schema: { type: "string" } } }, content: json(publicListingResult) }, 400: errorResponse("Unknown or invalid listing query", publicError), 404: errorResponse("Published listing not found", publicError), 503: errorResponse("Listing definition is invalid or unsupported", publicError) } });
publicRegistry.registerPath({ method: "get", path: "/offerings/addons", tags: ["Offerings"], summary: "List release-pinned public add-on summaries through an allowlisted filter set", request: { query: publicAddOnListQuery }, responses: { 200: { description: "Published add-on summary cursor page", headers: { ETag: { schema: { type: "string" } }, "Cache-Control": { schema: { type: "string" } } }, content: json(publicAddOnList) }, 304: { description: "The ETag matches the published add-on listing" }, 400: errorResponse("Unknown or invalid add-on listing query", publicError), 404: errorResponse("Published add-on listing not found", publicError), 503: errorResponse("Published add-on projection is unavailable", publicError) } });
publicRegistry.registerPath({ method: "get", path: "/offerings/addons/{offeringId}", tags: ["Offerings"], summary: "Read one release-pinned public add-on summary", request: { params: publicAddOnSummaryParams }, responses: { 200: { description: "Published add-on summary", headers: { ETag: { schema: { type: "string" } }, "Cache-Control": { schema: { type: "string" } } }, content: json(publicAddOnSummary) }, 304: { description: "The ETag matches the published add-on summary" }, 404: errorResponse("Published add-on not found", publicError), 503: errorResponse("Published add-on projection is unavailable", publicError) } });
publicRegistry.registerPath({ method: "get", path: "/media/{assetId}/{variantId}", tags: ["Media"], summary: "Deliver one immutable ready WebP/AVIF variant", request: { params: publicMediaParams }, responses: { 200: { description: "Immutable image variant", content: { "image/webp": { schema: { type: "string", format: "binary" } }, "image/avif": { schema: { type: "string", format: "binary" } } } }, 404: errorResponse("Variant is absent or not ready", publicError) } });

export const publicOpenApiDocument = new OpenApiGeneratorV31(publicRegistry.definitions).generateDocument({
  openapi: "3.1.0",
  info: { title: "Public Site API", version: "1.0.0", description: "Read-only published page projections and signed CMS previews that are currently implemented." },
  servers: [{ url: "/api/public/v1" }],
});
