import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, Res } from "@nestjs/common"
import type { Response } from "express"

import { CustomerArchiveSchema, CustomerCreateSchema, CustomerListQuerySchema, CustomerUpdateSchema, type CustomerArchive, type CustomerCreate, type CustomerListQuery, type CustomerUpdate } from "@crm/contracts"

import type { AuthenticatedRequest } from "../common/request-context.js"
import { RequireCapabilities } from "../common/require-capability.decorator.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { CustomersService } from "./customers.service.js"

@Controller("customers")
export class CustomersController {
  constructor(@Inject(CustomersService) private readonly customers: CustomersService) {}
  @Get() @RequireCapabilities("canView")
  async list(@Query(new ZodValidationPipe(CustomerListQuerySchema)) query: CustomerListQuery, @Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    const page = await this.customers.list(query, request.sessionUser!); if (page.nextCursor) response.setHeader("x-next-cursor", page.nextCursor)
    return page.items
  }
  @Get(":id") @RequireCapabilities("canView") get(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.customers.get(id, request.sessionUser!) }
  @Post() @RequireCapabilities("canCreate") create(@Body(new ZodValidationPipe(CustomerCreateSchema)) input: CustomerCreate, @Req() request: AuthenticatedRequest) { return this.customers.create(input, request.sessionUser!, request.requestId) }
  @Patch(":id") @RequireCapabilities("canEdit") update(@Param("id") id: string, @Body(new ZodValidationPipe(CustomerUpdateSchema)) input: CustomerUpdate, @Req() request: AuthenticatedRequest) { return this.customers.update(id, input, request.sessionUser!, request.requestId) }
  @Post(":id/archive") @RequireCapabilities("canArchive") archive(@Param("id") id: string, @Body(new ZodValidationPipe(CustomerArchiveSchema)) input: CustomerArchive, @Req() request: AuthenticatedRequest) { return this.customers.archive(id, input.version, request.sessionUser!, request.requestId) }
}
