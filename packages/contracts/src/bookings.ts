import { z } from "zod";
import { DateSchema, DateTimeSchema, IdSchema, NonNegativeMoneySchema, VersionSchema } from "./primitives.js";
import { IdempotencyKeySchema, MutationMetaSchema, OperationIdSchema } from "./operations.js";
import { CapabilitiesSchema } from "./capabilities.js";

export const BookingStatusSchema = z.enum(["draft", "unconfirmed", "confirmed", "in_progress", "completed", "cancelled", "archived"]);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;
export const BookingItemTypeSchema = z.enum(["accommodation", "bath", "venue", "camping", "program", "service", "other"]);
export type BookingItemType = z.infer<typeof BookingItemTypeSchema>;
export const BookingItemSchema = z.object({
  id: IdSchema, type: BookingItemTypeSchema, resourceId: IdSchema.nullable(),
  startAt: DateTimeSchema, endAt: DateTimeSchema, quantity: z.number().int().positive(),
  price: NonNegativeMoneySchema, discount: NonNegativeMoneySchema, preparationMinutes: z.number().int().nonnegative().max(1440),
}).strict();
export type BookingItem = z.infer<typeof BookingItemSchema>;
export const BookingSchema = z.object({
  id: IdSchema, version: VersionSchema, customerId: IdSchema, status: BookingStatusSchema,
  items: z.array(BookingItemSchema), subtotal: NonNegativeMoneySchema, total: NonNegativeMoneySchema,
  paymentState: z.enum(["unpaid", "partial", "paid", "overpaid", "refund", "debt"]),
  createdAt: DateTimeSchema, updatedAt: DateTimeSchema,
}).strict();
export type Booking = z.infer<typeof BookingSchema>;
export const BookingCapabilitiesSchema = CapabilitiesSchema.pick({ canView: true, canCreate: true, canEdit: true, canArchive: true, canChangeStatus: true, canOverrideConflict: true, canAddPayment: true, canRefund: true }).strict();
export type BookingCapabilities = z.infer<typeof BookingCapabilitiesSchema>;
export const BookingDtoSchema = BookingSchema.extend({ capabilities: BookingCapabilitiesSchema }).strict();
export type BookingDto = z.infer<typeof BookingDtoSchema>;
export const CreateBookingInputSchema = z.object({ customerId: IdSchema, items: z.array(BookingItemSchema.omit({ id: true })).min(1), note: z.string().max(20_000).nullable().default(null) }).strict();
export type CreateBookingInput = z.infer<typeof CreateBookingInputSchema>;
// PATCH must stay sparse: deriving it with `.partial()` from a schema containing
// defaults would turn omitted fields into writes.
export const UpdateBookingInputSchema = z.object({
  expectedVersion: VersionSchema,
  customerId: IdSchema.optional(),
  items: z.array(BookingItemSchema.omit({ id: true })).min(1).optional(),
  note: z.string().max(20_000).nullable().optional(),
  itemId: IdSchema.optional(),
  startAt: DateTimeSchema.optional(),
  endAt: DateTimeSchema.optional(),
  resourceId: IdSchema.nullable().optional(),
}).strict();
export type UpdateBookingInput = z.infer<typeof UpdateBookingInputSchema>;
export const TransitionBookingInputSchema = MutationMetaSchema.extend({ status: BookingStatusSchema }).strict();
export type TransitionBookingInput = z.infer<typeof TransitionBookingInputSchema>;

/** Idempotent transport commands. Domain create/update inputs remain available above. */
export const BookingCreateSchema = CreateBookingInputSchema.extend({ operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema, overrideConflict: z.boolean().default(false) }).strict();
export type BookingCreate = z.infer<typeof BookingCreateSchema>;
export const BookingUpdateSchema = UpdateBookingInputSchema.extend({ operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema, overrideConflict: z.boolean().default(false) }).strict();
export type BookingUpdate = z.infer<typeof BookingUpdateSchema>;
export const BookingTransitionSchema = TransitionBookingInputSchema.extend({ idempotencyKey: IdempotencyKeySchema }).strict();
export type BookingTransition = z.infer<typeof BookingTransitionSchema>;
export const BookingArchiveSchema = z.object({ expectedVersion: VersionSchema, operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema }).strict();
export type BookingArchive = z.infer<typeof BookingArchiveSchema>;
export const BookingListQuerySchema = z.object({ status: BookingStatusSchema.optional(), customerId: IdSchema.optional(), archived: z.preprocess((value) => value === "true" ? true : value === "false" ? false : value, z.boolean()).optional(), limit: z.coerce.number().int().min(1).max(100).default(50), cursor: z.string().min(1).max(2048).optional() }).strict();
export type BookingListQuery = z.infer<typeof BookingListQuerySchema>;
export const BookingResponseSchema = z.object({ data: BookingDtoSchema }).strict();
export type BookingResponse = z.infer<typeof BookingResponseSchema>;
export const BookingListResponseSchema = z.object({ items: z.array(BookingDtoSchema), nextCursor: z.string().nullable() }).strict();
export type BookingListResponse = z.infer<typeof BookingListResponseSchema>;

