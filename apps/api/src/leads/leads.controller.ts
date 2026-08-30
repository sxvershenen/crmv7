import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, Res } from "@nestjs/common"
import type { Response } from "express"
import { LeadArchiveSchema, LeadCreateSchema, LeadListQuerySchema, LeadTransitionSchema, LeadUpdateSchema, type LeadArchive, type LeadCreate, type LeadListQuery, type LeadTransition, type LeadUpdate } from "@crm/contracts"
import type { AuthenticatedRequest } from "../common/request-context.js"
import { RequireCapabilities } from "../common/require-capability.decorator.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { LeadsService } from "./leads.service.js"

@Controller("leads")
export class LeadsController {
  constructor(@Inject(LeadsService) private readonly leads: LeadsService) {}
  @Get() @RequireCapabilities("canView")
  async list(@Query(new ZodValidationPipe(LeadListQuerySchema)) query: LeadListQuery, @Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) { const page = await this.leads.list(query, request.sessionUser!); if (page.nextCursor) response.setHeader("x-next-cursor", page.nextCursor); return page.items }
  @Get(":id") @RequireCapabilities("canView") get(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.leads.get(id, request.sessionUser!) }
  @Post() @RequireCapabilities("canCreate") create(@Body(new ZodValidationPipe(LeadCreateSchema)) input: LeadCreate, @Req() request: AuthenticatedRequest) { return this.leads.create(input, request.sessionUser!, request.requestId) }
  @Patch(":id") @RequireCapabilities("canEdit") update(@Param("id") id: string, @Body(new ZodValidationPipe(LeadUpdateSchema)) input: LeadUpdate, @Req() request: AuthenticatedRequest) { return this.leads.update(id, input, request.sessionUser!, request.requestId) }
  @Post(":id/transition") @RequireCapabilities("canChangeStatus") transition(@Param("id") id: string, @Body(new ZodValidationPipe(LeadTransitionSchema)) input: LeadTransition, @Req() request: AuthenticatedRequest) { return this.leads.transition(id, input, request.sessionUser!, request.requestId) }
  @Post(":id/archive") @RequireCapabilities("canArchive") archive(@Param("id") id: string, @Body(new ZodValidationPipe(LeadArchiveSchema)) input: LeadArchive, @Req() request: AuthenticatedRequest) { return this.leads.archive(id, input.version, request.sessionUser!, request.requestId) }
}
