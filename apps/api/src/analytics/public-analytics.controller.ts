import { Body, Controller, Header, HttpCode, Inject, Post, Req, Res } from "@nestjs/common"
import type { Response } from "express"

import { AnalyticsEventBatchSchema, type AnalyticsEventBatch } from "@crm/contracts"

import { Public } from "../common/public.decorator.js"
import type { AuthenticatedRequest } from "../common/request-context.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { PublicIntakeRateLimiter } from "../public-intake/public-intake-rate-limiter.service.js"
import { PublicAnalyticsService } from "./public-analytics.service.js"

@Public()
@Controller("analytics")
export class PublicAnalyticsController {
  constructor(
    @Inject(PublicAnalyticsService) private readonly analytics: PublicAnalyticsService,
    @Inject(PublicIntakeRateLimiter) private readonly rateLimiter: PublicIntakeRateLimiter,
  ) {}

  @Post("events")
  @HttpCode(202)
  @Header("Cache-Control", "no-store")
  async collect(
    @Body(new ZodValidationPipe(AnalyticsEventBatchSchema)) input: AnalyticsEventBatch,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.rateLimiter.consume(request.ip, "public-analytics")
    return this.analytics.collect(input, request, response)
  }
}
