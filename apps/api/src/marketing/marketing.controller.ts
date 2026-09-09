import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query, Req } from "@nestjs/common"

import {
  MarketingPeriodSchema,
  PromotionMutationSchema,
  PromotionUpdateSchema,
  type MarketingPeriod,
  type PromotionMutation,
  type PromotionUpdate,
} from "@crm/contracts"

import { RequireCapabilities } from "../common/require-capability.decorator.js"
import type { AuthenticatedRequest } from "../common/request-context.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { MarketingService } from "./marketing.service.js"

@Controller("marketing")
export class MarketingController {
  constructor(@Inject(MarketingService) private readonly marketing: MarketingService) {}

  @Get("promotions")
  @RequireCapabilities("canView")
  listPromotions(@Req() request: AuthenticatedRequest) {
    return this.marketing.listPromotions(request.sessionUser!)
  }

  @Get("promotions/:id")
  @RequireCapabilities("canView")
  getPromotion(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Req() request: AuthenticatedRequest) {
    return this.marketing.getPromotion(id, request.sessionUser!)
  }

  @Post("promotions")
  @RequireCapabilities("canManageSettings")
  createPromotion(@Body(new ZodValidationPipe(PromotionMutationSchema)) input: PromotionMutation, @Req() request: AuthenticatedRequest) {
    return this.marketing.createPromotion(input, request.sessionUser!, request.requestId)
  }

  @Patch("promotions/:id")
  @RequireCapabilities("canManageSettings")
  updatePromotion(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body(new ZodValidationPipe(PromotionUpdateSchema)) input: PromotionUpdate, @Req() request: AuthenticatedRequest) {
    return this.marketing.updatePromotion(id, input, request.sessionUser!, request.requestId)
  }

  @Get("report")
  @RequireCapabilities("canView", "canViewFinance")
  report(@Query(new ZodValidationPipe(MarketingPeriodSchema)) period: MarketingPeriod, @Req() request: AuthenticatedRequest) {
    return this.marketing.report(period, request.sessionUser!)
  }
}
