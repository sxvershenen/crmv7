import { Controller, Get, Headers, Inject, Param, Query, Res } from "@nestjs/common"
import type { Response } from "express"

import {
  PublicAddOnListQuerySchema,
  PublicAddOnSummaryParamsSchema,
  type PublicAddOnListQuery,
  type PublicAddOnSummaryParams,
} from "@crm/contracts"

import { Public } from "../common/public.decorator.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { PublicAddonOfferingService, type PublicProjectionDocument } from "./public-addon-offering.service.js"

@Public()
@Controller("offerings/addons")
export class PublicAddonOfferingController {
  constructor(@Inject(PublicAddonOfferingService) private readonly offerings: PublicAddonOfferingService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(PublicAddOnListQuerySchema)) query: PublicAddOnListQuery,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res() response: Response,
  ) {
    return this.respond(response, ifNoneMatch, await this.offerings.list(query))
  }

  @Get(":offeringId")
  async detail(
    @Param(new ZodValidationPipe(PublicAddOnSummaryParamsSchema)) params: PublicAddOnSummaryParams,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res() response: Response,
  ) {
    return this.respond(response, ifNoneMatch, await this.offerings.detail(params.offeringId))
  }

  private respond<T>(response: Response, ifNoneMatch: string | undefined, document: PublicProjectionDocument<T>) {
    response.setHeader("ETag", document.etag)
    response.setHeader("Cache-Control", "public, max-age=30, s-maxage=30, stale-while-revalidate=120")
    response.setHeader("Surrogate-Key", document.cacheTags.join(" "))
    if (ifNoneMatch === document.etag) return response.status(304).send()
    return response.status(200).json(document.data)
  }
}
