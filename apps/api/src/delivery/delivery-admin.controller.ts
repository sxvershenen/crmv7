import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req } from "@nestjs/common"

import {
  OutboxDeliveryDetailParamsSchema,
  OutboxDeliveryQuerySchema,
  OutboxDeliveryReplayInputSchema,
  type OutboxDeliveryDetailParams,
  type OutboxDeliveryQuery,
  type OutboxDeliveryReplayInput,
} from "@crm/contracts"

import type { AuthenticatedRequest } from "../common/request-context.js"
import { RequireCapabilities } from "../common/require-capability.decorator.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { DeliveryAdminService } from "./delivery-admin.service.js"

/**
 * The module owner mounts this controller only on the authenticated operator
 * namespace. It intentionally has no public counterpart.
 */
@Controller("deliveries")
@RequireCapabilities("canManageIntegrations")
export class DeliveryAdminController {
  constructor(@Inject(DeliveryAdminService) private readonly delivery: DeliveryAdminService) {}

  @Get()
  list(@Query(new ZodValidationPipe(OutboxDeliveryQuerySchema)) query: OutboxDeliveryQuery, @Req() request: AuthenticatedRequest) {
    return this.delivery.list(query, request.sessionUser!)
  }

  @Get("health")
  health(@Req() request: AuthenticatedRequest) {
    return this.delivery.health(request.sessionUser!)
  }

  @Get(":consumer/:eventId")
  detail(@Param(new ZodValidationPipe(OutboxDeliveryDetailParamsSchema)) params: OutboxDeliveryDetailParams, @Req() request: AuthenticatedRequest) {
    return this.delivery.detail(params, request.sessionUser!)
  }

  @Post(":consumer/:eventId/replay")
  @HttpCode(200)
  replay(
    @Param(new ZodValidationPipe(OutboxDeliveryDetailParamsSchema)) params: OutboxDeliveryDetailParams,
    @Body(new ZodValidationPipe(OutboxDeliveryReplayInputSchema)) input: OutboxDeliveryReplayInput,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.delivery.replay(params, input, request.sessionUser!, request.requestId)
  }
}
