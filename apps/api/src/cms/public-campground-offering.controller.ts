import { Controller, Get, Headers, Inject, Query, Res } from "@nestjs/common"
import type { Response } from "express"

import { PublicCampgroundDetailQuerySchema, PublicCampgroundListQuerySchema, type PublicCampgroundDetailQuery, type PublicCampgroundListQuery } from "@crm/contracts"

import { Public } from "../common/public.decorator.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { PublicCampgroundOfferingService, type PublicCampgroundProjectionDocument } from "./public-campground-offering.service.js"

@Public()
@Controller("offerings/campgrounds")
export class PublicCampgroundOfferingController {
  constructor(@Inject(PublicCampgroundOfferingService) private readonly offerings: PublicCampgroundOfferingService) {}

  @Get()
  async list(@Query(new ZodValidationPipe(PublicCampgroundListQuerySchema)) query: PublicCampgroundListQuery, @Headers("if-none-match") ifNoneMatch: string | undefined, @Res() response: Response) {
    return this.respond(response, ifNoneMatch, await this.offerings.list(query))
  }

  @Get("detail")
  async detail(@Query(new ZodValidationPipe(PublicCampgroundDetailQuerySchema)) query: PublicCampgroundDetailQuery, @Headers("if-none-match") ifNoneMatch: string | undefined, @Res() response: Response) {
    return this.respond(response, ifNoneMatch, await this.offerings.detail(query))
  }

  private respond<T>(response: Response, ifNoneMatch: string | undefined, document: PublicCampgroundProjectionDocument<T>) {
    response.setHeader("ETag", document.etag)
    response.setHeader("Cache-Control", "public, max-age=30, s-maxage=30, stale-while-revalidate=120")
    response.setHeader("Surrogate-Key", document.cacheTags.join(" "))
    if (ifNoneMatch === document.etag) return response.status(304).send()
    return response.status(200).json(document.data)
  }
}
