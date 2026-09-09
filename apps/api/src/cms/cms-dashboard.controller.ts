import { Controller, Get, Inject, Req } from "@nestjs/common"

import type { AuthenticatedRequest } from "../common/request-context.js"
import { RequireCapabilities } from "../common/require-capability.decorator.js"
import { CmsDashboardService } from "./cms-dashboard.service.js"

@Controller("dashboard")
@RequireCapabilities("canViewContent")
export class CmsDashboardController {
  constructor(@Inject(CmsDashboardService) private readonly dashboard: CmsDashboardService) {}

  @Get()
  get(@Req() request: AuthenticatedRequest) { return this.dashboard.get(request.sessionUser!) }
}
