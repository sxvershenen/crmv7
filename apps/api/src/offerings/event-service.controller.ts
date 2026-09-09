import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Patch, Post, Query, Req } from "@nestjs/common"

import { EventServiceOfferingPrepareBodySchema, EventServiceOfferingQuotePreviewBodySchema, EventServiceTemplateCreateBodySchema, EventServiceTemplateMutationBodySchema, EventServiceTemplateRegistryQuerySchema, EventServiceTemplateReopenBodySchema, type EventServiceOfferingPrepareBody, type EventServiceOfferingQuotePreviewBody, type EventServiceTemplateCreateBody, type EventServiceTemplateMutationBody, type EventServiceTemplateRegistryQuery, type EventServiceTemplateReopenBody } from "@crm/contracts"

import { RequireCapabilities } from "../common/require-capability.decorator.js"
import type { AuthenticatedRequest } from "../common/request-context.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { EventServiceApplicationService } from "./event-service-application.service.js"

abstract class EventServiceControllerBase {
  constructor(@Inject(EventServiceApplicationService) protected readonly eventServices: EventServiceApplicationService) {}
  protected abstract context(request: AuthenticatedRequest): { actor: NonNullable<AuthenticatedRequest["sessionUser"]>; requestId: string; entrySurface: "internal" | "admin" }
  registry(query: EventServiceTemplateRegistryQuery, request: AuthenticatedRequest) { return this.eventServices.registry(query, this.context(request)) }
  create(body: EventServiceTemplateCreateBody, request: AuthenticatedRequest) { return this.eventServices.create(body, this.context(request)) }
  lookup(templateId: string, request: AuthenticatedRequest) { return this.eventServices.lookup(templateId, this.context(request)) }
  update(templateId: string, body: EventServiceTemplateMutationBody, request: AuthenticatedRequest) { return this.eventServices.update(templateId, body, this.context(request)) }
  prepare(templateId: string, body: EventServiceOfferingPrepareBody, request: AuthenticatedRequest) { return this.eventServices.prepare(templateId, body, this.context(request)) }
  reopen(templateId: string, body: EventServiceTemplateReopenBody, request: AuthenticatedRequest) { return this.eventServices.reopen(templateId, body, this.context(request)) }
  preview(offeringId: string, body: EventServiceOfferingQuotePreviewBody, request: AuthenticatedRequest) { return this.eventServices.preview(offeringId, body, this.context(request)) }
  reload(quoteId: string, request: AuthenticatedRequest) { return this.eventServices.reload(quoteId, this.context(request)) }
}

@Controller("event-services")
@RequireCapabilities("canView")
export class InternalEventServiceController extends EventServiceControllerBase {
  @Get()
  registryRoute(@Query(new ZodValidationPipe(EventServiceTemplateRegistryQuerySchema)) query: EventServiceTemplateRegistryQuery, @Req() request: AuthenticatedRequest) { return this.registry(query, request) }
  @Post()
  @RequireCapabilities("canCreate", "canEdit")
  createRoute(@Body(new ZodValidationPipe(EventServiceTemplateCreateBodySchema)) body: EventServiceTemplateCreateBody, @Req() request: AuthenticatedRequest) { return this.create(body, request) }
  @Get("templates/:templateId")
  lookupRoute(@Param("templateId", new ParseUUIDPipe({ version: "4" })) templateId: string, @Req() request: AuthenticatedRequest) { return this.lookup(templateId, request) }
  @Patch("templates/:templateId")
  @RequireCapabilities("canEdit")
  updateRoute(@Param("templateId", new ParseUUIDPipe({ version: "4" })) templateId: string, @Body(new ZodValidationPipe(EventServiceTemplateMutationBodySchema)) body: EventServiceTemplateMutationBody, @Req() request: AuthenticatedRequest) { return this.update(templateId, body, request) }
  @Post("templates/:templateId/prepare")
  @RequireCapabilities("canCreate", "canEdit")
  prepareRoute(@Param("templateId", new ParseUUIDPipe({ version: "4" })) templateId: string, @Body(new ZodValidationPipe(EventServiceOfferingPrepareBodySchema)) body: EventServiceOfferingPrepareBody, @Req() request: AuthenticatedRequest) { return this.prepare(templateId, body, request) }
  @Post("templates/:templateId/reopen")
  @RequireCapabilities("canEdit")
  reopenRoute(@Param("templateId", new ParseUUIDPipe({ version: "4" })) templateId: string, @Body(new ZodValidationPipe(EventServiceTemplateReopenBodySchema)) body: EventServiceTemplateReopenBody, @Req() request: AuthenticatedRequest) { return this.reopen(templateId, body, request) }
  @Post(":offeringId/quotes/preview")
  @HttpCode(HttpStatus.OK)
  previewRoute(@Param("offeringId", new ParseUUIDPipe({ version: "4" })) offeringId: string, @Body(new ZodValidationPipe(EventServiceOfferingQuotePreviewBodySchema)) body: EventServiceOfferingQuotePreviewBody, @Req() request: AuthenticatedRequest) { return this.preview(offeringId, body, request) }
  @Get("quotes/:quoteId")
  reloadRoute(@Param("quoteId", new ParseUUIDPipe({ version: "4" })) quoteId: string, @Req() request: AuthenticatedRequest) { return this.reload(quoteId, request) }
  protected context(request: AuthenticatedRequest) { return { actor: request.sessionUser!, requestId: request.requestId, entrySurface: "internal" as const } }
}

