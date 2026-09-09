import { z } from "zod"

import { DateTimeSchema, IdSchema } from "./primitives.js"

export const NotificationTypeSchema = z.enum([
  "new_lead",
  "conflict",
  "other_user_change",
  "booking_cancelled",
  "overdue_task",
  "insufficient_payment",
  "assignee_change",
  "resource_move",
  "capacity_exceeded",
  "unblocked",
])
export type NotificationType = z.infer<typeof NotificationTypeSchema>

export const NotificationDtoSchema = z.object({
  id: IdSchema,
  type: NotificationTypeSchema,
  title: z.string().min(1).max(240),
  description: z.string().max(500).nullable(),
  entityType: z.string().min(1).max(64),
  entityId: IdSchema,
  href: z.string().startsWith("/").max(500),
  occurredAt: DateTimeSchema,
  readAt: DateTimeSchema.nullable(),
}).strict()
export type NotificationDto = z.infer<typeof NotificationDtoSchema>

export const NotificationListSchema = z.object({
  items: z.array(NotificationDtoSchema),
  unreadCount: z.number().int().nonnegative(),
}).strict()
export type NotificationList = z.infer<typeof NotificationListSchema>

export const NotificationListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
}).strict()
export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>

export const NotificationMutationResultSchema = z.object({ ok: z.literal(true) }).strict()
export type NotificationMutationResult = z.infer<typeof NotificationMutationResultSchema>
