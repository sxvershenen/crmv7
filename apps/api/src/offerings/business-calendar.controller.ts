import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from "@nestjs/common"
import { z } from "zod"

import {
  BusinessCalendarCreateSchema,
  BusinessCalendarImportBodySchema,
  BusinessCalendarListQuerySchema,
  BusinessCalendarMutationBodySchema,
  BusinessCalendarOverrideReplaceBodySchema,
  BusinessCalendarStateTransitionBodySchema,
  type BusinessCalendarCreate,
  type BusinessCalendarImport,
  type BusinessCalendarImportBody,
  type BusinessCalendarListQuery,
  type BusinessCalendarMutation,
  type BusinessCalendarMutationBody,
  type BusinessCalendarOverrideReplace,
  type BusinessCalendarOverrideReplaceBody,
  type BusinessCalendarStateTransition,
  type BusinessCalendarStateTransitionBody,
} from "@crm/contracts"

import { RequireCapabilities } from "../common/require-capability.decorator.js"
import type { AuthenticatedRequest } from "../common/request-context.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { BusinessCalendarApplicationService } from "./business-calendar-application.service.js"

/** Transport-neutral controller base: Internal and Admin differ only in request context/capability decorators. */
export abstract class BusinessCalendarControllerBase {
  constructor(@Inject(BusinessCalendarApplicationService) protected readonly calendars: BusinessCalendarApplicationService) {}

  protected abstract context(request: AuthenticatedRequest): { actor: NonNullable<AuthenticatedRequest["sessionUser"]>; requestId: string; entrySurface: "internal" | "admin" }

  list(query: BusinessCalendarListQuery, request: AuthenticatedRequest) { return this.calendars.list(query, this.context(request)) }
  detail(calendarId: string, request: AuthenticatedRequest) { return this.calendars.detail(calendarId, this.context(request)) }
  create(body: BusinessCalendarCreate, request: AuthenticatedRequest) { return this.calendars.create(body, this.context(request)) }
  update(body: BusinessCalendarMutation, request: AuthenticatedRequest) { return this.calendars.update(body, this.context(request)) }
  importOfficial(body: BusinessCalendarImport, request: AuthenticatedRequest) { return this.calendars.importOfficial(body, this.context(request)) }
  replaceOverride(body: BusinessCalendarOverrideReplace, request: AuthenticatedRequest) { return this.calendars.replaceOverride(body, this.context(request)) }
  transition(body: BusinessCalendarStateTransition, request: AuthenticatedRequest) { return this.calendars.transition(body, this.context(request)) }
}

@Controller("business-calendars")
@RequireCapabilities("canView")
export class InternalBusinessCalendarController extends BusinessCalendarControllerBase {
  @Get()
  listRoute(@Query(new ZodValidationPipe(BusinessCalendarListQuerySchema)) query: BusinessCalendarListQuery, @Req() request: AuthenticatedRequest) { return this.list(query, request) }
  @Get(":calendarId")
  detailRoute(@Param("calendarId", new ParseUUIDPipe({ version: "4" })) calendarId: string, @Req() request: AuthenticatedRequest) { return this.detail(calendarId, request) }
  @Post()
  @RequireCapabilities("canCreate")
  createRoute(@Body(new ZodValidationPipe(BusinessCalendarCreateSchema)) body: BusinessCalendarCreate, @Req() request: AuthenticatedRequest) { return this.create(body, request) }
  @Patch(":calendarId")
  @RequireCapabilities("canEdit")
  updateRoute(@Param("calendarId", new ParseUUIDPipe({ version: "4" })) calendarId: string, @Body(new ZodValidationPipe(BusinessCalendarMutationBodySchema)) body: BusinessCalendarMutationBody, @Req() request: AuthenticatedRequest) { return this.update({ ...body, calendarId }, request) }
  @Put(":calendarId/import")
  @RequireCapabilities("canEdit")
  importRoute(@Param("calendarId", new ParseUUIDPipe({ version: "4" })) calendarId: string, @Body(new ZodValidationPipe(BusinessCalendarImportBodySchema)) body: BusinessCalendarImportBody, @Req() request: AuthenticatedRequest) { return this.importOfficial({ ...body, calendarId }, request) }
  @Put(":calendarId/overrides/:date")
  @RequireCapabilities("canEdit")
  overrideRoute(@Param("calendarId", new ParseUUIDPipe({ version: "4" })) calendarId: string, @Param("date", new ZodValidationPipe(z.string().date())) date: string, @Body(new ZodValidationPipe(BusinessCalendarOverrideReplaceBodySchema)) body: BusinessCalendarOverrideReplaceBody, @Req() request: AuthenticatedRequest) { return this.replaceOverride({ ...body, calendarId, date }, request) }
  @Post(":calendarId/state")
  @HttpCode(HttpStatus.OK)
  @RequireCapabilities("canChangeStatus")
  transitionRoute(@Param("calendarId", new ParseUUIDPipe({ version: "4" })) calendarId: string, @Body(new ZodValidationPipe(BusinessCalendarStateTransitionBodySchema)) body: BusinessCalendarStateTransitionBody, @Req() request: AuthenticatedRequest) { return this.transition({ ...body, calendarId }, request) }
  protected context(request: AuthenticatedRequest) { return { actor: request.sessionUser!, requestId: request.requestId, entrySurface: "internal" as const } }
}

