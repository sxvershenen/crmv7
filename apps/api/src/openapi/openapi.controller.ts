import { Controller, Get } from "@nestjs/common"

import { internalOpenApiDocument } from "@crm/contracts"

import { Public } from "../common/public.decorator.js"

@Controller("openapi.json")
export class OpenApiController {
  @Public()
  @Get()
  getDocument(): object {
    return internalOpenApiDocument
  }
}
