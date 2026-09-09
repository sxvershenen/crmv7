import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Post, Req } from "@nestjs/common"

import { ProgramOfferingPrepareBodySchema, ProgramOfferingQuotePreviewBodySchema, type ProgramOfferingPrepareBody, type ProgramOfferingQuotePreviewBody } from "@crm/contracts"

import { RequireCapabilities } from "../common/require-capability.decorator.js"
import type { AuthenticatedRequest } from "../common/request-context.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { ProgramOfferingApplicationService } from "./program-offering-application.service.js"

abstract class ProgramOfferingControllerBase {
  constructor(@Inject(ProgramOfferingApplicationService) protected readonly programs: ProgramOfferingApplicationService) {}
  protected abstract context(request: AuthenticatedRequest): { actor: NonNullable<AuthenticatedRequest["sessionUser"]>; requestId: string; entrySurface: "internal" | "admin" }
  lookup(programTemplateId: string, request: AuthenticatedRequest) { return this.programs.lookup(programTemplateId, this.context(request)) }
  prepare(programTemplateId: string, body: ProgramOfferingPrepareBody, request: AuthenticatedRequest) { return this.programs.prepare(programTemplateId, body, this.context(request)) }
  preview(programTemplateId: string, body: ProgramOfferingQuotePreviewBody, request: AuthenticatedRequest) { return this.programs.preview(programTemplateId, body, this.context(request)) }
}

@Controller("programs")
@RequireCapabilities("canView")
export class InternalProgramOfferingController extends ProgramOfferingControllerBase {
  @Get(":programTemplateId/offering")
  lookupRoute(@Param("programTemplateId", new ParseUUIDPipe({ version: "4" })) id: string, @Req() request: AuthenticatedRequest) { return this.lookup(id, request) }
  @Post(":programTemplateId/offering")
  @RequireCapabilities("canCreate", "canEdit")
  prepareRoute(@Param("programTemplateId", new ParseUUIDPipe({ version: "4" })) id: string, @Body(new ZodValidationPipe(ProgramOfferingPrepareBodySchema)) body: ProgramOfferingPrepareBody, @Req() request: AuthenticatedRequest) { return this.prepare(id, body, request) }
  @Post(":programTemplateId/offering/quotes/preview")
  @HttpCode(HttpStatus.OK)
  previewRoute(@Param("programTemplateId", new ParseUUIDPipe({ version: "4" })) id: string, @Body(new ZodValidationPipe(ProgramOfferingQuotePreviewBodySchema)) body: ProgramOfferingQuotePreviewBody, @Req() request: AuthenticatedRequest) { return this.preview(id, body, request) }
  protected context(request: AuthenticatedRequest) { return { actor: request.sessionUser!, requestId: request.requestId, entrySurface: "internal" as const } }
}

@Controller("programs")
@RequireCapabilities("canView", "canViewContent")
export class AdminProgramOfferingController extends ProgramOfferingControllerBase {
  @Get(":programTemplateId/offering")
  lookupRoute(@Param("programTemplateId", new ParseUUIDPipe({ version: "4" })) id: string, @Req() request: AuthenticatedRequest) { return this.lookup(id, request) }
  @Post(":programTemplateId/offering")
  @RequireCapabilities("canCreate", "canEdit", "canEditContent")
  prepareRoute(@Param("programTemplateId", new ParseUUIDPipe({ version: "4" })) id: string, @Body(new ZodValidationPipe(ProgramOfferingPrepareBodySchema)) body: ProgramOfferingPrepareBody, @Req() request: AuthenticatedRequest) { return this.prepare(id, body, request) }
  @Post(":programTemplateId/offering/quotes/preview")
  @HttpCode(HttpStatus.OK)
  previewRoute(@Param("programTemplateId", new ParseUUIDPipe({ version: "4" })) id: string, @Body(new ZodValidationPipe(ProgramOfferingQuotePreviewBodySchema)) body: ProgramOfferingQuotePreviewBody, @Req() request: AuthenticatedRequest) { return this.preview(id, body, request) }
  protected context(request: AuthenticatedRequest) { return { actor: request.sessionUser!, requestId: request.requestId, entrySurface: "admin" as const } }
}
