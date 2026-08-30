import { Controller, Get, Inject, Query, Req } from "@nestjs/common"

import { FinanceQuerySchema, type FinanceQuery } from "@crm/contracts/finance"

import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import type { AuthenticatedRequest } from "../common/request-context.js"
import { FinanceService } from "./finance.service.js"

@Controller("finance")
export class FinanceController {
  constructor(@Inject(FinanceService) private readonly finance: FinanceService) {}

  @Get()
  get(@Query(new ZodValidationPipe(FinanceQuerySchema)) query: FinanceQuery, @Req() request: AuthenticatedRequest) {
    return this.finance.get(query, request.sessionUser!)
  }
}
