import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Post, Put, Query, Req } from "@nestjs/common"

import {
  OfferingListQuerySchema,
  AddOnOfferingCreateBodySchema,
  AddOnTermsMutationBodySchema,
  HousePriceBookActivateBodySchema,
  HousePriceBookDraftCreateBodySchema,
  HousePriceBookDraftReplaceBodySchema,
  HousePriceBookScheduleBodySchema,
  InternalStayOfferingQuoteBodySchema,
  ResourceStayOfferingQuotePreviewBodySchema,
  OfferingBindingTargetLookupQuerySchema,
  ResourceStayOfferingCreateBodySchema,
  type OfferingListQuery,
  type AddOnOfferingCreateBody,
  type AddOnTermsMutationBody,
  type HousePriceBookActivateBody,
  type HousePriceBookDraftCreateBody,
  type HousePriceBookDraftReplaceBody,
  type HousePriceBookScheduleBody,
  type InternalStayOfferingQuoteBody,
  type ResourceStayOfferingQuotePreviewBody,
  type OfferingBindingTargetLookupQuery,
  type ResourceStayOfferingCreateBody,
} from "@crm/contracts"

import { RequireCapabilities } from "../common/require-capability.decorator.js"
import type { AuthenticatedRequest } from "../common/request-context.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { OfferingEditorApplicationService } from "./offering-editor-application.service.js"

@Controller("offerings")
@RequireCapabilities("canView")
export class InternalOfferingsController {
  constructor(@Inject(OfferingEditorApplicationService) private readonly offerings: OfferingEditorApplicationService) {}

  @Get()
  list(@Query(new ZodValidationPipe(OfferingListQuerySchema)) query: OfferingListQuery, @Req() request: AuthenticatedRequest) {
    return this.offerings.list(query, this.context(request))
  }

  @Post("addons")
  @RequireCapabilities("canCreate", "canEdit")
  createAddOn(@Body(new ZodValidationPipe(AddOnOfferingCreateBodySchema)) body: AddOnOfferingCreateBody, @Req() request: AuthenticatedRequest) {
    return this.offerings.createAddOn(body, this.context(request))
  }

  @Put(":offeringId/addon-terms")
  @RequireCapabilities("canEdit")
  replaceAddOnTerms(@Param("offeringId", new ParseUUIDPipe({ version: "4" })) offeringId: string, @Body(new ZodValidationPipe(AddOnTermsMutationBodySchema)) body: AddOnTermsMutationBody, @Req() request: AuthenticatedRequest) {
    return this.offerings.replaceAddOnTerms(offeringId, body, this.context(request))
  }

  @Get("binding-targets")
  bindingTargets(@Query(new ZodValidationPipe(OfferingBindingTargetLookupQuerySchema)) query: OfferingBindingTargetLookupQuery, @Req() request: AuthenticatedRequest) {
    return this.offerings.bindingTargets(query, this.context(request))
  }

  @Get("by-resource/:resourceId")
  primaryStayOfferingForResource(@Param("resourceId", new ParseUUIDPipe({ version: "4" })) resourceId: string, @Req() request: AuthenticatedRequest) {
    return this.offerings.primaryStayOfferingForResource(resourceId, this.context(request))
  }

  @Post("by-resource/:resourceId")
  @RequireCapabilities("canCreate", "canEdit")
  createStayOfferingFromResource(@Param("resourceId", new ParseUUIDPipe({ version: "4" })) resourceId: string, @Body(new ZodValidationPipe(ResourceStayOfferingCreateBodySchema)) body: ResourceStayOfferingCreateBody, @Req() request: AuthenticatedRequest) {
    return this.offerings.createStayOfferingFromResource(resourceId, body, this.context(request))
  }

  @Post("by-resource/:resourceId/quotes/preview")
  @HttpCode(HttpStatus.OK)
  previewQuoteForResource(@Param("resourceId", new ParseUUIDPipe({ version: "4" })) resourceId: string, @Body(new ZodValidationPipe(ResourceStayOfferingQuotePreviewBodySchema)) body: ResourceStayOfferingQuotePreviewBody, @Req() request: AuthenticatedRequest) {
    return this.offerings.previewQuoteForResource(resourceId, body, this.context(request))
  }

  @Get(":offeringId/editor")
  editor(@Param("offeringId", new ParseUUIDPipe({ version: "4" })) offeringId: string, @Req() request: AuthenticatedRequest) {
    return this.offerings.editor(offeringId, this.context(request))
  }

  @Post(":offeringId/price-books/drafts")
  @RequireCapabilities("canEdit")
  createDraft(@Param("offeringId", new ParseUUIDPipe({ version: "4" })) offeringId: string, @Body(new ZodValidationPipe(HousePriceBookDraftCreateBodySchema)) body: HousePriceBookDraftCreateBody, @Req() request: AuthenticatedRequest) {
    return this.offerings.createDraft(offeringId, body, this.context(request))
  }

  @Put(":offeringId/price-books/drafts/:priceBookId")
  @RequireCapabilities("canEdit")
  replaceDraft(@Param("offeringId", new ParseUUIDPipe({ version: "4" })) offeringId: string, @Param("priceBookId", new ParseUUIDPipe({ version: "4" })) priceBookId: string, @Body(new ZodValidationPipe(HousePriceBookDraftReplaceBodySchema)) body: HousePriceBookDraftReplaceBody, @Req() request: AuthenticatedRequest) {
    return this.offerings.replaceDraft(offeringId, priceBookId, body, this.context(request))
  }

  @Post(":offeringId/price-books/:priceBookId/activate")
  @HttpCode(HttpStatus.OK)
  @RequireCapabilities("canChangeStatus")
  activate(@Param("offeringId", new ParseUUIDPipe({ version: "4" })) offeringId: string, @Param("priceBookId", new ParseUUIDPipe({ version: "4" })) priceBookId: string, @Body(new ZodValidationPipe(HousePriceBookActivateBodySchema)) body: HousePriceBookActivateBody, @Req() request: AuthenticatedRequest) {
    return this.offerings.activate(offeringId, priceBookId, body, this.context(request))
  }

  @Post(":offeringId/price-books/:priceBookId/schedule")
  @HttpCode(HttpStatus.OK)
  @RequireCapabilities("canChangeStatus")
  schedule(@Param("offeringId", new ParseUUIDPipe({ version: "4" })) offeringId: string, @Param("priceBookId", new ParseUUIDPipe({ version: "4" })) priceBookId: string, @Body(new ZodValidationPipe(HousePriceBookScheduleBodySchema)) body: HousePriceBookScheduleBody, @Req() request: AuthenticatedRequest) {
    return this.offerings.schedule(offeringId, priceBookId, body, this.context(request))
  }

  @Post(":offeringId/quotes/preview")
  @HttpCode(HttpStatus.OK)
  previewQuote(@Param("offeringId", new ParseUUIDPipe({ version: "4" })) offeringId: string, @Body(new ZodValidationPipe(InternalStayOfferingQuoteBodySchema)) body: InternalStayOfferingQuoteBody, @Req() request: AuthenticatedRequest) {
    return this.offerings.previewQuote(offeringId, body, this.context(request))
  }

  private context(request: AuthenticatedRequest) {
    return { actor: request.sessionUser!, requestId: request.requestId, entrySurface: "internal" as const }
  }
}
