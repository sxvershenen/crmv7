import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, Res } from "@nestjs/common"
import type { Response } from "express"

import { EventArchiveSchema, EventCreateSchema, EventListQuerySchema, EventTransitionSchema, EventUpdateSchema, type EventArchive, type EventCreate, type EventListQuery, type EventTransition, type EventUpdate } from "@crm/contracts"

import type { AuthenticatedRequest } from "../common/request-context.js"
import { RequireCapabilities } from "../common/require-capability.decorator.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { EventsService } from "./events.service.js"

@Controller("events")
export class EventsController {
  constructor(@Inject(EventsService) private readonly events: EventsService) {}
  @Get() @RequireCapabilities("canView") list(@Query(new ZodValidationPipe(EventListQuerySchema)) query: EventListQuery, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) { return this.page(this.events.list(query, req.sessionUser!), response) }
  @Get(":id") @RequireCapabilities("canView") get(@Param("id") id: string, @Req() req: AuthenticatedRequest) { return this.events.get(id, req.sessionUser!) }
  @Post() @RequireCapabilities("canCreate") create(@Body(new ZodValidationPipe(EventCreateSchema)) input: EventCreate, @Req() req: AuthenticatedRequest) { return this.events.create(input, req.sessionUser!, req.requestId) }
  @Patch(":id") @RequireCapabilities("canEdit") update(@Param("id") id: string, @Body(new ZodValidationPipe(EventUpdateSchema)) input: EventUpdate, @Req() req: AuthenticatedRequest) { return this.events.update(id, input, req.sessionUser!, req.requestId) }
  @Post(":id/transition") @RequireCapabilities("canChangeStatus") transition(@Param("id") id: string, @Body(new ZodValidationPipe(EventTransitionSchema)) input: EventTransition, @Req() req: AuthenticatedRequest) { return this.events.transition(id, input, req.sessionUser!, req.requestId) }
  @Post(":id/archive") @RequireCapabilities("canArchive") archive(@Param("id") id: string, @Body(new ZodValidationPipe(EventArchiveSchema)) input: EventArchive, @Req() req: AuthenticatedRequest) { return this.events.archive(id, input, req.sessionUser!, req.requestId) }
  private async page<T extends { items: unknown[]; nextCursor: string | null }>(result: Promise<T>, response: Response) { const page = await result; if (page.nextCursor) response.setHeader("x-next-cursor", page.nextCursor); return page }
}