@Controller("business-calendars")
@RequireCapabilities("canView", "canViewContent")
export class AdminBusinessCalendarController extends BusinessCalendarControllerBase {
  @Get()
  listRoute(@Query(new ZodValidationPipe(BusinessCalendarListQuerySchema)) query: BusinessCalendarListQuery, @Req() request: AuthenticatedRequest) { return this.list(query, request) }
  @Get(":calendarId")
  detailRoute(@Param("calendarId", new ParseUUIDPipe({ version: "4" })) calendarId: string, @Req() request: AuthenticatedRequest) { return this.detail(calendarId, request) }
  @Post()
  @RequireCapabilities("canCreate", "canEditContent")
  createRoute(@Body(new ZodValidationPipe(BusinessCalendarCreateSchema)) body: BusinessCalendarCreate, @Req() request: AuthenticatedRequest) { return this.create(body, request) }
  @Patch(":calendarId")
  @RequireCapabilities("canEdit", "canEditContent")
  updateRoute(@Param("calendarId", new ParseUUIDPipe({ version: "4" })) calendarId: string, @Body(new ZodValidationPipe(BusinessCalendarMutationBodySchema)) body: BusinessCalendarMutationBody, @Req() request: AuthenticatedRequest) { return this.update({ ...body, calendarId }, request) }
  @Put(":calendarId/import")
  @RequireCapabilities("canEdit", "canEditContent")
  importRoute(@Param("calendarId", new ParseUUIDPipe({ version: "4" })) calendarId: string, @Body(new ZodValidationPipe(BusinessCalendarImportBodySchema)) body: BusinessCalendarImportBody, @Req() request: AuthenticatedRequest) { return this.importOfficial({ ...body, calendarId }, request) }
  @Put(":calendarId/overrides/:date")
  @RequireCapabilities("canEdit", "canEditContent")
  overrideRoute(@Param("calendarId", new ParseUUIDPipe({ version: "4" })) calendarId: string, @Param("date", new ZodValidationPipe(z.string().date())) date: string, @Body(new ZodValidationPipe(BusinessCalendarOverrideReplaceBodySchema)) body: BusinessCalendarOverrideReplaceBody, @Req() request: AuthenticatedRequest) { return this.replaceOverride({ ...body, calendarId, date }, request) }
  @Post(":calendarId/state")
  @HttpCode(HttpStatus.OK)
  @RequireCapabilities("canChangeStatus", "canEditContent")
  transitionRoute(@Param("calendarId", new ParseUUIDPipe({ version: "4" })) calendarId: string, @Body(new ZodValidationPipe(BusinessCalendarStateTransitionBodySchema)) body: BusinessCalendarStateTransitionBody, @Req() request: AuthenticatedRequest) { return this.transition({ ...body, calendarId }, request) }
  protected context(request: AuthenticatedRequest) { return { actor: request.sessionUser!, requestId: request.requestId, entrySurface: "admin" as const } }
}
