import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req } from "@nestjs/common"

import { SavedViewArchiveSchema, SavedViewCreateSchema, SavedViewUpdateSchema, type SavedViewArchive, type SavedViewCreate, type SavedViewUpdate } from "@crm/contracts"

import type { AuthenticatedRequest } from "../common/request-context.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { SavedViewsService } from "./saved-views.service.js"

@Controller("saved-views")
export class SavedViewsController {
  constructor(@Inject(SavedViewsService) private readonly savedViews: SavedViewsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query("entityType") entityType?: string) {
    return this.savedViews.list(request.sessionUser!, entityType)
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(SavedViewCreateSchema)) input: SavedViewCreate,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.savedViews.create(input, request.sessionUser!, request.requestId)
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(SavedViewUpdateSchema)) input: SavedViewUpdate,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.savedViews.update(id, input, request.sessionUser!, request.requestId)
  }

  @Delete(":id")
  archive(
    @Param("id") id: string,
    @Query(new ZodValidationPipe(SavedViewArchiveSchema)) input: SavedViewArchive,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.savedViews.archive(id, input.version, request.sessionUser!, request.requestId)
  }
}
