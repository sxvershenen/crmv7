import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, Query, Req, Res } from "@nestjs/common"
import type { Response } from "express"

import { EventArchiveSchema, EventCategoryArchiveSchema, EventCategoryCreateSchema, EventCategoryListQuerySchema, EventCategoryUpdateSchema, EventCreateSchema, EventListQuerySchema, EventOrderQuoteBodySchema, EventTransitionSchema, EventUpdateSchema, type EventArchive, type EventCategoryArchive, type EventCategoryCreate, type EventCategoryListQuery, type EventCategoryUpdate, type EventCreate, type EventListQuery, type EventOrderQuoteBody, type EventTransition, type EventUpdate } from "@crm/contracts"

import type { AuthenticatedRequest } from "../common/request-context.js"
import { RequireCapabilities } from "../common/require-capability.decorator.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { EventsService } from "./events.service.js"
import { EventCategoriesService } from "./event-categories.service.js"
import { EventOrderQuoteApplicationService } from "../offerings/event-order-quote-application.service.js"

@Controller("events")
export class EventsController {
  constructor(@Inject(EventsService) private readonly events: EventsService, @Inject(EventCategoriesService) private readonly categories: EventCategoriesService, @Inject(EventOrderQuoteApplicationService) private readonly eventQuotes: EventOrderQuoteApplicationService) {}

  @Get("categories") @RequireCapabilities("canView") listCategories(@Query(new ZodValidationPipe(EventCategoryListQuerySchema)) query: EventCategoryListQuery, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) { return this.page(this.categories.list(query, req.sessionUser!), response) }
  @Get("categories/:id") @RequireCapabilities("canView") getCategory(@Param("id") id: string, @Req() req: AuthenticatedRequest) { return this.categories.get(id, req.sessionUser!) }
  @Post("categories") @RequireCapabilities("canCreate") createCategory(@Body(new ZodValidationPipe(EventCategoryCreateSchema)) input: EventCategoryCreate, @Req() req: AuthenticatedRequest) { return this.categories.create(input, req.sessionUser!, req.requestId) }
  @Patch("categories/:id") @RequireCapabilities("canEdit") updateCategory(@Param("id") id: string, @Body(new ZodValidationPipe(EventCategoryUpdateSchema)) input: EventCategoryUpdate, @Req() req: AuthenticatedRequest) { return this.categories.update(id, input, req.sessionUser!, req.requestId) }
  @Post("categories/:id/archive") @RequireCapabilities("canArchive") archiveCategory(@Param("id") id: string, @Body(new ZodValidationPipe(EventCategoryArchiveSchema)) input: EventCategoryArchive, @Req() req: AuthenticatedRequest) { return this.categories.archive(id, input, req.sessionUser!, req.requestId) }
  @Get() @RequireCapabilities("canView") list(@Query(new ZodValidationPipe(EventListQuerySchema)) query: EventListQuery, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) { return this.page(this.events.list(query, req.sessionUser!), response) }
  @Get(":id") @RequireCapabilities("canView") get(@Param("id") id: string, @Req() req: AuthenticatedRequest) { return this.events.get(id, req.sessionUser!) }
  @Post() @RequireCapabilities("canCreate") create(@Body(new ZodValidationPipe(EventCreateSchema)) input: EventCreate, @Req() req: AuthenticatedRequest) { return this.events.create(input, req.sessionUser!, req.requestId) }
  @Post(":id/quote") @HttpCode(HttpStatus.OK) @RequireCapabilities("canView") quote(@Param("id") id: string, @Body(new ZodValidationPipe(EventOrderQuoteBodySchema)) input: EventOrderQuoteBody, @Req() req: AuthenticatedRequest) { return this.eventQuotes.quote(id, input, { actor: req.sessionUser!, requestId: req.requestId, entrySurface: "internal" }) }
  @Patch(":id") @RequireCapabilities("canEdit") update(@Param("id") id: string, @Body(new ZodValidationPipe(EventUpdateSchema)) input: EventUpdate, @Req() req: AuthenticatedRequest) { return this.events.update(id, input, req.sessionUser!, req.requestId) }
  @Post(":id/transition") @RequireCapabilities("canChangeStatus") transition(@Param("id") id: string, @Body(new ZodValidationPipe(EventTransitionSchema)) input: EventTransition, @Req() req: AuthenticatedRequest) { return this.events.transition(id, input, req.sessionUser!, req.requestId) }
  @Post(":id/archive") @RequireCapabilities("canArchive") archive(@Param("id") id: string, @Body(new ZodValidationPipe(EventArchiveSchema)) input: EventArchive, @Req() req: AuthenticatedRequest) { return this.events.archive(id, input, req.sessionUser!, req.requestId) }
  private async page<T extends { items: unknown[]; nextCursor: string | null }>(result: Promise<T>, response: Response) { const page = await result; if (page.nextCursor) response.setHeader("x-next-cursor", page.nextCursor); return page }
}
