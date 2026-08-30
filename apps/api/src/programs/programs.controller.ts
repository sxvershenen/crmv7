import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, Res } from "@nestjs/common"
import type { Response } from "express"

import { ProgramOccurrenceArchiveSchema, ProgramOccurrenceCreateSchema, ProgramOccurrenceListQuerySchema, ProgramOccurrenceTransitionSchema, ProgramOccurrenceUpdateSchema, ProgramRegistrationArchiveSchema, ProgramRegistrationCreateSchema, ProgramRegistrationListQuerySchema, ProgramRegistrationTransitionSchema, ProgramRegistrationUpdateSchema, ProgramTemplateArchiveSchema, ProgramTemplateCreateSchema, ProgramTemplateListQuerySchema, ProgramTemplateUpdateSchema, type ProgramOccurrenceArchive, type ProgramOccurrenceCreate, type ProgramOccurrenceListQuery, type ProgramOccurrenceTransition, type ProgramOccurrenceUpdate, type ProgramRegistrationArchive, type ProgramRegistrationCreate, type ProgramRegistrationListQuery, type ProgramRegistrationTransition, type ProgramRegistrationUpdate, type ProgramTemplateArchive, type ProgramTemplateCreate, type ProgramTemplateListQuery, type ProgramTemplateUpdate } from "@crm/contracts"

import type { AuthenticatedRequest } from "../common/request-context.js"
import { RequireCapabilities } from "../common/require-capability.decorator.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { ProgramsService } from "./programs.service.js"

@Controller("programs")
export class ProgramsController {
  constructor(@Inject(ProgramsService) private readonly programs: ProgramsService) {}

  @Get("templates") @RequireCapabilities("canView") listTemplates(@Query(new ZodValidationPipe(ProgramTemplateListQuerySchema)) query: ProgramTemplateListQuery, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) { return this.page(this.programs.listTemplates(query, req.sessionUser!), response) }
  @Get("templates/:id") @RequireCapabilities("canView") getTemplate(@Param("id") id: string, @Req() req: AuthenticatedRequest) { return this.programs.getTemplate(id, req.sessionUser!) }
  @Post("templates") @RequireCapabilities("canCreate") createTemplate(@Body(new ZodValidationPipe(ProgramTemplateCreateSchema)) input: ProgramTemplateCreate, @Req() req: AuthenticatedRequest) { return this.programs.createTemplate(input, req.sessionUser!, req.requestId) }
  @Patch("templates/:id") @RequireCapabilities("canEdit") updateTemplate(@Param("id") id: string, @Body(new ZodValidationPipe(ProgramTemplateUpdateSchema)) input: ProgramTemplateUpdate, @Req() req: AuthenticatedRequest) { return this.programs.updateTemplate(id, input, req.sessionUser!, req.requestId) }
  @Post("templates/:id/archive") @RequireCapabilities("canArchive") archiveTemplate(@Param("id") id: string, @Body(new ZodValidationPipe(ProgramTemplateArchiveSchema)) input: ProgramTemplateArchive, @Req() req: AuthenticatedRequest) { return this.programs.archiveTemplate(id, input, req.sessionUser!, req.requestId) }

  @Get("occurrences") @RequireCapabilities("canView") listOccurrences(@Query(new ZodValidationPipe(ProgramOccurrenceListQuerySchema)) query: ProgramOccurrenceListQuery, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) { return this.page(this.programs.listOccurrences(query, req.sessionUser!), response) }
  @Get("occurrences/:id") @RequireCapabilities("canView") getOccurrence(@Param("id") id: string, @Req() req: AuthenticatedRequest) { return this.programs.getOccurrence(id, req.sessionUser!) }
  @Post("occurrences") @RequireCapabilities("canCreate") createOccurrence(@Body(new ZodValidationPipe(ProgramOccurrenceCreateSchema)) input: ProgramOccurrenceCreate, @Req() req: AuthenticatedRequest) { return this.programs.createOccurrence(input, req.sessionUser!, req.requestId) }
  @Patch("occurrences/:id") @RequireCapabilities("canEdit") updateOccurrence(@Param("id") id: string, @Body(new ZodValidationPipe(ProgramOccurrenceUpdateSchema)) input: ProgramOccurrenceUpdate, @Req() req: AuthenticatedRequest) { return this.programs.updateOccurrence(id, input, req.sessionUser!, req.requestId) }
  @Post("occurrences/:id/transition") @RequireCapabilities("canChangeStatus") transitionOccurrence(@Param("id") id: string, @Body(new ZodValidationPipe(ProgramOccurrenceTransitionSchema)) input: ProgramOccurrenceTransition, @Req() req: AuthenticatedRequest) { return this.programs.transitionOccurrence(id, input, req.sessionUser!, req.requestId) }
  @Post("occurrences/:id/archive") @RequireCapabilities("canArchive") archiveOccurrence(@Param("id") id: string, @Body(new ZodValidationPipe(ProgramOccurrenceArchiveSchema)) input: ProgramOccurrenceArchive, @Req() req: AuthenticatedRequest) { return this.programs.archiveOccurrence(id, input, req.sessionUser!, req.requestId) }

  @Get("registrations") @RequireCapabilities("canView") listRegistrations(@Query(new ZodValidationPipe(ProgramRegistrationListQuerySchema)) query: ProgramRegistrationListQuery, @Req() req: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) { return this.page(this.programs.listRegistrations(query, req.sessionUser!), response) }
  @Get("registrations/:id") @RequireCapabilities("canView") getRegistration(@Param("id") id: string, @Req() req: AuthenticatedRequest) { return this.programs.getRegistration(id, req.sessionUser!) }
  @Post("registrations") @RequireCapabilities("canCreate") createRegistration(@Body(new ZodValidationPipe(ProgramRegistrationCreateSchema)) input: ProgramRegistrationCreate, @Req() req: AuthenticatedRequest) { return this.programs.createRegistration(input, req.sessionUser!, req.requestId) }
  @Patch("registrations/:id") @RequireCapabilities("canEdit") updateRegistration(@Param("id") id: string, @Body(new ZodValidationPipe(ProgramRegistrationUpdateSchema)) input: ProgramRegistrationUpdate, @Req() req: AuthenticatedRequest) { return this.programs.updateRegistration(id, input, req.sessionUser!, req.requestId) }
  @Post("registrations/:id/transition") @RequireCapabilities("canChangeStatus") transitionRegistration(@Param("id") id: string, @Body(new ZodValidationPipe(ProgramRegistrationTransitionSchema)) input: ProgramRegistrationTransition, @Req() req: AuthenticatedRequest) { return this.programs.transitionRegistration(id, input, req.sessionUser!, req.requestId) }
  @Post("registrations/:id/archive") @RequireCapabilities("canArchive") archiveRegistration(@Param("id") id: string, @Body(new ZodValidationPipe(ProgramRegistrationArchiveSchema)) input: ProgramRegistrationArchive, @Req() req: AuthenticatedRequest) { return this.programs.archiveRegistration(id, input, req.sessionUser!, req.requestId) }

  private async page<T extends { items: unknown[]; nextCursor: string | null }>(result: Promise<T>, response: Response) { const page = await result; if (page.nextCursor) response.setHeader("x-next-cursor", page.nextCursor); return page }
}
