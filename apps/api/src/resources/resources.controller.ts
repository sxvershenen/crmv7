import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, Query, Req } from "@nestjs/common"

import type { AuthenticatedRequest } from "../common/request-context.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { ResourcesService } from "./resources.service.js"
import { EventAllocationReplaceSchema, type EventAllocationReplace } from "@crm/contracts"
import { ResourceAllocationCancelSchema, ResourceAllocationCreateSchema, ResourceAllocationListQuerySchema, ResourceAllocationsQuerySchema, ResourceArchiveSchema, ResourceAvailabilityByCodeQuerySchema, ResourceAvailabilityQuerySchema, ResourceBlockCancelSchema, ResourceBlockCreateSchema, ResourceCreateSchema, ResourceListQuerySchema, ResourceUpdateSchema, type ResourceAllocationCancel, type ResourceAllocationCreate, type ResourceAllocationListQuery, type ResourceAllocationsQuery, type ResourceArchive, type ResourceAvailabilityByCodeQuery, type ResourceAvailabilityQuery, type ResourceBlockCancel, type ResourceBlockCreate, type ResourceCreate, type ResourceListQuery, type ResourceUpdate } from "./resources.contracts.js"

@Controller("resources")
export class ResourcesController {
  constructor(@Inject(ResourcesService) private readonly resources: ResourcesService) {}

  @Get()
  list(@Query(new ZodValidationPipe(ResourceListQuerySchema)) query: ResourceListQuery, @Req() request: AuthenticatedRequest) { return this.resources.list(query, request.sessionUser!) }

  @Get("availability")
  availability(@Query(new ZodValidationPipe(ResourceAvailabilityQuerySchema)) query: ResourceAvailabilityQuery, @Req() request: AuthenticatedRequest) { return this.resources.availability(query, request.sessionUser!) }

  @Get("allocations")
  listAllocations(@Query(new ZodValidationPipe(ResourceAllocationListQuerySchema)) query: ResourceAllocationListQuery, @Req() request: AuthenticatedRequest) { return this.resources.listAllocations(query, request.sessionUser!) }

  @Get(":code/allocations")
  allocations(@Param("code") code: string, @Query(new ZodValidationPipe(ResourceAllocationsQuerySchema)) query: ResourceAllocationsQuery, @Req() request: AuthenticatedRequest) { return this.resources.allocations(code, query, request.sessionUser!) }

  @Get(":code/blocks")
  blocks(@Param("code") code: string, @Query(new ZodValidationPipe(ResourceAllocationsQuerySchema)) query: ResourceAllocationsQuery, @Req() request: AuthenticatedRequest) { return this.resources.blocks(code, query, request.sessionUser!) }

  @Get(":code")
  get(@Param("code") code: string, @Req() request: AuthenticatedRequest) { return this.resources.get(code, request.sessionUser!) }

  @Get(":code/availability")
  availabilityByCode(@Param("code") code: string, @Query(new ZodValidationPipe(ResourceAvailabilityByCodeQuerySchema)) query: ResourceAvailabilityByCodeQuery, @Req() request: AuthenticatedRequest) {
    return this.resources.availabilityByCode(code, query, request.sessionUser!)
  }

  @Post()
  create(@Body(new ZodValidationPipe(ResourceCreateSchema)) input: ResourceCreate, @Req() request: AuthenticatedRequest) { return this.resources.create(input, request.sessionUser!, request.requestId) }

  @Patch(":code")
  update(@Param("code") code: string, @Body(new ZodValidationPipe(ResourceUpdateSchema)) input: ResourceUpdate, @Req() request: AuthenticatedRequest) { return this.resources.update(code, input, request.sessionUser!, request.requestId) }

  @Post(":code/archive")
  archive(@Param("code") code: string, @Body(new ZodValidationPipe(ResourceArchiveSchema)) input: ResourceArchive, @Req() request: AuthenticatedRequest) { return this.resources.archive(code, input, request.sessionUser!, request.requestId) }

  @Post("allocations")
  createAllocation(@Body(new ZodValidationPipe(ResourceAllocationCreateSchema)) input: ResourceAllocationCreate, @Req() request: AuthenticatedRequest) { return this.resources.createAllocation(input, request.sessionUser!, request.requestId) }

  @Post("allocations/replace-event")
  @HttpCode(HttpStatus.OK)
  replaceEventAllocations(@Body(new ZodValidationPipe(EventAllocationReplaceSchema)) input: EventAllocationReplace, @Req() request: AuthenticatedRequest) { return this.resources.replaceEventAllocations(input, request.sessionUser!, request.requestId) }

  @Post("allocations/:allocationId/cancel")
  @HttpCode(HttpStatus.OK)
  cancelAllocation(@Param("allocationId") allocationId: string, @Body(new ZodValidationPipe(ResourceAllocationCancelSchema)) input: ResourceAllocationCancel, @Req() request: AuthenticatedRequest) { return this.resources.cancelAllocation(allocationId, input, request.sessionUser!, request.requestId) }

  @Post(":code/blocks")
  createBlock(@Param("code") code: string, @Body(new ZodValidationPipe(ResourceBlockCreateSchema)) input: ResourceBlockCreate, @Req() request: AuthenticatedRequest) { return this.resources.createBlock(code, input, request.sessionUser!, request.requestId) }

  @Post(":code/blocks/:blockId/cancel")
  cancelBlock(@Param("code") code: string, @Param("blockId") blockId: string, @Body(new ZodValidationPipe(ResourceBlockCancelSchema)) input: ResourceBlockCancel, @Req() request: AuthenticatedRequest) { return this.resources.cancelBlock(code, blockId, input, request.sessionUser!, request.requestId) }
}
