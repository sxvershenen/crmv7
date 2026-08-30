import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req } from "@nestjs/common"

import type { AuthenticatedRequest } from "../common/request-context.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { BookingArchiveSchema, BookingCreateSchema, BookingIntervalUpdateSchema, BookingListQuerySchema, BookingProjectionQuerySchema, BookingTransitionSchema, BookingUpdateSchema, type BookingArchive, type BookingCreate, type BookingIntervalUpdate, type BookingListQuery, type BookingProjectionQuery, type BookingTransition, type BookingUpdate } from "./bookings.contracts.js"
import { BookingsService } from "./bookings.service.js"

@Controller("bookings")
export class BookingsController {
  constructor(@Inject(BookingsService) private readonly bookings: BookingsService) {}
  @Get() list(@Query(new ZodValidationPipe(BookingListQuerySchema)) query: BookingListQuery, @Req() request: AuthenticatedRequest) { return this.bookings.list(query, request.sessionUser!) }
  @Get("projection") projection(@Query(new ZodValidationPipe(BookingProjectionQuerySchema)) query: BookingProjectionQuery, @Req() request: AuthenticatedRequest) { return this.bookings.projection(query, request.sessionUser!) }
  @Get(":id") get(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.bookings.getDetail(id, request.sessionUser!) }
  @Post() create(@Body(new ZodValidationPipe(BookingCreateSchema)) input: BookingCreate, @Req() request: AuthenticatedRequest) { return this.bookings.create(input, request.sessionUser!, request.requestId) }
  @Patch(":id") update(@Param("id") id: string, @Body(new ZodValidationPipe(BookingUpdateSchema)) input: BookingUpdate, @Req() request: AuthenticatedRequest) { return this.bookings.update(id, input, request.sessionUser!, request.requestId) }
  @Patch(":id/interval") updateInterval(@Param("id") id: string, @Body(new ZodValidationPipe(BookingIntervalUpdateSchema)) input: BookingIntervalUpdate, @Req() request: AuthenticatedRequest) { return this.bookings.updateInterval(id, input, request.sessionUser!, request.requestId) }
  @Post(":id/transition") transition(@Param("id") id: string, @Body(new ZodValidationPipe(BookingTransitionSchema)) input: BookingTransition, @Req() request: AuthenticatedRequest) { return this.bookings.transition(id, input, request.sessionUser!, request.requestId) }
  @Post(":id/archive") archive(@Param("id") id: string, @Body(new ZodValidationPipe(BookingArchiveSchema)) input: BookingArchive, @Req() request: AuthenticatedRequest) { return this.bookings.archive(id, input, request.sessionUser!, request.requestId) }
}
