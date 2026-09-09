import { Controller, Get } from "@nestjs/common"

import { publicOpenApiDocument } from "@crm/contracts"

import { Public } from "../common/public.decorator.js"

@Controller("public/v1/openapi.json")
export class PublicOpenApiController {
  @Public()
  @Get()
  getDocument(): object {
    return publicOpenApiDocument
  }
}
