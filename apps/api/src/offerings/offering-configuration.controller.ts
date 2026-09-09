import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Post, Put, Query, Req } from "@nestjs/common"

import {
  AddOnLibraryQuerySchema,
  StayOfferingBindingsReplaceBodySchema,
  OfferingAddOnAssignmentsReplaceBodySchema,
  OfferingCustomAddOnCreateBodySchema,
  type AddOnLibraryQuery,
  type StayOfferingBindingsReplace,
  type StayOfferingBindingsReplaceBody,
  type OfferingAddOnAssignmentsReplace,
  type OfferingAddOnAssignmentsReplaceBody,
  type OfferingCustomAddOnCreate,
  type OfferingCustomAddOnCreateBody,
} from "@crm/contracts"

import { RequireCapabilities } from "../common/require-capability.decorator.js"
import type { AuthenticatedRequest } from "../common/request-context.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { OfferingConfigurationApplicationService } from "./offering-configuration-application.service.js"

export abstract class OfferingConfigurationControllerBase {
  constructor(@Inject(OfferingConfigurationApplicationService) protected readonly configuration: OfferingConfigurationApplicationService) {}
  protected abstract context(request: AuthenticatedRequest): { actor: NonNullable<AuthenticatedRequest["sessionUser"]>; requestId: string; entrySurface: "internal" | "admin" }
  bindings(body: StayOfferingBindingsReplace, request: AuthenticatedRequest) { return this.configuration.replaceStayBindings(body, this.context(request)) }
  library(query: AddOnLibraryQuery, request: AuthenticatedRequest) { return this.configuration.listAddOnLibrary(query, this.context(request)) }
  assignments(body: OfferingAddOnAssignmentsReplace, request: AuthenticatedRequest) { return this.configuration.replaceAddOnAssignments(body, this.context(request)) }
  custom(body: OfferingCustomAddOnCreate, request: AuthenticatedRequest) { return this.configuration.createCustomAddOnAndAssign(body, this.context(request)) }
}

@Controller()
@RequireCapabilities("canView")
export class InternalOfferingConfigurationController extends OfferingConfigurationControllerBase {
  @Put("offerings/:offeringId/bindings")
  @RequireCapabilities("canEdit", "canAssign")
  bindingsRoute(@Param("offeringId", new ParseUUIDPipe({ version: "4" })) offeringId: string, @Body(new ZodValidationPipe(StayOfferingBindingsReplaceBodySchema)) body: StayOfferingBindingsReplaceBody, @Req() request: AuthenticatedRequest) { return this.bindings({ ...body, offeringId }, request) }
  @Get("addons")
  libraryRoute(@Query(new ZodValidationPipe(AddOnLibraryQuerySchema)) query: AddOnLibraryQuery, @Req() request: AuthenticatedRequest) { return this.library(query, request) }
  @Put("offerings/:offeringId/add-ons")
  @RequireCapabilities("canEdit", "canAssign")
  assignmentsRoute(@Param("offeringId", new ParseUUIDPipe({ version: "4" })) offeringId: string, @Body(new ZodValidationPipe(OfferingAddOnAssignmentsReplaceBodySchema)) body: OfferingAddOnAssignmentsReplaceBody, @Req() request: AuthenticatedRequest) { return this.assignments({ ...body, offeringId }, request) }
  @Post("offerings/:offeringId/add-ons/custom")
  @HttpCode(HttpStatus.CREATED)
  @RequireCapabilities("canCreate", "canEdit", "canAssign")
  customRoute(@Param("offeringId", new ParseUUIDPipe({ version: "4" })) offeringId: string, @Body(new ZodValidationPipe(OfferingCustomAddOnCreateBodySchema)) body: OfferingCustomAddOnCreateBody, @Req() request: AuthenticatedRequest) { return this.custom({ ...body, offeringId }, request) }
  protected context(request: AuthenticatedRequest) { return { actor: request.sessionUser!, requestId: request.requestId, entrySurface: "internal" as const } }
}

@Controller()
@RequireCapabilities("canView", "canViewContent")
export class AdminOfferingConfigurationController extends OfferingConfigurationControllerBase {
  @Put("offerings/:offeringId/bindings")
  @RequireCapabilities("canEdit", "canAssign", "canEditContent")
  bindingsRoute(@Param("offeringId", new ParseUUIDPipe({ version: "4" })) offeringId: string, @Body(new ZodValidationPipe(StayOfferingBindingsReplaceBodySchema)) body: StayOfferingBindingsReplaceBody, @Req() request: AuthenticatedRequest) { return this.bindings({ ...body, offeringId }, request) }
  @Get("addons")
  libraryRoute(@Query(new ZodValidationPipe(AddOnLibraryQuerySchema)) query: AddOnLibraryQuery, @Req() request: AuthenticatedRequest) { return this.library(query, request) }
  @Put("offerings/:offeringId/add-ons")
  @RequireCapabilities("canEdit", "canAssign", "canEditContent")
  assignmentsRoute(@Param("offeringId", new ParseUUIDPipe({ version: "4" })) offeringId: string, @Body(new ZodValidationPipe(OfferingAddOnAssignmentsReplaceBodySchema)) body: OfferingAddOnAssignmentsReplaceBody, @Req() request: AuthenticatedRequest) { return this.assignments({ ...body, offeringId }, request) }
  @Post("offerings/:offeringId/add-ons/custom")
  @HttpCode(HttpStatus.CREATED)
  @RequireCapabilities("canCreate", "canEdit", "canAssign", "canEditContent")
  customRoute(@Param("offeringId", new ParseUUIDPipe({ version: "4" })) offeringId: string, @Body(new ZodValidationPipe(OfferingCustomAddOnCreateBodySchema)) body: OfferingCustomAddOnCreateBody, @Req() request: AuthenticatedRequest) { return this.custom({ ...body, offeringId }, request) }
  protected context(request: AuthenticatedRequest) { return { actor: request.sessionUser!, requestId: request.requestId, entrySurface: "admin" as const } }
}
