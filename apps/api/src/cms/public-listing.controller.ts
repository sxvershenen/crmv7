import { Controller, Get, Inject, Query, Res } from "@nestjs/common"
import type { Response } from "express"

import { PublicListingQuerySchema, type PublicListingQuery } from "@crm/contracts"

import { Public } from "../common/public.decorator.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { PublicListingService } from "./public-listing.service.js"

@Public()
@Controller("listings")
export class PublicListingController {
  constructor(@Inject(PublicListingService) private readonly listings: PublicListingService) {}

  @Get("resolve")
  async resolve(@Query() raw: Record<string, string | string[] | undefined>, @Res() response: Response) {
    const query = this.query(raw)
    const listing = await this.listings.resolve(query)
    response.setHeader("Cache-Control", "public, max-age=30, s-maxage=30, stale-while-revalidate=120")
    response.setHeader("Surrogate-Key", `cms-release:${listing.releaseId} cms-listing:${listing.definition.id}`)
    response.setHeader("X-Robots-Tag", listing.robots === "index_follow" ? "index, follow" : "noindex, follow")
    return response.status(200).json(listing)
  }

  private query(raw: Record<string, string | string[] | undefined>): PublicListingQuery {
    const { path, page, sort, ...filters } = raw
    const normalizedFilters: Record<string, string> = {}
    for (const [key, value] of Object.entries(filters)) {
      if (typeof value !== "string") normalizedFilters[key] = "__invalid_array__"
      else normalizedFilters[key] = value
    }
    return new ZodValidationPipe(PublicListingQuerySchema).transform({
      path,
      page: page === undefined ? 1 : Number(page),
      sort: sort === undefined || sort === "" ? null : sort,
      filters: normalizedFilters,
    })
  }
}
