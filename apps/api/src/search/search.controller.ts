import { Controller, Get, Inject, Query, Req } from "@nestjs/common"

import { SearchQuerySchema, type SearchQuery } from "@crm/contracts"

import type { AuthenticatedRequest } from "../common/request-context.js"
import { RequireCapabilities } from "../common/require-capability.decorator.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { SearchService } from "./search.service.js"

@Controller("search")
export class SearchController {
  constructor(@Inject(SearchService) private readonly searchService: SearchService) {}

  @Get()
  @RequireCapabilities("canView")
  search(@Query(new ZodValidationPipe(SearchQuerySchema)) query: SearchQuery, @Req() request: AuthenticatedRequest) {
    return this.searchService.search(query, request.sessionUser!)
  }
}
