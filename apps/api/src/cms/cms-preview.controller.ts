import { Body, Controller, HttpCode, Inject, Param, Post, Req } from "@nestjs/common"

import {
  CmsPreviewTokenIssueSchema,
  CmsRevisionIdParamsSchema,
  type CmsPreviewTokenIssue,
  type CmsRevisionIdParams,
} from "@crm/contracts"

import { RequireCapabilities } from "../common/require-capability.decorator.js"
import type { AuthenticatedRequest } from "../common/request-context.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { PublicContentService } from "./public-content.service.js"

/** Issues a bearer preview URL only to authenticated CMS readers. */
@Controller("content/revisions")
export class CmsPreviewController {
  constructor(@Inject(PublicContentService) private readonly content: PublicContentService) {}

  @Post(":revisionId/preview-token")
  @HttpCode(200)
  @RequireCapabilities("canViewContent")
  issue(
    @Param(new ZodValidationPipe(CmsRevisionIdParamsSchema)) params: CmsRevisionIdParams,
    @Body(new ZodValidationPipe(CmsPreviewTokenIssueSchema)) input: CmsPreviewTokenIssue,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.content.issuePreview(params.revisionId, input, request.sessionUser!.id, request.requestId)
  }
}
