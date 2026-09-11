import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req } from "@nestjs/common"

import {
  CmsReleaseActivateInputSchema,
  CmsReleaseBuildInputSchema,
  CmsReleaseIdParamsSchema,
  type CmsReleaseActivateInput,
  type CmsReleaseBuildInput,
  type CmsReleaseIdParams,
} from "@crm/contracts"

import { RequireCapabilities } from "../common/require-capability.decorator.js"
import type { AuthenticatedRequest } from "../common/request-context.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { CmsPublicationService } from "./cms-publication.service.js"

@Controller("releases")
export class CmsPublicationController {
  constructor(@Inject(CmsPublicationService) private readonly publication: CmsPublicationService) {}

  @Get()
  @RequireCapabilities("canViewContent")
  list(@Req() request: AuthenticatedRequest) {
    return this.publication.list(request.sessionUser!)
  }

  @Get(":id")
  @RequireCapabilities("canViewContent")
  get(@Param(new ZodValidationPipe(CmsReleaseIdParamsSchema)) params: CmsReleaseIdParams, @Req() request: AuthenticatedRequest) {
    return this.publication.get(params.id, request.sessionUser!)
  }

  @Post("build")
  @RequireCapabilities("canPublishContent")
  build(@Body(new ZodValidationPipe(CmsReleaseBuildInputSchema)) input: CmsReleaseBuildInput, @Req() request: AuthenticatedRequest) {
    return this.publication.build(input, request.sessionUser!, request.requestId)
  }

  @Post(":id/activate")
  @HttpCode(200)
  @RequireCapabilities("canPublishContent")
  activate(@Param(new ZodValidationPipe(CmsReleaseIdParamsSchema)) params: CmsReleaseIdParams, @Body(new ZodValidationPipe(CmsReleaseActivateInputSchema)) input: CmsReleaseActivateInput, @Req() request: AuthenticatedRequest) {
    return this.publication.activate(params.id, input, request.sessionUser!, request.requestId)
  }

  @Post(":id/rollback")
  @HttpCode(200)
  @RequireCapabilities("canPublishContent")
  rollback(@Param(new ZodValidationPipe(CmsReleaseIdParamsSchema)) params: CmsReleaseIdParams, @Body(new ZodValidationPipe(CmsReleaseActivateInputSchema)) input: CmsReleaseActivateInput, @Req() request: AuthenticatedRequest) {
    return this.publication.rollback(params.id, input, request.sessionUser!, request.requestId)
  }
}