/**
 * Read model for the operational agenda/scheduler/table. It deliberately keeps
 * lifecycle and payment/conflict state separate: the CRM may render a compact
 * status label, but the server remains the authority for all three values.
 */
export const BookingProjectionCategorySchema = z.enum(["houses", "camping", "tents", "bath", "venues", "other"]);
export type BookingProjectionCategory = z.infer<typeof BookingProjectionCategorySchema>;
export const BookingProjectionStatusSchema = z.enum(["draft", "confirmed", "unpaid", "debt", "paid", "cancelled", "conflict"]);
export type BookingProjectionStatus = z.infer<typeof BookingProjectionStatusSchema>;
export const BookingProjectionSortSchema = z.enum(["id", "client", "arrival", "resource", "status", "total", "assignee"]);
export type BookingProjectionSort = z.infer<typeof BookingProjectionSortSchema>;
export const BookingProjectionAssigneeSchema = z.object({ id: IdSchema, initials: z.string().max(10), name: z.string().min(1).max(200) }).strict();
export const BookingProjectionBookingSchema = z.object({
  id: IdSchema,
  code: z.string().min(1).max(120),
  version: VersionSchema,
  customerId: IdSchema.nullable(),
  clientName: z.string(),
  phone: z.string(),
  resourceId: IdSchema.nullable(),
  resourceName: z.string(),
  category: BookingProjectionCategorySchema,
  date: DateSchema,
  startAt: DateTimeSchema,
  endAt: DateTimeSchema,
  startHour: z.number().int().min(0).max(24),
  endHour: z.number().int().min(0).max(24),
  preparationEndHour: z.number().int().min(0).max(24),
  guestCount: z.number().int().nonnegative(),
  status: BookingProjectionStatusSchema,
  lifecycleStatus: BookingStatusSchema,
  amount: z.number().int().nonnegative(),
  paid: z.number().int().nonnegative(),
  paymentState: BookingSchema.shape.paymentState,
  source: z.string(),
  utm: z.string(),
  promo: z.string(),
  sourceLeadId: IdSchema.nullable(),
  assignees: z.array(BookingProjectionAssigneeSchema).max(20),
  itemId: IdSchema.nullable(),
  hasConflict: z.boolean(),
}).strict();
export type BookingProjectionBooking = z.infer<typeof BookingProjectionBookingSchema>;
export const BookingProjectionOperationSchema = z.object({
  id: z.string().min(1).max(255), bookingId: IdSchema, resourceId: IdSchema,
  kind: z.enum(["arrival", "preparation", "departure", "block"]),
  time: DateTimeSchema, timeLabel: z.string().min(1).max(32), clientName: z.string(), status: BookingProjectionStatusSchema,
}).strict();
export type BookingProjectionOperation = z.infer<typeof BookingProjectionOperationSchema>;
export const BookingProjectionResourceSchema = z.object({ id: IdSchema, code: z.string().min(1).max(120), name: z.string(), category: BookingProjectionCategorySchema, capacity: z.number().int().nonnegative(), occupied: z.number().int().nonnegative() }).strict();
export type BookingProjectionResource = z.infer<typeof BookingProjectionResourceSchema>;
export const BookingProjectionWindowSchema = z.object({ from: DateSchema, to: DateSchema, canAppendBefore: z.boolean(), canAppendAfter: z.boolean() }).strict();
export const BookingProjectionQuerySchema = z.object({
  date: DateSchema,
  rangeEnd: DateSchema,
  category: z.enum(["all", "houses", "camping", "tents", "bath", "venues"]),
  resource: z.union([z.literal("all"), IdSchema]),
  source: z.string().max(120).default("all"),
  amountFrom: z.coerce.number().int().nonnegative().default(0),
  debtFrom: z.coerce.number().int().nonnegative().default(0),
  utm: z.string().max(255).default("all"),
  promo: z.string().max(255).default("all"),
  conflictOnly: z.preprocess((value) => value === "true" || value === "1" ? true : value === "false" || value === "0" ? false : value, z.boolean()).default(false),
  overpayOnly: z.preprocess((value) => value === "true" || value === "1" ? true : value === "false" || value === "0" ? false : value, z.boolean()).default(false),
  sort: BookingProjectionSortSchema.default("arrival"),
  order: z.enum(["asc", "desc"]).default("asc"),
}).strict();
export type BookingProjectionQuery = z.infer<typeof BookingProjectionQuerySchema>;
export const BookingProjectionResponseSchema = z.object({ bookings: z.array(BookingProjectionBookingSchema), operations: z.array(BookingProjectionOperationSchema), resources: z.array(BookingProjectionResourceSchema), window: BookingProjectionWindowSchema }).strict();
export type BookingProjectionResponse = z.infer<typeof BookingProjectionResponseSchema>;

