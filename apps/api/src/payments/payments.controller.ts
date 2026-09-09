import { Body, Controller, Get, Inject, Post, Query, Req } from "@nestjs/common"

import type { AuthenticatedRequest } from "../common/request-context.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { PaymentListHttpQuerySchema, PaymentOperationInputSchema, PaymentSummaryHttpQuerySchema, type PaymentListQuery, type PaymentOperationInput, type PaymentSummaryQuery } from "./payments.contracts.js"
import { PaymentsService } from "./payments.service.js"

@Controller("payments")
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly payments: PaymentsService) {}
  @Get() list(@Query(new ZodValidationPipe(PaymentListHttpQuerySchema)) query: PaymentListQuery, @Req() request: AuthenticatedRequest) { return this.payments.list(query, request.sessionUser!) }
  @Get("summary") summary(@Query(new ZodValidationPipe(PaymentSummaryHttpQuerySchema)) query: PaymentSummaryQuery, @Req() request: AuthenticatedRequest) { return this.payments.summary(query.target, request.sessionUser!) }
  @Post() operate(@Body(new ZodValidationPipe(PaymentOperationInputSchema)) input: PaymentOperationInput, @Req() request: AuthenticatedRequest) { return this.payments.operate(input, request.sessionUser!, request.requestId) }
}
