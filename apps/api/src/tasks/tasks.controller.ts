import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, Res } from "@nestjs/common"
import type { Response } from "express"

import {
  TaskArchiveSchema,
  TaskAssignSelfSchema,
  TaskCreateSchema,
  TaskListQuerySchema,
  TaskUpdateSchema,
  type TaskArchive,
  type TaskAssignSelf,
  type TaskCreate,
  type TaskListQuery,
  type TaskUpdate,
} from "@crm/contracts"

import type { AuthenticatedRequest } from "../common/request-context.js"
import { RequireCapabilities } from "../common/require-capability.decorator.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { TasksService } from "./tasks.service.js"

@Controller("tasks")
export class TasksController {
  constructor(@Inject(TasksService) private readonly tasksService: TasksService) {}

  @Get()
  @RequireCapabilities("canView")
  async list(
    @Query(new ZodValidationPipe(TaskListQuerySchema)) query: TaskListQuery,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const page = await this.tasksService.list(query, request.sessionUser!)
    if (page.nextCursor) response.setHeader("x-next-cursor", page.nextCursor)
    return page.items
  }

  @Get(":code")
  @RequireCapabilities("canView")
  get(@Param("code") code: string, @Req() request: AuthenticatedRequest) {
    return this.tasksService.get(code, request.sessionUser!)
  }

  @Post()
  @RequireCapabilities("canCreate")
  create(
    @Body(new ZodValidationPipe(TaskCreateSchema)) input: TaskCreate,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tasksService.create(input, request.sessionUser!, request.requestId)
  }

  @Patch(":code")
  @RequireCapabilities("canEdit")
  update(
    @Param("code") code: string,
    @Body(new ZodValidationPipe(TaskUpdateSchema)) input: TaskUpdate,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tasksService.update(code, input, request.sessionUser!, request.requestId)
  }

  @Post(":code/archive")
  @RequireCapabilities("canArchive")
  archive(
    @Param("code") code: string,
    @Body(new ZodValidationPipe(TaskArchiveSchema)) input: TaskArchive,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tasksService.archive(code, input.version, request.sessionUser!, request.requestId)
  }

  @Post(":code/assign-self")
  @RequireCapabilities("canAssign")
  assignSelf(
    @Param("code") code: string,
    @Body(new ZodValidationPipe(TaskAssignSelfSchema)) input: TaskAssignSelf,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tasksService.assignSelf(code, input.version, request.sessionUser!, request.requestId)
  }
}
