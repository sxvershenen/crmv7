import { Body, Controller, Get, HttpCode, Inject, Optional, Param, Patch, Post, Query, Req } from "@nestjs/common"

import {
  CmsNodeArchiveSchema,
  CmsNodeCreateSchema,
  CmsNodeIdParamsSchema,
  CmsNodeListQuerySchema,
  CmsNodeMutationSchema,
  CmsNodePublishSchema,
  CmsNodeTransitionSchema,
  type CmsNodeArchive,
  type CmsNodeCreate,
  type CmsNodeIdParams,
  type CmsNodeListQuery,
  type CmsNodeMutation,
  type CmsNodePublish,
  type CmsNodeTransition,
} from "@crm/contracts"

import type { AuthenticatedRequest } from "../common/request-context.js"
import { RequireCapabilities } from "../common/require-capability.decorator.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { CmsContentService } from "./cms-content.service.js"
import { CmsPublicationService } from "./cms-publication.service.js"

@Controller("content/nodes")
export class CmsContentController {
  constructor(@Inject(CmsContentService) private readonly content: CmsContentService, @Optional() @Inject(CmsPublicationService) private readonly publication?: CmsPublicationService) {}

  @Get()
  @RequireCapabilities("canViewContent")
  list(@Query(new ZodValidationPipe(CmsNodeListQuerySchema)) query: CmsNodeListQuery, @Req() request: AuthenticatedRequest) {
    return this.content.list(query, request.sessionUser!)
  }

  @Post()
  @RequireCapabilities("canEditContent")
  create(@Body(new ZodValidationPipe(CmsNodeCreateSchema)) input: CmsNodeCreate, @Req() request: AuthenticatedRequest) {
    return this.content.create(input, request.sessionUser!, request.requestId)
  }

  @Get(":id")
  @RequireCapabilities("canViewContent")
  get(@Param(new ZodValidationPipe(CmsNodeIdParamsSchema)) params: CmsNodeIdParams, @Req() request: AuthenticatedRequest) {
    return this.content.get(params.id, request.sessionUser!)
  }

  @Patch(":id")
  @RequireCapabilities("canEditContent")
  update(@Param(new ZodValidationPipe(CmsNodeIdParamsSchema)) params: CmsNodeIdParams, @Body(new ZodValidationPipe(CmsNodeMutationSchema)) input: CmsNodeMutation, @Req() request: AuthenticatedRequest) {
    return this.content.update(params.id, input, request.sessionUser!, request.requestId)
  }

  @Post(":id/submit-review")
  @HttpCode(200)
  @RequireCapabilities("canEditContent")
  submitReview(@Param(new ZodValidationPipe(CmsNodeIdParamsSchema)) params: CmsNodeIdParams, @Body(new ZodValidationPipe(CmsNodeTransitionSchema)) input: CmsNodeTransition, @Req() request: AuthenticatedRequest) {
    return this.content.submitReview(params.id, input, request.sessionUser!, request.requestId)
  }

  @Post(":id/return-to-draft")
  @HttpCode(200)
  @RequireCapabilities("canReviewContent")
  returnToDraft(@Param(new ZodValidationPipe(CmsNodeIdParamsSchema)) params: CmsNodeIdParams, @Body(new ZodValidationPipe(CmsNodeTransitionSchema)) input: CmsNodeTransition, @Req() request: AuthenticatedRequest) {
    return this.content.returnToDraft(params.id, input, request.sessionUser!, request.requestId)
  }

  @Post(":id/approve")
  @HttpCode(200)
  @RequireCapabilities("canReviewContent")
  approve(@Param(new ZodValidationPipe(CmsNodeIdParamsSchema)) params: CmsNodeIdParams, @Body(new ZodValidationPipe(CmsNodeTransitionSchema)) input: CmsNodeTransition, @Req() request: AuthenticatedRequest) {
    return this.content.approve(params.id, input, request.sessionUser!, request.requestId)
  }

  @Post(":id/archive")
  @HttpCode(200)
  @RequireCapabilities("canEditContent")
  archive(@Param(new ZodValidationPipe(CmsNodeIdParamsSchema)) params: CmsNodeIdParams, @Body(new ZodValidationPipe(CmsNodeArchiveSchema)) input: CmsNodeArchive, @Req() request: AuthenticatedRequest) {
    return this.content.archive(params.id, input, request.sessionUser!, request.requestId)
  }

  @Post(":id/publish")
  @HttpCode(200)
  @RequireCapabilities("canPublishContent")
  publish(@Param(new ZodValidationPipe(CmsNodeIdParamsSchema)) params: CmsNodeIdParams, @Body(new ZodValidationPipe(CmsNodePublishSchema)) input: CmsNodePublish, @Req() request: AuthenticatedRequest) {
    return this.publication!.publishNode(params.id, input, request.sessionUser!, request.requestId)
  }

  @Get(":id/publication-preview")
  @RequireCapabilities("canViewContent")
  publicationPreview(@Param(new ZodValidationPipe(CmsNodeIdParamsSchema)) params: CmsNodeIdParams, @Req() request: AuthenticatedRequest) {
    return this.publication!.previewNodePublication(params.id, request.sessionUser!)
  }
}