export const BookingLeadLinkMethodSchema = z.enum(["manual", "from_lead"]);
export type BookingLeadLinkMethod = z.infer<typeof BookingLeadLinkMethodSchema>;
export const BookingLeadLinkSchema = z.object({
  id: IdSchema,
  bookingId: IdSchema,
  leadId: IdSchema,
  method: BookingLeadLinkMethodSchema,
  linkedAt: DateTimeSchema,
  linkedBy: IdSchema.nullable(),
  unlinkedAt: DateTimeSchema.nullable(),
  unlinkedBy: IdSchema.nullable(),
}).strict();
export type BookingLeadLink = z.infer<typeof BookingLeadLinkSchema>;
export const BookingLeadLinkInputSchema = z.object({
  leadId: IdSchema,
  method: BookingLeadLinkMethodSchema.default("manual"),
  expectedVersion: VersionSchema,
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
}).strict();
export type BookingLeadLinkInput = z.infer<typeof BookingLeadLinkInputSchema>;
export const BookingLeadUnlinkInputSchema = z.object({
  expectedVersion: VersionSchema,
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
}).strict();
export type BookingLeadUnlinkInput = z.infer<typeof BookingLeadUnlinkInputSchema>;
export const BookingLeadLinkResponseSchema = z.object({ link: BookingLeadLinkSchema.nullable(), bookingVersion: VersionSchema }).strict();
export type BookingLeadLinkResponse = z.infer<typeof BookingLeadLinkResponseSchema>;
export const BookingLeadLinkHistoryResponseSchema = z.object({ items: z.array(BookingLeadLinkSchema) }).strict();
export type BookingLeadLinkHistoryResponse = z.infer<typeof BookingLeadLinkHistoryResponseSchema>;

export const BookingCustomerSummarySchema = z.object({ id: IdSchema, name: z.string(), phone: z.string().nullable(), email: z.string().nullable() }).strict();
export const BookingResourceSummarySchema = z.object({ id: IdSchema, code: z.string(), name: z.string(), category: BookingProjectionCategorySchema, capacity: z.number().int().nonnegative() }).strict();
export const BookingPaymentSummarySchema = z.object({ id: IdSchema, operationId: IdSchema, kind: z.enum(["charge", "refund", "adjustment", "payment"]), amount: z.number().int().positive(), currency: z.string().length(3), method: z.string(), sourcePaymentId: IdSchema.nullable(), reason: z.string(), createdAt: DateTimeSchema, createdBy: IdSchema.nullable() }).strict();
export const BookingDetailResponseSchema = BookingProjectionBookingSchema.extend({
  customer: BookingCustomerSummarySchema.nullable(),
  resource: BookingResourceSummarySchema.nullable(),
  items: z.array(BookingItemSchema),
  payments: z.array(BookingPaymentSummarySchema),
  note: z.string().nullable(),
  comments: z.array(z.unknown()),
  marketing: z.record(z.string(), z.unknown()),
  leadLink: BookingLeadLinkSchema.nullable(),
}).strict();
export type BookingDetailResponse = z.infer<typeof BookingDetailResponseSchema>;

/** Sparse DnD/resize command. `items` is intentionally not required here. */
export const BookingIntervalUpdateSchema = z.object({
  expectedVersion: VersionSchema,
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  itemId: IdSchema,
  startAt: DateTimeSchema,
  endAt: DateTimeSchema,
  resourceId: IdSchema.nullable(),
  overrideConflict: z.boolean().default(false),
}).strict();
export type BookingIntervalUpdate = z.infer<typeof BookingIntervalUpdateSchema>;
