import { Controller, Get } from "@nestjs/common"

import { adminOpenApiDocument } from "@crm/contracts"

import { Public } from "../common/public.decorator.js"

@Controller("admin/v1/openapi.json")
export class AdminOpenApiController {
  @Public()
  @Get()
  getDocument(): object {
    return adminOpenApiDocument
  }
}
