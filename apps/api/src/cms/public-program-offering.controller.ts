import { Controller, Get, Headers, Inject, Param, Query, Res } from "@nestjs/common"
import type { Response } from "express"
import { PublicProgramListQuerySchema, PublicProgramSummaryParamsSchema, type PublicProgramListQuery, type PublicProgramSummaryParams } from "@crm/contracts"
import { Public } from "../common/public.decorator.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { PublicProgramOfferingService, type PublicProgramProjectionDocument } from "./public-program-offering.service.js"

@Public()
@Controller("offerings/programs")
export class PublicProgramOfferingController {
  constructor(@Inject(PublicProgramOfferingService) private readonly offerings: PublicProgramOfferingService) {}
  @Get()
  async list(@Query(new ZodValidationPipe(PublicProgramListQuerySchema)) query: PublicProgramListQuery, @Headers("if-none-match") ifNoneMatch: string | undefined, @Res() response: Response) { return this.respond(response, ifNoneMatch, await this.offerings.list(query)) }
  @Get(":offeringId")
  async detail(@Param(new ZodValidationPipe(PublicProgramSummaryParamsSchema)) params: PublicProgramSummaryParams, @Headers("if-none-match") ifNoneMatch: string | undefined, @Res() response: Response) { return this.respond(response, ifNoneMatch, await this.offerings.detail(params.offeringId)) }
  private respond<T>(response: Response, ifNoneMatch: string | undefined, document: PublicProgramProjectionDocument<T>) {
    response.setHeader("ETag", document.etag)
    response.setHeader("Cache-Control", "public, max-age=30, s-maxage=30, stale-while-revalidate=120")
    response.setHeader("Surrogate-Key", document.cacheTags.join(" "))
    if (ifNoneMatch === document.etag) return response.status(304).send()
    return response.status(200).json(document.data)
  }
}
