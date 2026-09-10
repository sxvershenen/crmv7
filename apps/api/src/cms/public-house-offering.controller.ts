import { Controller, Get, Headers, Inject, Query, Res } from "@nestjs/common"
import type { Response } from "express"

import { PublicHouseDetailQuerySchema, PublicHouseListQuerySchema, type PublicHouseDetailQuery, type PublicHouseListQuery } from "@crm/contracts"

import { Public } from "../common/public.decorator.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { PublicHouseOfferingService, type PublicHouseProjectionDocument } from "./public-house-offering.service.js"

@Public()
@Controller("offerings/houses")
export class PublicHouseOfferingController {
  constructor(@Inject(PublicHouseOfferingService) private readonly offerings: PublicHouseOfferingService) {}

  @Get()
  async list(@Query(new ZodValidationPipe(PublicHouseListQuerySchema)) query: PublicHouseListQuery, @Headers("if-none-match") ifNoneMatch: string | undefined, @Res() response: Response) {
    return this.respond(response, ifNoneMatch, await this.offerings.list(query))
  }

  @Get("detail")
  async detail(@Query(new ZodValidationPipe(PublicHouseDetailQuerySchema)) query: PublicHouseDetailQuery, @Headers("if-none-match") ifNoneMatch: string | undefined, @Res() response: Response) {
    return this.respond(response, ifNoneMatch, await this.offerings.detail(query))
  }

  private respond<T>(response: Response, ifNoneMatch: string | undefined, document: PublicHouseProjectionDocument<T>) {
    response.setHeader("ETag", document.etag)
    response.setHeader("Cache-Control", "public, max-age=30, s-maxage=30, stale-while-revalidate=120")
    response.setHeader("Surrogate-Key", document.cacheTags.join(" "))
    if (ifNoneMatch === document.etag) return response.status(304).send()
    return response.status(200).json(document.data)
  }
}
