import { Controller, Get, Headers, Inject, Param, Query, Res } from "@nestjs/common"
import type { Response } from "express"

import { PublicEventServiceListQuerySchema, PublicEventServiceSummaryParamsSchema, type PublicEventServiceListQuery, type PublicEventServiceSummaryParams } from "@crm/contracts"

import { Public } from "../common/public.decorator.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { PublicEventServiceOfferingService, type PublicEventServiceProjectionDocument } from "./public-event-service-offering.service.js"

@Public()
@Controller("offerings/event-services")
export class PublicEventServiceOfferingController {
  constructor(@Inject(PublicEventServiceOfferingService) private readonly offerings: PublicEventServiceOfferingService) {}

  @Get()
  async list(@Query(new ZodValidationPipe(PublicEventServiceListQuerySchema)) query: PublicEventServiceListQuery, @Headers("if-none-match") ifNoneMatch: string | undefined, @Res() response: Response) {
    return this.respond(response, ifNoneMatch, await this.offerings.list(query))
  }

  @Get(":offeringId")
  async detail(@Param(new ZodValidationPipe(PublicEventServiceSummaryParamsSchema)) params: PublicEventServiceSummaryParams, @Headers("if-none-match") ifNoneMatch: string | undefined, @Res() response: Response) {
    return this.respond(response, ifNoneMatch, await this.offerings.detail(params.offeringId))
  }

  private respond<T>(response: Response, ifNoneMatch: string | undefined, document: PublicEventServiceProjectionDocument<T>) {
    response.setHeader("ETag", document.etag)
    response.setHeader("Cache-Control", "public, max-age=30, s-maxage=30, stale-while-revalidate=120")
    response.setHeader("Surrogate-Key", document.cacheTags.join(" "))
    if (ifNoneMatch === document.etag) return response.status(304).send()
    return response.status(200).json(document.data)
  }
}
