import { Body, Controller, Get, HttpCode, Inject, Patch, Post, Req } from "@nestjs/common"
import {
  CmsMetrikaSettingsMutationSchema,
  CmsMetrikaSettingsPublishSchema,
  CmsSiteSettingsMutationSchema,
  CmsSiteSettingsPublishSchema,
  type CmsMetrikaSettingsMutation,
  type CmsMetrikaSettingsPublish,
  type CmsSiteSettingsMutation,
  type CmsSiteSettingsPublish,
} from "@crm/contracts"
import type { AuthenticatedRequest } from "../common/request-context.js"
import { RequireCapabilities } from "../common/require-capability.decorator.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { CmsSiteSettingsService } from "./cms-site-settings.service.js"

@Controller("site-settings")
export class CmsSiteSettingsController {
  constructor(@Inject(CmsSiteSettingsService) private readonly service: CmsSiteSettingsService) {}
  @Get() @RequireCapabilities("canViewContent") get(@Req() request: AuthenticatedRequest) { return this.service.get(request.sessionUser!) }
  @Patch() @RequireCapabilities("canEditContent") update(@Body(new ZodValidationPipe(CmsSiteSettingsMutationSchema)) input: CmsSiteSettingsMutation, @Req() request: AuthenticatedRequest) { return this.service.update(input, request.sessionUser!, request.requestId) }
  @Post("publish") @HttpCode(200) @RequireCapabilities("canPublishContent") publish(@Body(new ZodValidationPipe(CmsSiteSettingsPublishSchema)) input: CmsSiteSettingsPublish, @Req() request: AuthenticatedRequest) { return this.service.publish(input, request.sessionUser!, request.requestId) }
  @Get("integrations/metrika") @RequireCapabilities("canManageIntegrations") getMetrika(@Req() request: AuthenticatedRequest) { return this.service.getMetrika(request.sessionUser!) }
  @Patch("integrations/metrika") @RequireCapabilities("canManageIntegrations") updateMetrika(@Body(new ZodValidationPipe(CmsMetrikaSettingsMutationSchema)) input: CmsMetrikaSettingsMutation, @Req() request: AuthenticatedRequest) { return this.service.updateMetrika(input, request.sessionUser!, request.requestId) }
  @Post("integrations/metrika/publish") @HttpCode(200) @RequireCapabilities("canManageIntegrations") publishMetrika(@Body(new ZodValidationPipe(CmsMetrikaSettingsPublishSchema)) input: CmsMetrikaSettingsPublish, @Req() request: AuthenticatedRequest) { return this.service.publishMetrika(input, request.sessionUser!, request.requestId) }
}