@Controller("event-services")
@RequireCapabilities("canView", "canViewContent")
export class AdminEventServiceController extends EventServiceControllerBase {
  @Get()
  registryRoute(@Query(new ZodValidationPipe(EventServiceTemplateRegistryQuerySchema)) query: EventServiceTemplateRegistryQuery, @Req() request: AuthenticatedRequest) { return this.registry(query, request) }
  @Post()
  @RequireCapabilities("canCreate", "canEdit", "canEditContent")
  createRoute(@Body(new ZodValidationPipe(EventServiceTemplateCreateBodySchema)) body: EventServiceTemplateCreateBody, @Req() request: AuthenticatedRequest) { return this.create(body, request) }
  @Get("templates/:templateId")
  lookupRoute(@Param("templateId", new ParseUUIDPipe({ version: "4" })) templateId: string, @Req() request: AuthenticatedRequest) { return this.lookup(templateId, request) }
  @Patch("templates/:templateId")
  @RequireCapabilities("canEdit", "canEditContent")
  updateRoute(@Param("templateId", new ParseUUIDPipe({ version: "4" })) templateId: string, @Body(new ZodValidationPipe(EventServiceTemplateMutationBodySchema)) body: EventServiceTemplateMutationBody, @Req() request: AuthenticatedRequest) { return this.update(templateId, body, request) }
  @Post("templates/:templateId/prepare")
  @RequireCapabilities("canCreate", "canEdit", "canEditContent")
  prepareRoute(@Param("templateId", new ParseUUIDPipe({ version: "4" })) templateId: string, @Body(new ZodValidationPipe(EventServiceOfferingPrepareBodySchema)) body: EventServiceOfferingPrepareBody, @Req() request: AuthenticatedRequest) { return this.prepare(templateId, body, request) }
  @Post("templates/:templateId/reopen")
  @RequireCapabilities("canEdit", "canEditContent")
  reopenRoute(@Param("templateId", new ParseUUIDPipe({ version: "4" })) templateId: string, @Body(new ZodValidationPipe(EventServiceTemplateReopenBodySchema)) body: EventServiceTemplateReopenBody, @Req() request: AuthenticatedRequest) { return this.reopen(templateId, body, request) }
  @Post(":offeringId/quotes/preview")
  @HttpCode(HttpStatus.OK)
  previewRoute(@Param("offeringId", new ParseUUIDPipe({ version: "4" })) offeringId: string, @Body(new ZodValidationPipe(EventServiceOfferingQuotePreviewBodySchema)) body: EventServiceOfferingQuotePreviewBody, @Req() request: AuthenticatedRequest) { return this.preview(offeringId, body, request) }
  @Get("quotes/:quoteId")
  reloadRoute(@Param("quoteId", new ParseUUIDPipe({ version: "4" })) quoteId: string, @Req() request: AuthenticatedRequest) { return this.reload(quoteId, request) }
  protected context(request: AuthenticatedRequest) { return { actor: request.sessionUser!, requestId: request.requestId, entrySurface: "admin" as const } }
}
