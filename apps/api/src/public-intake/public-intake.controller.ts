import { randomUUID } from "node:crypto"

import { Body, Controller, Header, HttpCode, HttpStatus, Inject, Post, Req } from "@nestjs/common"

import { PublicLeadIntakeSchema, type PublicLeadIntake } from "@crm/contracts"

import { Public } from "../common/public.decorator.js"
import type { AuthenticatedRequest } from "../common/request-context.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { PublicIntakeRateLimiter } from "./public-intake-rate-limiter.service.js"
import { PublicIntakeService } from "./public-intake.service.js"

@Public()
@Controller("intake")
export class PublicIntakeController {
  constructor(
    @Inject(PublicIntakeRateLimiter) private readonly rateLimiter: PublicIntakeRateLimiter,
    @Inject(PublicIntakeService) private readonly intake: PublicIntakeService,
  ) {}

  @Post("leads")
  @HttpCode(HttpStatus.ACCEPTED)
  @Header("Cache-Control", "no-store")
  async createLead(
    @Body(new ZodValidationPipe(PublicLeadIntakeSchema)) input: PublicLeadIntake,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.rateLimiter.consume(request.ip)
    return this.intake.submit(input, randomUUID())
  }
}
