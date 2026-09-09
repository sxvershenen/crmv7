import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req } from "@nestjs/common"

import { RequireCapabilities } from "../common/require-capability.decorator.js"

import type { AuthenticatedRequest } from "../common/request-context.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { BookingArchiveSchema, BookingAssignSelfSchema, BookingCreateSchema, BookingIntervalUpdateSchema, BookingLeadLinkInputSchema, BookingLeadUnlinkInputSchema, BookingListQuerySchema, BookingProjectionQuerySchema, BookingTransitionSchema, BookingUpdateSchema, type BookingArchive, type BookingAssignSelf, type BookingCreate, type BookingIntervalUpdate, type BookingLeadLinkInput, type BookingLeadUnlinkInput, type BookingListQuery, type BookingProjectionQuery, type BookingTransition, type BookingUpdate } from "./bookings.contracts.js"
import { BookingsService } from "./bookings.service.js"
import { BookingPromotionPreviewSchema, type BookingPromotionPreview } from "@crm/contracts"

@Controller("bookings")
export class BookingsController {
  constructor(@Inject(BookingsService) private readonly bookings: BookingsService) {}
  @Post("promotion-preview") previewPromotion(@Body(new ZodValidationPipe(BookingPromotionPreviewSchema)) input: BookingPromotionPreview, @Req() request: AuthenticatedRequest) { return this.bookings.previewPromotion(input, request.sessionUser!) }
  @Get() list(@Query(new ZodValidationPipe(BookingListQuerySchema)) query: BookingListQuery, @Req() request: AuthenticatedRequest) { return this.bookings.list(query, request.sessionUser!) }
  @Get("projection") projection(@Query(new ZodValidationPipe(BookingProjectionQuerySchema)) query: BookingProjectionQuery, @Req() request: AuthenticatedRequest) { return this.bookings.projection(query, request.sessionUser!) }
  @Get(":id/lead-link/history") leadLinkHistory(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.bookings.leadLinkHistory(id, request.sessionUser!) }
  @Get(":id") get(@Param("id") id: string, @Req() request: AuthenticatedRequest) { return this.bookings.getDetail(id, request.sessionUser!) }
  @Post() create(@Body(new ZodValidationPipe(BookingCreateSchema)) input: BookingCreate, @Req() request: AuthenticatedRequest) { return this.bookings.create(input, request.sessionUser!, request.requestId) }
  @Patch(":id") update(@Param("id") id: string, @Body(new ZodValidationPipe(BookingUpdateSchema)) input: BookingUpdate, @Req() request: AuthenticatedRequest) { return this.bookings.update(id, input, request.sessionUser!, request.requestId) }
  @Patch(":id/interval") updateInterval(@Param("id") id: string, @Body(new ZodValidationPipe(BookingIntervalUpdateSchema)) input: BookingIntervalUpdate, @Req() request: AuthenticatedRequest) { return this.bookings.updateInterval(id, input, request.sessionUser!, request.requestId) }
  @Post(":id/lead-link") linkLead(@Param("id") id: string, @Body(new ZodValidationPipe(BookingLeadLinkInputSchema)) input: BookingLeadLinkInput, @Req() request: AuthenticatedRequest) { return this.bookings.linkLead(id, input, request.sessionUser!, request.requestId) }
  @Post(":id/lead-link/unlink") unlinkLead(@Param("id") id: string, @Body(new ZodValidationPipe(BookingLeadUnlinkInputSchema)) input: BookingLeadUnlinkInput, @Req() request: AuthenticatedRequest) { return this.bookings.unlinkLead(id, input, request.sessionUser!, request.requestId) }
  @Post(":id/transition") transition(@Param("id") id: string, @Body(new ZodValidationPipe(BookingTransitionSchema)) input: BookingTransition, @Req() request: AuthenticatedRequest) { return this.bookings.transition(id, input, request.sessionUser!, request.requestId) }
  @Post(":id/archive") archive(@Param("id") id: string, @Body(new ZodValidationPipe(BookingArchiveSchema)) input: BookingArchive, @Req() request: AuthenticatedRequest) { return this.bookings.archive(id, input, request.sessionUser!, request.requestId) }
  @Post(":id/assign-self") @RequireCapabilities("canAssign") assignSelf(@Param("id") id: string, @Body(new ZodValidationPipe(BookingAssignSelfSchema)) input: BookingAssignSelf, @Req() request: AuthenticatedRequest) { return this.bookings.assignSelf(id, input, request.sessionUser!, request.requestId) }
}
