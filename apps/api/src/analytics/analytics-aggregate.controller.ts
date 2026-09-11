import { Controller, Get, Inject, Query } from "@nestjs/common"

import { AnalyticsAggregateQuerySchema, type AnalyticsAggregateQuery } from "@crm/contracts"

import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { RequireCapabilities } from "../common/require-capability.decorator.js"
import { AnalyticsAggregateService } from "./analytics-aggregate.service.js"

@Controller("analytics")
export class AnalyticsAggregateController {
  constructor(@Inject(AnalyticsAggregateService) private readonly analytics: AnalyticsAggregateService) {}

  @Get("aggregates")
  @RequireCapabilities("canViewAnalytics")
  get(@Query(new ZodValidationPipe(AnalyticsAggregateQuerySchema)) query: AnalyticsAggregateQuery) {
    return this.analytics.get(query)
  }
}
