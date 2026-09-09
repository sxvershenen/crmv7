import { Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Query, Req } from "@nestjs/common"

import { NotificationListQuerySchema, type NotificationListQuery } from "@crm/contracts"

import type { AuthenticatedRequest } from "../common/request-context.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { NotificationsService } from "./notifications.service.js"

@Controller("notifications")
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(NotificationListQuerySchema)) query: NotificationListQuery,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.notifications.list(query, request.sessionUser!)
  }

  @Post(":id/read")
  @HttpCode(HttpStatus.OK)
  markRead(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.notifications.markRead(id, request.sessionUser!)
  }

  @Post("read-all")
  @HttpCode(HttpStatus.OK)
  markAllRead(@Req() request: AuthenticatedRequest) {
    return this.notifications.markAllRead(request.sessionUser!)
  }
}
