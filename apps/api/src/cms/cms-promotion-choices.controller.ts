import { Controller, Get, Inject, Req } from "@nestjs/common"

import { RequireCapabilities } from "../common/require-capability.decorator.js"
import type { AuthenticatedRequest } from "../common/request-context.js"
import { MarketingService } from "../marketing/marketing.service.js"

/** Read-only CRM promotion choices for CMS composition. */
@Controller("marketing")
export class CmsPromotionChoicesController {
  constructor(@Inject(MarketingService) private readonly marketing: MarketingService) {}

  @Get("promotions")
  @RequireCapabilities("canViewContent")
  list(@Req() request: AuthenticatedRequest) {
    return this.marketing.listPromotions(request.sessionUser!)
  }
}
