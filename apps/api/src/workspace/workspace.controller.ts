import { Body, Controller, Get, Inject, Patch, Query, Req } from "@nestjs/common"

import { WorkspaceProfileUpdateSchema, WorkspaceSettingsUpdateSchema, WorkspaceTeamListQuerySchema, type WorkspaceProfileUpdate, type WorkspaceSettingsUpdate, type WorkspaceTeamListQuery } from "@crm/contracts"

import { RequireCapabilities } from "../common/require-capability.decorator.js"
import type { AuthenticatedRequest } from "../common/request-context.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { WorkspaceService } from "./workspace.service.js"

@Controller("workspace")
export class WorkspaceController {
  constructor(@Inject(WorkspaceService) private readonly workspace: WorkspaceService) {}

  @Get("profile")
  @RequireCapabilities("canView")
  profile(@Req() request: AuthenticatedRequest) {
    return this.workspace.getProfile(request.sessionUser!)
  }

  @Patch("profile")
  @RequireCapabilities("canEdit")
  updateProfile(@Body(new ZodValidationPipe(WorkspaceProfileUpdateSchema)) input: WorkspaceProfileUpdate, @Req() request: AuthenticatedRequest) {
    return this.workspace.updateProfile(input, request.sessionUser!, request.requestId)
  }

  @Get("team")
  @RequireCapabilities("canView")
  team(@Query(new ZodValidationPipe(WorkspaceTeamListQuerySchema)) query: WorkspaceTeamListQuery, @Req() request: AuthenticatedRequest) {
    return this.workspace.listTeam(query, request.sessionUser!)
  }

  @Get("settings")
  @RequireCapabilities("canView")
  settings(@Req() request: AuthenticatedRequest) {
    return this.workspace.getSettings(request.sessionUser!)
  }

  @Patch("settings")
  @RequireCapabilities("canManageSettings")
  updateSettings(@Body(new ZodValidationPipe(WorkspaceSettingsUpdateSchema)) input: WorkspaceSettingsUpdate, @Req() request: AuthenticatedRequest) {
    return this.workspace.updateSettings(input, request.sessionUser!, request.requestId)
  }
}
