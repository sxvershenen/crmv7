import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
  VersionColumn,
} from "typeorm"

export type StoredAssignee = { id: string; initials: string; name: string }

abstract class MutableEntity {
  @PrimaryColumn({ type: "uuid" })
  id!: string

  @VersionColumn()
  version!: number

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date

  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdBy!: string | null

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date

  @Column({ name: "updated_by", type: "uuid", nullable: true })
  updatedBy!: string | null

  @Column({ name: "archived_at", type: "timestamptz", nullable: true })
  archivedAt!: Date | null
}

@Entity({ name: "users" })
@Unique("users_email_unique", ["email"])
export class UserEntity extends MutableEntity {
  @Column({ type: "text" })
  email!: string

  @Column({ name: "display_name", type: "text" })
  displayName!: string

  @Column({ name: "password_hash", type: "text" })
  passwordHash!: string

  @Column({ type: "text" })
  role!: string

  @Column({ type: "text", default: "active" })
  status!: string

  @Column({ type: "text", default: "" })
  phone!: string

  @Column({ type: "text", default: "Europe/Moscow" })
  timezone!: string

  @Column({ type: "text", default: "ru" })
  language!: string

  @Column({ name: "browser_notifications", type: "boolean", default: true })
  browserNotifications!: boolean

  @Column({ name: "email_notifications", type: "boolean", default: false })
  emailNotifications!: boolean

  @Column({ name: "telegram_notifications", type: "boolean", default: false })
  telegramNotifications!: boolean

  @Column({ name: "notify_conflicts", type: "boolean", default: true })
  notifyConflicts!: boolean

  @Column({ name: "notify_new_leads", type: "boolean", default: true })
  notifyNewLeads!: boolean

  @Column({ name: "notify_overdue_tasks", type: "boolean", default: true })
  notifyOverdueTasks!: boolean
}

@Entity({ name: "workspace_settings" })
export class WorkspaceSettingsEntity extends MutableEntity {
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  organization!: Record<string, unknown>

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  operations!: Record<string, unknown>

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  site!: Record<string, unknown>

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  integrations!: Array<Record<string, unknown>>

  @Column({ name: "staff_configuration", type: "jsonb", default: () => "'{}'::jsonb" })
  staffConfiguration!: Record<string, unknown>
}

@Entity({ name: "sessions" })
@Index("sessions_expires_at_idx", ["expiresAt"])
export class SessionEntity {
  @PrimaryColumn({ type: "uuid" })
  id!: string

  @Column({ name: "user_id", type: "uuid" })
  userId!: string

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt!: Date

  @Column({ name: "last_seen_at", type: "timestamptz" })
  lastSeenAt!: Date

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date
}

@Entity({ name: "customers" })
@Index("customers_name_idx", ["name"])
export class CustomerEntity extends MutableEntity {
  @Column({ type: "text" })
  type!: string

  @Column({ type: "text" })
  name!: string

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  phones!: string[]

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  channels!: string[]

  @Column({ type: "text", nullable: true })
  email!: string | null

  @Column({ type: "text", default: "" })
  notes!: string

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  consent!: Record<string, unknown>

  @Column({ name: "duplicate_risk", type: "text", default: "none" })
  duplicateRisk!: string

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  assignees!: StoredAssignee[]

  @Column({ name: "lead_count", type: "integer", default: 0 })
  leadCount!: number

  @Column({ name: "active_lead_count", type: "integer", default: 0 })
  activeLeadCount!: number

  @Column({ name: "booking_count", type: "integer", default: 0 })
  bookingCount!: number

  @Column({ name: "future_booking_count", type: "integer", default: 0 })
  futureBookingCount!: number

  @Column({ name: "task_count", type: "integer", default: 0 })
  taskCount!: number

  @Column({ type: "integer", default: 0 })
  turnover!: number

  @Column({ type: "integer", default: 0 })
  debt!: number

  @Column({ name: "next_contact_at", type: "timestamptz", nullable: true })
  nextContactAt!: Date | null

  @Column({ name: "last_visit_at", type: "timestamptz", nullable: true })
  lastVisitAt!: Date | null
}

@Entity({ name: "leads" })
@Index("leads_status_idx", ["status"])
@Index("leads_customer_idx", ["customerId"])
export class LeadEntity extends MutableEntity {
  @Column({ name: "customer_id", type: "uuid", nullable: true })
  customerId!: string | null

  @Column({ type: "text" })
  name!: string

  @Column({ type: "text", nullable: true })
  phone!: string | null

  @Column({ type: "text", nullable: true })
  channel!: string | null

  @Column({ type: "text", nullable: true })
  direction!: string | null

  @Column({ name: "requested_item", type: "text", nullable: true })
  requestedItem!: string | null

  @Column({ name: "desired_start_at", type: "timestamptz", nullable: true })
  desiredStartAt!: Date | null

  @Column({ name: "desired_end_at", type: "timestamptz", nullable: true })
  desiredEndAt!: Date | null

  @Column({ name: "guest_count", type: "integer", default: 0 })
  guestCount!: number

  @Column({ type: "text", default: "" })
  comment!: string

  @Column({ type: "text", nullable: true })
  source!: string | null

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  utm!: Record<string, string>

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  assignees!: StoredAssignee[]

  @Column({ name: "next_contact_at", type: "timestamptz", nullable: true })
  nextContactAt!: Date | null

  @Column({ type: "text", default: "new" })
  status!: string
}

@Entity({ name: "tasks" })
@Unique("tasks_code_unique", ["code"])
@Index("tasks_due_at_idx", ["dueAt"])
export class TaskEntity extends MutableEntity {
  @Column({ type: "text" })
  code!: string

  @Column({ type: "text" })
  title!: string

  @Column({ type: "text", default: "" })
  details!: string

  @Column({ type: "text", default: "todo" })
  status!: string

  @Column({ type: "text", default: "normal" })
  priority!: string

  @Column({ name: "due_at", type: "timestamptz", nullable: true })
  dueAt!: Date | null

  @Column({ name: "reminder_minutes", type: "integer", nullable: true })
  reminderMinutes!: number | null

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  relation!: Record<string, unknown>

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  assignees!: StoredAssignee[]

  @Column({ name: "comment_count", type: "integer", default: 0 })
  commentCount!: number

  @Column({ name: "latest_comment", type: "text", nullable: true })
  latestComment!: string | null

  @Column({ type: "boolean", default: false })
  blocked!: boolean
}

@Entity({ name: "resources" })
@Unique("resources_code_unique", ["code"])
export class ResourceEntity extends MutableEntity {
  @Column({ type: "text" })
  code!: string

  @Column({ type: "text" })
  kind!: string

  @Column({ type: "text" })
  name!: string

  @Column({ name: "capacity_mode", type: "text" })
  capacityMode!: string

  @Column({ name: "capacity_total", type: "integer" })
  capacityTotal!: number

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  settings!: Record<string, unknown>
}

@Entity({ name: "program_templates" })
@Unique("program_templates_code_unique", ["code"])
export class ProgramTemplateEntity extends MutableEntity {
  @Column({ type: "text" }) code!: string
  @Column({ type: "text" }) name!: string
  @Column({ name: "category_id", type: "uuid", nullable: true }) categoryId!: string | null
  @Column({ name: "duration_minutes", type: "integer" }) durationMinutes!: number
  @Column({ name: "minimum_participants", type: "integer", nullable: true }) minimumParticipants!: number | null
  @Column({ name: "participant_limit", type: "integer" }) participantLimit!: number
  @Column({ name: "registration_close_hours", type: "numeric", nullable: true }) registrationCloseHours!: number | null
  @Column({ name: "base_price_amount", type: "integer" }) basePriceAmount!: number
  @Column({ name: "currency", type: "text", default: "RUB" }) currency!: string
  @Column({ type: "text", default: "" }) description!: string
  @Column({ type: "text", default: "draft" }) publication!: string
  @Column({ name: "assignee_ids", type: "jsonb", default: () => "'[]'::jsonb" }) assigneeIds!: string[]
  @Column({ type: "jsonb", default: () => "'[]'::jsonb" }) stages!: Array<Record<string, unknown>>
}

@Entity({ name: "program_categories" })
@Index("program_categories_name_idx", ["name"])
export class ProgramCategoryEntity extends MutableEntity {
  @Column({ type: "text" }) name!: string
  @Column({ type: "text", default: "" }) description!: string
  @Column({ type: "text" }) icon!: string
  @Column({ type: "text" }) tone!: string
}

@Entity({ name: "program_occurrences" })
@Unique("program_occurrences_code_unique", ["code"])
@Index("program_occurrences_template_idx", ["templateId", "startsAt"])
export class ProgramOccurrenceEntity extends MutableEntity {
  @Column({ type: "text" }) code!: string
  @Column({ name: "template_id", type: "uuid" }) templateId!: string
  @Column({ type: "text" }) name!: string
  @Column({ name: "starts_at", type: "timestamptz" }) startsAt!: Date
  @Column({ name: "ends_at", type: "timestamptz" }) endsAt!: Date
  @Column({ name: "participant_limit", type: "integer" }) participantLimit!: number
  @Column({ name: "registration_limit", type: "integer" }) registrationLimit!: number
  @Column({ type: "text", default: "draft" }) status!: string
  @Column({ type: "text", default: "RUB" }) currency!: string
  @Column({ type: "text", default: "" }) comment!: string
  @Column({ name: "assignee_ids", type: "jsonb", default: () => "'[]'::jsonb" }) assigneeIds!: string[]
  @Column({ name: "rate_plan_override_id", type: "uuid", nullable: true }) ratePlanOverrideId!: string | null
}

@Entity({ name: "program_registrations" })
@Unique("program_registrations_code_unique", ["code"])
@Index("program_registrations_occurrence_idx", ["occurrenceId", "createdAt"])
export class ProgramRegistrationEntity extends MutableEntity {
  @Column({ type: "text" }) code!: string
  @Column({ name: "occurrence_id", type: "uuid" }) occurrenceId!: string
  @Column({ name: "customer_id", type: "uuid", nullable: true }) customerId!: string | null
  @Column({ type: "text", default: "" }) phone!: string
  @Column({ name: "participant_count", type: "integer" }) participantCount!: number
  @Column({ name: "participant_names", type: "text", default: "" }) participantNames!: string
  @Column({ name: "total_amount", type: "integer" }) totalAmount!: number
  @Column({ name: "discount_amount", type: "integer", default: 0 }) discountAmount!: number
  @Column({ name: "paid_amount", type: "integer", default: 0 }) paidAmount!: number
  @Column({ type: "text", default: "RUB" }) currency!: string
  @Column({ name: "pricing_mode", type: "text", default: "legacy_unpriced" }) pricingMode!: string
  @Column({ type: "text", default: "new" }) status!: string
  @Column({ type: "text", default: "" }) promo!: string
  @Column({ type: "text", default: "" }) source!: string
  @Column({ type: "text", default: "" }) comment!: string
}

@Entity({ name: "events" })
@Unique("events_code_unique", ["code"])
@Index("events_schedule_idx", ["startsAt", "endsAt"])
export class EventEntity extends MutableEntity {
  @Column({ type: "text" }) code!: string
  @Column({ type: "text" }) name!: string
  @Column({ name: "category_id", type: "uuid", nullable: true }) categoryId!: string | null
  @Column({ name: "customer_id", type: "uuid", nullable: true }) customerId!: string | null
  @Column({ type: "text", default: "" }) phone!: string
  @Column({ name: "starts_at", type: "timestamptz" }) startsAt!: Date
  @Column({ name: "ends_at", type: "timestamptz" }) endsAt!: Date
  @Column({ name: "guest_count", type: "integer", default: 0 }) guestCount!: number
  @Column({ name: "total_amount", type: "integer", default: 0 }) totalAmount!: number
  @Column({ name: "paid_amount", type: "integer", default: 0 }) paidAmount!: number
  @Column({ type: "text", default: "RUB" }) currency!: string
  @Column({ type: "text", default: "inquiry" }) status!: string
  @Column({ type: "text", default: "" }) comment!: string
  @Column({ name: "requires_action", type: "boolean", default: false }) requiresAction!: boolean
  @Column({ name: "assignee_ids", type: "jsonb", default: () => "'[]'::jsonb" }) assigneeIds!: string[]
  @Column({ type: "jsonb", default: () => "'[]'::jsonb" }) scenario!: Array<Record<string, unknown>>
}

@Entity({ name: "event_categories" })
@Index("event_categories_name_idx", ["name"])
export class EventCategoryEntity extends MutableEntity {
  @Column({ type: "text" }) name!: string
  @Column({ type: "text", default: "" }) description!: string
  @Column({ type: "text" }) icon!: string
  @Column({ type: "text" }) tone!: string
}

@Entity({ name: "bookings" })
@Unique("bookings_code_unique", ["code"])
export class BookingEntity extends MutableEntity {
  @Column({ type: "text" })
  code!: string

  @Column({ name: "customer_id", type: "uuid", nullable: true })
  customerId!: string | null

  @Column({ type: "text", default: "draft" })
  status!: string

  @Column({ name: "currency", type: "text", default: "RUB" })
  currency!: string

  @Column({ name: "total_amount", type: "integer", default: 0 })
  totalAmount!: number

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  snapshot!: Record<string, unknown>
}

/** Operational promotion rules. The code is duplicated from terms for a
 * normalized unique lookup; the database constraint keeps the two in sync. */
@Entity({ name: "promotions" })
@Unique("promotions_code_unique", ["code"])
export class PromotionEntity extends MutableEntity {
  @Column({ type: "text" })
  code!: string

  @Column({ type: "jsonb" })
  terms!: Record<string, unknown>
}

/** Immutable history of the authoritative booking-to-lead relation. */
@Entity({ name: "booking_lead_links" })
@Index("booking_lead_links_booking_active_idx", ["bookingId", "unlinkedAt"])
@Index("booking_lead_links_lead_idx", ["leadId", "linkedAt"])
export class BookingLeadLinkEntity {
  @PrimaryColumn({ type: "uuid" })
  id!: string

  @Column({ name: "booking_id", type: "uuid" })
  bookingId!: string

  @Column({ name: "lead_id", type: "uuid" })
  leadId!: string

  @Column({ type: "text" })
  method!: string

  @Column({ name: "linked_at", type: "timestamptz" })
  linkedAt!: Date

  @Column({ name: "linked_by", type: "uuid", nullable: true })
  linkedBy!: string | null

  @Column({ name: "unlinked_at", type: "timestamptz", nullable: true })
  unlinkedAt!: Date | null

  @Column({ name: "unlinked_by", type: "uuid", nullable: true })
  unlinkedBy!: string | null
}

@Entity({ name: "booking_items" })
@Index("booking_items_booking_idx", ["bookingId"])
@Index("booking_items_resource_interval_idx", ["resourceId", "startAt", "endAt"])
@Check("booking_items_interval_check", '"start_at" < "end_at"')
@Check("booking_items_amount_check", '"price_amount" >= 0 AND "discount_amount" >= 0 AND "discount_amount" <= "price_amount"')
export class BookingItemEntity extends MutableEntity {
  @Column({ name: "booking_id", type: "uuid" })
  bookingId!: string

  @Column({ type: "text" })
  type!: string

  @Column({ name: "resource_id", type: "uuid", nullable: true })
  resourceId!: string | null

  @Column({ name: "start_at", type: "timestamptz" })
  startAt!: Date

  @Column({ name: "end_at", type: "timestamptz" })
  endAt!: Date

  @Column({ type: "integer" })
  quantity!: number

  @Column({ name: "price_amount", type: "integer" })
  priceAmount!: number

  @Column({ name: "discount_amount", type: "integer" })
  discountAmount!: number

  @Column({ type: "text" })
  currency!: string

  @Column({ name: "preparation_minutes", type: "integer", default: 0 })
  preparationMinutes!: number

  @Column({ name: "quote_snapshot_id", type: "uuid", nullable: true })
  quoteSnapshotId!: string | null

  @Column({ name: "addon_selections", type: "jsonb", default: () => "'[]'::jsonb" })
  addOnSelections!: Array<{
    assignmentId: string
    addOnOfferingId: string
    label: string
    serviceType: "quantity_service" | "person_service"
    quantity: number
    price: { amountMinor: number; currency: string }
  }>
}

@Entity({ name: "resource_allocations" })
@Check("resource_allocations_interval_check", '"start_at" < "end_at"')
@Index("resource_allocations_resource_interval_idx", ["resourceId", "startAt", "endAt"])
export class ResourceAllocationEntity extends MutableEntity {
  @Column({ name: "resource_id", type: "uuid" })
  resourceId!: string

  @Column({ name: "source_type", type: "text" })
  sourceType!: string

  @Column({ name: "source_id", type: "uuid" })
  sourceId!: string

  @Column({ name: "start_at", type: "timestamptz" })
  startAt!: Date

  @Column({ name: "end_at", type: "timestamptz" })
  endAt!: Date

  @Column({ type: "integer", default: 1 })
  quantity!: number

  @Column({ name: "capacity_impact", type: "integer", default: 1 })
  capacityImpact!: number

  @Column({ type: "boolean", default: true })
  exclusive!: boolean

  @Column({ type: "text", default: "active" })
  status!: string
}

@Entity({ name: "payments" })
@Unique("payments_operation_id_unique", ["operationId"])
@Check("payments_amount_positive", "amount > 0")
export class PaymentEntity {
  @PrimaryColumn({ type: "uuid" })
  id!: string

  @Column({ name: "operation_id", type: "uuid" })
  operationId!: string

  @Column({ name: "booking_id", type: "uuid", nullable: true })
  bookingId!: string | null

  @Column({ name: "event_id", type: "uuid", nullable: true })
  eventId!: string | null

  @Column({ name: "program_registration_id", type: "uuid", nullable: true })
  programRegistrationId!: string | null

  @Column({ type: "text" })
  kind!: string

  @Column({ type: "integer" })
  amount!: number

  @Column({ type: "text", default: "RUB" })
  currency!: string

  @Column({ type: "text" })
  method!: string

  @Column({ name: "source_payment_id", type: "uuid", nullable: true })
  sourcePaymentId!: string | null

  @Column({ type: "text", default: "" })
  reason!: string

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date

  @Column({ name: "created_by", type: "uuid" })
  createdBy!: string
}

@Entity({ name: "saved_views" })
@Unique("saved_views_owner_name_unique", ["ownerId", "entityType", "name"])
export class SavedViewEntity extends MutableEntity {
  @Column({ name: "owner_id", type: "uuid" })
  ownerId!: string

  @Column({ name: "entity_type", type: "text" })
  entityType!: string

  @Column({ type: "text" })
  name!: string

  @Column({ type: "jsonb" })
  definition!: Record<string, unknown>

  @Column({ name: "is_default", type: "boolean", default: false })
  isDefault!: boolean
}

@Entity({ name: "idempotency_keys" })
@Unique("idempotency_scope_operation_unique", ["scope", "operationId"])
export class IdempotencyKeyEntity {
  @PrimaryColumn({ type: "uuid" })
  id!: string

  @Column({ type: "text" })
  scope!: string

  @Column({ name: "operation_id", type: "uuid" })
  operationId!: string

  @Column({ name: "idempotency_key", type: "text" })
  idempotencyKey!: string

  @Column({ name: "request_hash", type: "text" })
  requestHash!: string

  @Column({ name: "response_status", type: "integer", nullable: true })
  responseStatus!: number | null

  @Column({ name: "response_body", type: "jsonb", nullable: true })
  responseBody!: Record<string, unknown> | null

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date
}

@Entity({ name: "change_log" })
@Index("change_log_entity_idx", ["entityType", "entityId", "createdAt"])
export class ChangeLogEntity {
  @PrimaryColumn({ type: "uuid" })
  id!: string

  @Column({ name: "entity_type", type: "text" })
  entityType!: string

  @Column({ name: "entity_id", type: "uuid" })
  entityId!: string

  @Column({ type: "text" })
  action!: string

  @Column({ name: "actor_id", type: "uuid", nullable: true })
  actorId!: string | null

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  changes!: Record<string, unknown>

  @Column({ name: "request_id", type: "text" })
  requestId!: string

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date
}

@Entity({ name: "outbox_events" })
@Index("outbox_pending_idx", ["availableAt", "processedAt"])
export class OutboxEventEntity {
  @PrimaryColumn({ type: "uuid" })
  id!: string

  @Column({ type: "text" })
  topic!: string

  @Column({ name: "aggregate_type", type: "text" })
  aggregateType!: string

  @Column({ name: "aggregate_id", type: "uuid" })
  aggregateId!: string

  @Column({ type: "jsonb" })
  payload!: Record<string, unknown>

  @Column({ name: "available_at", type: "timestamptz" })
  availableAt!: Date

  @Column({ name: "processed_at", type: "timestamptz", nullable: true })
  processedAt!: Date | null

  @Column({ type: "integer", default: 0 })
  attempts!: number

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date
}

@Entity({ name: "outbox_deliveries" })
@Index("outbox_deliveries_ready_idx", ["consumer", "availableAt", "eventId"], { where: "status IN ('pending','failed')" })
@Index("outbox_deliveries_lease_expiry_idx", ["consumer", "leaseExpiresAt", "eventId"], { where: "status = 'processing'" })
@Index("outbox_deliveries_dead_letter_idx", ["consumer", "deadLetteredAt", "eventId"], { where: "status = 'dead_letter'" })
@Index("outbox_deliveries_event_status_idx", ["eventId", "status"])
export class OutboxDeliveryEntity {
  @PrimaryColumn({ name: "event_id", type: "uuid" })
  eventId!: string

  @PrimaryColumn({ type: "text" })
  consumer!: string

  @Column({ type: "text", default: "pending" })
  status!: string

  @Column({ type: "integer", default: 0 })
  attempts!: number

  @Column({ name: "delivery_epoch", type: "integer", default: 1 })
  deliveryEpoch!: number

  @Column({ name: "replay_count", type: "integer", default: 0 })
  replayCount!: number

  @Column({ name: "max_attempts", type: "smallint", default: 8 })
  maxAttempts!: number

  @Column({ name: "available_at", type: "timestamptz" })
  availableAt!: Date

  @Column({ name: "processed_at", type: "timestamptz", nullable: true })
  processedAt!: Date | null

  @Column({ name: "last_error", type: "text", nullable: true })
  lastError!: string | null

  @Column({ name: "lease_token", type: "uuid", nullable: true })
  leaseToken!: string | null

  @Column({ name: "lease_owner", type: "text", nullable: true })
  leaseOwner!: string | null

  @Column({ name: "lease_acquired_at", type: "timestamptz", nullable: true })
  leaseAcquiredAt!: Date | null

  @Column({ name: "lease_expires_at", type: "timestamptz", nullable: true })
  leaseExpiresAt!: Date | null

  @Column({ name: "last_attempt_at", type: "timestamptz", nullable: true })
  lastAttemptAt!: Date | null

  @Column({ name: "last_failure_at", type: "timestamptz", nullable: true })
  lastFailureAt!: Date | null

  @Column({ name: "last_error_code", type: "text", nullable: true })
  lastErrorCode!: string | null

  @Column({ name: "dead_lettered_at", type: "timestamptz", nullable: true })
  deadLetteredAt!: Date | null

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date
}

@Entity({ name: "outbox_delivery_attempts" })
@Index("outbox_delivery_attempts_delivery_idx", ["eventId", "consumer", "deliveryEpoch", "attempt"])
export class OutboxDeliveryAttemptEntity {
  @PrimaryColumn({ name: "event_id", type: "uuid" }) eventId!: string
  @PrimaryColumn({ type: "text" }) consumer!: string
  @PrimaryColumn({ name: "delivery_epoch", type: "integer" }) deliveryEpoch!: number
  @PrimaryColumn({ type: "integer" }) attempt!: number
  @Column({ name: "lease_token", type: "uuid" }) leaseToken!: string
  @Column({ type: "text" }) outcome!: string
  @Column({ name: "error_code", type: "text", nullable: true }) errorCode!: string | null
  @Column({ name: "attempted_at", type: "timestamptz" }) attemptedAt!: Date
  @Column({ name: "completed_at", type: "timestamptz" }) completedAt!: Date
  @Column({ name: "next_available_at", type: "timestamptz", nullable: true }) nextAvailableAt!: Date | null
}

@Entity({ name: "outbox_delivery_replays" })
@Index("outbox_delivery_replays_delivery_idx", ["eventId", "consumer", "replayedAt"])
export class OutboxDeliveryReplayEntity {
  @PrimaryColumn({ type: "uuid" }) id!: string
  @Column({ name: "event_id", type: "uuid" }) eventId!: string
  @Column({ type: "text" }) consumer!: string
  @Column({ name: "previous_delivery_epoch", type: "integer" }) previousDeliveryEpoch!: number
  @Column({ name: "previous_attempts", type: "integer" }) previousAttempts!: number
  @Column({ name: "operation_id", type: "uuid" }) operationId!: string
  @Column({ name: "request_id", type: "text" }) requestId!: string
  @Column({ type: "text" }) reason!: string
  @Column({ name: "replayed_by", type: "uuid", nullable: true }) replayedBy!: string | null
  @CreateDateColumn({ name: "replayed_at", type: "timestamptz" }) replayedAt!: Date
}

@Entity({ name: "public_offering_projection_state" })
@Index("public_offering_projection_state_invalidated_idx", ["invalidatedAt"])
export class PublicOfferingProjectionStateEntity {
  @PrimaryColumn({ name: "offering_id", type: "uuid" }) offeringId!: string
  @Column({ type: "integer" }) generation!: number
  @Column({ name: "last_invalidation_event_id", type: "uuid" }) lastInvalidationEventId!: string
  @Column({ name: "invalidated_at", type: "timestamptz" }) invalidatedAt!: Date
  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" }) updatedAt!: Date
}

@Entity({ name: "public_offering_projection_invalidation_receipts" })
@Index("public_offering_projection_receipts_offering_idx", ["offeringId", "appliedAt"])
@Unique("public_offering_projection_receipts_generation_unique", ["offeringId", "generation"])
export class PublicOfferingProjectionInvalidationReceiptEntity {
  @PrimaryColumn({ name: "event_id", type: "uuid" }) eventId!: string
  @Column({ name: "offering_id", type: "uuid" }) offeringId!: string
  @Column({ name: "delivery_consumer", type: "text", default: "public_projection" }) deliveryConsumer!: string
  @Column({ name: "delivery_epoch", type: "integer" }) deliveryEpoch!: number
  @Column({ name: "delivery_attempt", type: "integer" }) deliveryAttempt!: number
  @Column({ type: "integer" }) generation!: number
  @Column({ name: "cache_tags", type: "text", array: true }) cacheTags!: string[]
  @Column({ name: "tags_hash", type: "text" }) tagsHash!: string
  @Column({ name: "applied_at", type: "timestamptz" }) appliedAt!: Date
  @Column({ type: "text" }) effect!: string
  @Column({ name: "last_effect_at", type: "timestamptz", nullable: true }) lastEffectAt!: Date | null
  @Column({ name: "effect_attempts", type: "integer", default: 0 }) effectAttempts!: number
  @Column({ name: "provider_code", type: "text", nullable: true }) providerCode!: string | null
  @Column({ name: "provider_request_id", type: "text", nullable: true }) providerRequestId!: string | null
}

@Entity({ name: "cms_nodes" })
@Index("cms_nodes_kind_status_idx", ["kind", "status"])
export class CmsNodeEntity extends MutableEntity {
  @Column({ type: "text" })
  kind!: string

  @Column({ type: "text", default: "active" })
  status!: string
}

@Entity({ name: "cms_node_revisions" })
@Unique("cms_node_revisions_node_revision_unique", ["nodeId", "revision"])
@Index("cms_node_revisions_node_state_idx", ["nodeId", "state"])
export class CmsNodeRevisionEntity {
  @PrimaryColumn({ type: "uuid" })
  id!: string

  @Column({ name: "node_id", type: "uuid" })
  nodeId!: string

  @Column({ type: "integer" })
  revision!: number

  @Column({ type: "text" })
  state!: string

  @Column({ type: "text" })
  path!: string

  @Column({ type: "text" })
  slug!: string

  @Column({ name: "parent_node_id", type: "uuid", nullable: true })
  parentNodeId!: string | null

  @Column({ name: "sort_order", type: "integer", default: 0 })
  sortOrder!: number

  @Column({ type: "text" })
  title!: string

  @Column({ type: "text", nullable: true })
  summary!: string | null

  @Column({ type: "jsonb", default: () => "'{\"mode\":\"inherit\"}'::jsonb" })
  hero!: Record<string, unknown>

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  sections!: Array<Record<string, unknown>>

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  seo!: Record<string, unknown>

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  relations!: Array<Record<string, unknown>>

  @Column({ name: "schema_version", type: "integer" })
  schemaVersion!: number

  @Column({ name: "content_hash", type: "text" })
  contentHash!: string

  @Column({ name: "created_by", type: "uuid" })
  createdBy!: string

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date
}

@Entity({ name: "cms_releases" })
@Unique("cms_releases_sequence_unique", ["sequence"])
export class CmsReleaseEntity {
  @PrimaryColumn({ type: "uuid" })
  id!: string

  @Column({ type: "integer" })
  sequence!: number

  @Column({ type: "text" })
  state!: string

  @Column({ name: "base_release_id", type: "uuid", nullable: true })
  baseReleaseId!: string | null

  @Column({ name: "site_settings_revision_id", type: "uuid", nullable: true })
  siteSettingsRevisionId!: string | null

  @Column({ name: "manifest_hash", type: "text" })
  manifestHash!: string

  @Column({ name: "created_by", type: "uuid" })
  createdBy!: string

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date

  @Column({ name: "published_at", type: "timestamptz", nullable: true })
  publishedAt!: Date | null
}

@Entity({ name: "cms_release_items" })
@Unique("cms_release_items_release_path_unique", ["releaseId", "path"])
@Index("cms_release_items_node_idx", ["nodeId", "revisionId"])
export class CmsReleaseItemEntity {
  @PrimaryColumn({ type: "uuid" })
  id!: string

  @Column({ name: "release_id", type: "uuid" })
  releaseId!: string

  @Column({ type: "text" })
  path!: string

  @Column({ name: "node_id", type: "uuid" })
  nodeId!: string

  @Column({ name: "revision_id", type: "uuid" })
  revisionId!: string

  @Column({ name: "resolved_content_hash", type: "text" })
  resolvedContentHash!: string

  @Column({ name: "resolved_content", type: "jsonb" })
  resolvedContent!: Record<string, unknown>

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  dependencies!: Array<Record<string, unknown>>
}

@Entity({ name: "cms_active_release" })
export class CmsActiveReleaseEntity {
  @PrimaryColumn({ name: "singleton_key", type: "text" })
  singletonKey!: string

  @Column({ name: "release_id", type: "uuid", nullable: true })
  releaseId!: string | null

  @VersionColumn()
  version!: number

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date

  @Column({ name: "updated_by", type: "uuid", nullable: true })
  updatedBy!: string | null
}

@Entity({ name: "cms_public_profiles" })
@Unique("cms_public_profiles_entity_unique", ["kind", "entityId"])
@Unique("cms_public_profiles_node_unique", ["nodeId"])
export class CmsPublicProfileEntity extends MutableEntity {
  @Column({ type: "text" })
  kind!: string

  @Column({ name: "entity_id", type: "uuid" })
  entityId!: string

  @Column({ name: "node_id", type: "uuid" })
  nodeId!: string
}

@Entity({ name: "cms_source_links" })
@Unique("cms_source_links_source_unique", ["sourceKind", "sourceId"])
@Unique("cms_source_links_node_unique", ["nodeId"])
export class CmsSourceLinkEntity {
  @PrimaryColumn({ type: "uuid" }) id!: string
  @Column({ name: "source_kind", type: "text" }) sourceKind!: "resource" | "program_template" | "program_occurrence" | "event" | "program_category" | "event_category" | "catalog_offering"
  @Column({ name: "source_id", type: "uuid" }) sourceId!: string
  @Column({ name: "source_version", type: "integer" }) sourceVersion!: number
  @Column({ name: "node_id", type: "uuid" }) nodeId!: string
  @Column({ name: "sync_state", type: "text", default: "draft" }) syncState!: string
  @Column({ name: "created_at", type: "timestamptz" }) createdAt!: Date
}

@Entity({ name: "cms_site_settings" })
export class CmsSiteSettingsEntity extends MutableEntity {}

@Entity({ name: "cms_site_settings_revisions" })
@Unique("cms_site_settings_revisions_number_unique", ["settingsId", "revision"])
@Index("cms_site_settings_revisions_state_idx", ["settingsId", "state"])
export class CmsSiteSettingsRevisionEntity {
  @PrimaryColumn({ type: "uuid" }) id!: string
  @Column({ name: "settings_id", type: "uuid" }) settingsId!: string
  @Column({ type: "integer" }) revision!: number
  @Column({ type: "text" }) state!: string
  @Column({ type: "jsonb" }) value!: Record<string, unknown>
  @Column({ name: "content_hash", type: "text" }) contentHash!: string
  @Column({ name: "created_by", type: "uuid" }) createdBy!: string
  @Column({ name: "created_at", type: "timestamptz" }) createdAt!: Date
}

@Entity({ name: "media_assets" })
@Index("media_assets_state_updated_idx", ["state", "updatedAt"])
export class MediaAssetEntity extends MutableEntity {
  @Column({ type: "text" }) kind!: string
  @Column({ type: "text" }) state!: string
  @Column({ type: "text" }) title!: string
  @Column({ type: "text", nullable: true }) alt!: string | null
  @Column({ type: "text", nullable: true }) caption!: string | null
  @Column({ type: "text", nullable: true }) credit!: string | null
  @Column({ type: "text", nullable: true }) license!: string | null
  @Column({ type: "jsonb", default: () => "'[]'::jsonb" }) tags!: string[]
  @Column({ name: "focal_point", type: "jsonb", default: () => "'{\"x\":0.5,\"y\":0.5}'::jsonb" }) focalPoint!: { x: number; y: number }
  @Column({ name: "original_filename", type: "text" }) originalFilename!: string
  @Column({ name: "mime_type", type: "text" }) mimeType!: string
  @Column({ name: "byte_size", type: "integer" }) byteSize!: number
  @Column({ type: "integer", nullable: true }) width!: number | null
  @Column({ type: "integer", nullable: true }) height!: number | null
  @Column({ name: "current_blob_id", type: "uuid", nullable: true }) currentBlobId!: string | null
}

@Entity({ name: "media_blobs" })
@Unique("media_blobs_asset_revision_unique", ["assetId", "revision"])
@Index("media_blobs_checksum_idx", ["checksumSha256"])
export class MediaBlobEntity {
  @PrimaryColumn({ type: "uuid" }) id!: string
  @Column({ name: "asset_id", type: "uuid" }) assetId!: string
  @Column({ type: "integer" }) revision!: number
  @Column({ name: "checksum_sha256", type: "text" }) checksumSha256!: string
  @Column({ name: "mime_type", type: "text" }) mimeType!: string
  @Column({ name: "byte_size", type: "integer" }) byteSize!: number
  @Column({ name: "storage_key", type: "text" }) storageKey!: string
  @Column({ name: "created_at", type: "timestamptz" }) createdAt!: Date
}

@Entity({ name: "media_variants" })
@Unique("media_variants_blob_format_width_unique", ["blobId", "format", "width"])
@Index("media_variants_asset_idx", ["assetId"])
export class MediaVariantEntity {
  @PrimaryColumn({ type: "uuid" }) id!: string
  @Column({ name: "asset_id", type: "uuid" }) assetId!: string
  @Column({ name: "blob_id", type: "uuid" }) blobId!: string
  @Column({ type: "text" }) format!: string
  @Column({ type: "integer" }) width!: number
  @Column({ type: "integer" }) height!: number
  @Column({ name: "byte_size", type: "integer" }) byteSize!: number
  @Column({ name: "storage_key", type: "text" }) storageKey!: string
  @Column({ name: "content_hash", type: "text" }) contentHash!: string
  @Column({ name: "created_at", type: "timestamptz" }) createdAt!: Date
}

@Entity({ name: "media_uploads" })
@Index("media_uploads_state_expiry_idx", ["state", "expiresAt"])
export class MediaUploadEntity {
  @PrimaryColumn({ type: "uuid" }) id!: string
  @Column({ name: "asset_id", type: "uuid" }) assetId!: string
  @Column({ type: "text" }) state!: string
  @Column({ type: "text" }) filename!: string
  @Column({ name: "mime_type", type: "text" }) mimeType!: string
  @Column({ name: "byte_size", type: "integer" }) byteSize!: number
  @Column({ name: "checksum_sha256", type: "text" }) checksumSha256!: string
  @Column({ name: "token_hash", type: "text" }) tokenHash!: string
  @Column({ name: "expires_at", type: "timestamptz" }) expiresAt!: Date
  @Column({ name: "created_by", type: "uuid" }) createdBy!: string
  @Column({ name: "created_at", type: "timestamptz" }) createdAt!: Date
  @Column({ name: "completed_at", type: "timestamptz", nullable: true }) completedAt!: Date | null
  @Column({ name: "error_code", type: "text", nullable: true }) errorCode!: string | null
  @Column({ name: "error_message", type: "text", nullable: true }) errorMessage!: string | null
}

@Entity({ name: "media_processing_jobs" })
@Index("media_processing_jobs_claim_idx", ["state", "availableAt"])
export class MediaProcessingJobEntity {
  @PrimaryColumn({ type: "uuid" }) id!: string
  @Column({ name: "asset_id", type: "uuid" }) assetId!: string
  @Column({ name: "upload_id", type: "uuid" }) uploadId!: string
  @Column({ name: "blob_id", type: "uuid", nullable: true }) blobId!: string | null
  @Column({ type: "text" }) state!: string
  @Column({ type: "integer", default: 0 }) attempts!: number
  @Column({ name: "available_at", type: "timestamptz" }) availableAt!: Date
  @Column({ name: "started_at", type: "timestamptz", nullable: true }) startedAt!: Date | null
  @Column({ name: "finished_at", type: "timestamptz", nullable: true }) finishedAt!: Date | null
  @Column({ name: "error_code", type: "text", nullable: true }) errorCode!: string | null
  @Column({ name: "error_message", type: "text", nullable: true }) errorMessage!: string | null
}

@Entity({ name: "media_usages" })
@Unique("media_usages_owner_pointer_unique", ["assetId", "ownerType", "ownerId", "pointer"])
@Index("media_usages_asset_published_idx", ["assetId", "published"])
export class MediaUsageEntity {
  @PrimaryColumn({ type: "uuid" }) id!: string
  @Column({ name: "asset_id", type: "uuid" }) assetId!: string
  @Column({ name: "owner_type", type: "text" }) ownerType!: string
  @Column({ name: "owner_id", type: "uuid" }) ownerId!: string
  @Column({ type: "text" }) pointer!: string
  @Column({ type: "boolean" }) published!: boolean
  @Column({ name: "detected_at", type: "timestamptz" }) detectedAt!: Date
}

/** Operational-only grouping. Individual tents and an own-tent area remain sellable resources. */
@Entity({ name: "resource_groups" })
@Unique("resource_groups_code_unique", ["code"])
@Index("resource_groups_kind_state_idx", ["kind", "state"])
export class ResourceGroupEntity extends MutableEntity {
  @Column({ type: "text" }) code!: string
  @Column({ type: "text" }) kind!: string
  @Column({ type: "text" }) name!: string
  @Column({ type: "text", default: "draft" }) state!: string
}

@Entity({ name: "resource_group_members" })
@Index("resource_group_members_resource_idx", ["resourceId"])
export class ResourceGroupMemberEntity extends MutableEntity {
  @Column({ name: "group_id", type: "uuid" }) groupId!: string
  @Column({ name: "resource_id", type: "uuid" }) resourceId!: string
  @Column({ type: "text" }) role!: string
  @Column({ name: "sort_order", type: "integer", default: 0 }) sortOrder!: number
}

@Entity({ name: "event_service_templates" })
@Unique("event_service_templates_code_unique", ["code"])
export class EventServiceTemplateEntity extends MutableEntity {
  @Column({ type: "text" }) code!: string
  @Column({ type: "text" }) format!: string
  @Column({ name: "default_duration_minutes", type: "integer" }) defaultDurationMinutes!: number
  @Column({ name: "minimum_guests", type: "integer", nullable: true }) minimumGuests!: number | null
  @Column({ name: "maximum_guests", type: "integer", nullable: true }) maximumGuests!: number | null
  @Column({ name: "preparation_before_minutes", type: "integer", default: 0 }) preparationBeforeMinutes!: number
  @Column({ name: "preparation_after_minutes", type: "integer", default: 0 }) preparationAfterMinutes!: number
}

@Entity({ name: "catalog_offerings" })
@Unique("catalog_offerings_code_unique", ["code"])
@Index("catalog_offerings_kind_state_idx", ["kind", "state"])
export class CatalogOfferingEntity extends MutableEntity {
  @Column({ type: "text" }) code!: string
  @Column({ type: "text" }) kind!: string
  @Column({ name: "operational_name", type: "text" }) operationalName!: string
  @Column({ name: "internal_comment", type: "text", default: "" }) internalComment!: string
  @Column({ type: "text", default: "draft" }) state!: string
  @Column({ name: "subject_version", type: "integer", default: 1 }) subjectVersion!: number
  @Column({ name: "pricing_version", type: "integer", default: 1 }) pricingVersion!: number
  @Column({ name: "addon_assignments_version", type: "integer", default: 1 }) addonAssignmentsVersion!: number
  @Column({ name: "sales_mode", type: "text", default: "request_only" }) salesMode!: string
  @Column({ name: "price_display_mode", type: "text", default: "request" }) priceDisplayMode!: string
  @Column({ type: "text", default: "RUB" }) currency!: string
  @Column({ type: "text", default: "Europe/Moscow" }) timezone!: string
  @Column({ name: "tax_mode", type: "text", default: "tax_included" }) taxMode!: string
  @Column({ name: "business_calendar_id", type: "uuid" }) businessCalendarId!: string
  @Column({ name: "lead_direction", type: "text", nullable: true }) leadDirection!: string | null
  @Column({ name: "default_assignee_id", type: "uuid", nullable: true }) defaultAssigneeId!: string | null
  @Column({ name: "scope", type: "text", nullable: true }) scope!: string | null
  @Column({ name: "owner_offering_id", type: "uuid", nullable: true }) ownerOfferingId!: string | null
  @Column({ name: "active_price_book_id", type: "uuid", nullable: true }) activePriceBookId!: string | null
}

@Entity({ name: "campground_offering_terms" })
export class CampgroundOfferingTermsEntity {
  @PrimaryColumn({ name: "offering_id", type: "uuid" }) offeringId!: string
  @Column({ name: "offering_kind", type: "text" }) offeringKind!: string
  @Column({ name: "sellable_unit", type: "text" }) sellableUnit!: string
  @Column({ name: "inventory_mode", type: "text" }) inventoryMode!: string
  @Column({ name: "capacity_unit", type: "text" }) capacityUnit!: string
  @Column({ name: "pricing_basis", type: "text" }) pricingBasis!: string
  @Column({ name: "created_at", type: "timestamptz" }) createdAt!: Date
  @Column({ name: "created_by", type: "uuid", nullable: true }) createdBy!: string | null
}

@Entity({ name: "addon_offering_terms" })
export class AddonOfferingTermsEntity {
  @PrimaryColumn({ name: "offering_id", type: "uuid" }) offeringId!: string
  @Column({ name: "offering_kind", type: "text" }) offeringKind!: string
  @Column({ name: "service_type", type: "text" }) serviceType!: string
  @Column({ name: "standalone", type: "boolean", default: false }) standalone!: boolean
  @Column({ name: "category_key", type: "text", default: "other" }) categoryKey!: string
  @Column({ name: "applicable_offering_kinds", type: "text", array: true }) applicableOfferingKinds!: string[]
  @Column({ name: "minimum_quantity", type: "integer", nullable: true }) minimumQuantity!: number | null
  @Column({ name: "maximum_quantity", type: "integer", nullable: true }) maximumQuantity!: number | null
  @Column({ name: "default_quantity", type: "integer", nullable: true }) defaultQuantity!: number | null
  @Column({ name: "quantity_step", type: "integer", nullable: true }) quantityStep!: number | null
  @Column({ name: "created_at", type: "timestamptz" }) createdAt!: Date
  @Column({ name: "created_by", type: "uuid", nullable: true }) createdBy!: string | null
}

@Entity({ name: "offering_bindings" })
@Index("offering_bindings_offering_role_idx", ["offeringId", "role"])
@Index("offering_bindings_resource_idx", ["resourceId"])
@Index("offering_bindings_group_idx", ["resourceGroupId"])
@Index("offering_bindings_program_template_idx", ["programTemplateId"])
@Index("offering_bindings_event_template_idx", ["eventServiceTemplateId"])
export class OfferingBindingEntity extends MutableEntity {
  @Column({ name: "offering_id", type: "uuid" }) offeringId!: string
  @Column({ name: "resource_id", type: "uuid", nullable: true }) resourceId!: string | null
  @Column({ name: "resource_group_id", type: "uuid", nullable: true }) resourceGroupId!: string | null
  @Column({ name: "program_template_id", type: "uuid", nullable: true }) programTemplateId!: string | null
  @Column({ name: "event_service_template_id", type: "uuid", nullable: true }) eventServiceTemplateId!: string | null
  @Column({ type: "text" }) role!: string
  @Column({ name: "quantity_default", type: "integer", default: 1 }) quantityDefault!: number
  @Column({ name: "capacity_impact_default", type: "integer", default: 1 }) capacityImpactDefault!: number
  @Column({ name: "preparation_before_minutes", type: "integer", default: 0 }) preparationBeforeMinutes!: number
  @Column({ name: "preparation_after_minutes", type: "integer", default: 0 }) preparationAfterMinutes!: number
  @Column({ name: "availability_required", type: "boolean", default: true }) availabilityRequired!: boolean
}

@Entity({ name: "business_calendars" })
@Unique("business_calendars_code_unique", ["code"])
export class BusinessCalendarEntity extends MutableEntity {
  @Column({ type: "text" }) code!: string
  @Column({ type: "text" }) name!: string
  @Column({ type: "text", default: "Europe/Moscow" }) timezone!: string
  @Column({ name: "country_code", type: "text", default: "RU" }) countryCode!: string
  @Column({ type: "text", default: "official_ru" }) source!: string
  @Column({ name: "source_version", type: "text" }) sourceVersion!: string
  @Column({ type: "text", default: "draft" }) state!: string
  @Column({ name: "imported_at", type: "timestamptz" }) importedAt!: Date
  @Column({ name: "coverage_from", type: "date", nullable: true }) coverageFrom!: string | null
  @Column({ name: "coverage_to_exclusive", type: "date", nullable: true }) coverageToExclusive!: string | null
  @Column({ name: "content_hash", type: "text", nullable: true }) contentHash!: string | null
}

@Entity({ name: "business_calendar_dates" })
@Unique("business_calendar_dates_calendar_date_unique", ["calendarId", "localDate"])
@Index("business_calendar_dates_calendar_date_idx", ["calendarId", "localDate"])
export class BusinessCalendarDateEntity extends MutableEntity {
  @Column({ name: "calendar_id", type: "uuid" }) calendarId!: string
  @Column({ name: "local_date", type: "date" }) localDate!: string
  @Column({ name: "official_class", type: "text" }) officialClass!: string
  @Column({ name: "official_label", type: "text", nullable: true }) officialLabel!: string | null
  @Column({ name: "source_version", type: "text" }) sourceVersion!: string
}

@Entity({ name: "business_calendar_date_overrides" })
@Index("business_calendar_date_overrides_calendar_date_idx", ["calendarId", "localDate"])
export class BusinessCalendarDateOverrideEntity extends MutableEntity {
  @Column({ name: "calendar_id", type: "uuid" }) calendarId!: string
  @Column({ name: "local_date", type: "date" }) localDate!: string
  @Column({ name: "override_class", type: "text" }) overrideClass!: string
  @Column({ type: "text", nullable: true }) label!: string | null
  @Column({ type: "text" }) reason!: string
  @Column({ type: "text", default: "active" }) state!: string
}

@Entity({ name: "price_books" })
@Index("price_books_offering_state_period_idx", ["offeringId", "state", "validFrom"])
export class PriceBookEntity extends MutableEntity {
  @Column({ name: "offering_id", type: "uuid" }) offeringId!: string
  @Column({ type: "integer" }) revision!: number
  @Column({ type: "text" }) name!: string
  @Column({ type: "text", default: "RUB" }) currency!: string
  @Column({ type: "text", default: "Europe/Moscow" }) timezone!: string
  @Column({ type: "text", default: "draft" }) state!: string
  @Column({ name: "valid_from", type: "date" }) validFrom!: string
  @Column({ name: "valid_to_exclusive", type: "date", nullable: true }) validToExclusive!: string | null
  @Column({ name: "supersedes_price_book_id", type: "uuid", nullable: true }) supersedesPriceBookId!: string | null
  @Column({ name: "change_reason", type: "text", default: "" }) changeReason!: string
  @Column({ name: "scheduled_activation_at", type: "timestamptz", nullable: true }) scheduledActivationAt!: Date | null
  @Column({ name: "scheduled_by", type: "uuid", nullable: true }) scheduledBy!: string | null
  @Column({ name: "activated_at", type: "timestamptz", nullable: true }) activatedAt!: Date | null
  @Column({ name: "activated_by", type: "uuid", nullable: true }) activatedBy!: string | null
  @Column({ name: "retired_at", type: "timestamptz", nullable: true }) retiredAt!: Date | null
  @Column({ name: "retired_by", type: "uuid", nullable: true }) retiredBy!: string | null
}

@Entity({ name: "rate_plans" })
@Index("rate_plans_price_book_order_idx", ["priceBookId", "sortOrder"])
export class RatePlanEntity extends MutableEntity {
  @Column({ name: "price_book_id", type: "uuid" }) priceBookId!: string
  @Column({ name: "rate_key", type: "text" }) key!: string
  @Column({ type: "text" }) label!: string
  @Column({ name: "pricing_basis", type: "text" }) pricingBasis!: string
  @Column({ name: "base_amount_minor", type: "integer" }) baseAmountMinor!: number
  @Column({ name: "base_extra_unit_amount_minor", type: "integer", nullable: true }) baseExtraUnitAmountMinor!: number | null
  @Column({ name: "quantity_metric", type: "text", nullable: true }) quantityMetric!: string | null
  @Column({ name: "included_quantity", type: "integer", nullable: true }) includedQuantity!: number | null
  @Column({ name: "minimum_quantity", type: "integer", nullable: true }) minimumQuantity!: number | null
  @Column({ name: "maximum_quantity", type: "integer", nullable: true }) maximumQuantity!: number | null
  @Column({ name: "minimum_duration_minutes", type: "integer", nullable: true }) minimumDurationMinutes!: number | null
  @Column({ name: "maximum_duration_minutes", type: "integer", nullable: true }) maximumDurationMinutes!: number | null
  @Column({ name: "sort_order", type: "integer", default: 0 }) sortOrder!: number
  @Column({ name: "is_default", type: "boolean", default: false }) isDefault!: boolean
}

@Entity({ name: "price_rules" })
@Index("price_rules_rate_plan_selector_priority_idx", ["ratePlanId", "selector", "priority"])
export class PriceRuleEntity extends MutableEntity {
  @Column({ name: "rate_plan_id", type: "uuid" }) ratePlanId!: string
  @Column({ type: "text" }) selector!: string
  @Column({ name: "day_class", type: "text", nullable: true }) dayClass!: string | null
  @Column({ name: "service_date_from", type: "date", nullable: true }) serviceDateFrom!: string | null
  @Column({ name: "service_date_to_exclusive", type: "date", nullable: true }) serviceDateToExclusive!: string | null
  @Column({ name: "selector_label", type: "text", nullable: true }) selectorLabel!: string | null
  @Column({ name: "minimum_quantity", type: "integer", nullable: true }) minimumQuantity!: number | null
  @Column({ name: "maximum_quantity", type: "integer", nullable: true }) maximumQuantity!: number | null
  @Column({ name: "minimum_duration_minutes", type: "integer", nullable: true }) minimumDurationMinutes!: number | null
  @Column({ name: "maximum_duration_minutes", type: "integer", nullable: true }) maximumDurationMinutes!: number | null
  @Column({ name: "minimum_booking_lead_days", type: "integer", nullable: true }) minimumBookingLeadDays!: number | null
  @Column({ name: "maximum_booking_lead_days", type: "integer", nullable: true }) maximumBookingLeadDays!: number | null
  @Column({ name: "amount_minor", type: "integer", nullable: true }) amountMinor!: number | null
  @Column({ name: "extra_unit_amount_minor", type: "integer", nullable: true }) extraUnitAmountMinor!: number | null
  @Column({ type: "integer", default: 0 }) priority!: number
  @Column({ type: "text", default: "" }) reason!: string
  @Column({ type: "boolean", default: true }) enabled!: boolean
}

@Entity({ name: "offering_addon_assignments" })
@Index("offering_addon_assignments_owner_idx", ["offeringId", "enabled", "displayOrder"])
@Index("offering_addon_assignments_addon_idx", ["addonOfferingId"])
export class OfferingAddonAssignmentEntity extends MutableEntity {
  @Column({ name: "offering_id", type: "uuid" }) offeringId!: string
  @Column({ name: "addon_offering_id", type: "uuid" }) addonOfferingId!: string
  @Column({ name: "addon_offering_kind", type: "text" }) addonOfferingKind!: string
  @Column({ type: "boolean", default: true }) enabled!: boolean
  @Column({ name: "required", type: "boolean", default: false }) required!: boolean
  @Column({ name: "recommended", type: "boolean", default: false }) recommended!: boolean
  @Column({ name: "group_key", type: "text", nullable: true }) groupKey!: string | null
  @Column({ name: "minimum_quantity", type: "integer", nullable: true }) minimumQuantity!: number | null
  @Column({ name: "maximum_quantity", type: "integer", nullable: true }) maximumQuantity!: number | null
  @Column({ name: "default_quantity", type: "integer", nullable: true }) defaultQuantity!: number | null
  @Column({ name: "display_order", type: "integer", default: 0 }) displayOrder!: number
  @Column({ name: "label_override", type: "text", nullable: true }) labelOverride!: string | null
  @Column({ name: "description_override", type: "text", nullable: true }) descriptionOverride!: string | null
  @Column({ name: "rate_plan_key_override", type: "text", nullable: true }) ratePlanKeyOverride!: string | null
}

@Entity({ name: "offering_quote_snapshots" })
@Index("offering_quote_snapshots_offering_calculated_idx", ["offeringId", "calculatedAt"])
@Index("offering_quote_snapshots_operation_idx", ["operationId"])
export class OfferingQuoteSnapshotEntity {
  @PrimaryColumn({ type: "uuid" }) id!: string
  @Column({ name: "offering_id", type: "uuid" }) offeringId!: string
  @Column({ name: "quote_type", type: "text", default: "stay_preview" }) quoteType!: string
  @Column({ name: "offering_version", type: "integer" }) offeringVersion!: number
  @Column({ name: "pricing_version", type: "integer" }) pricingVersion!: number
  @Column({ name: "addon_assignments_version", type: "integer" }) addOnAssignmentsVersion!: number
  @Column({ name: "price_book_id", type: "uuid" }) priceBookId!: string
  @Column({ name: "price_book_version", type: "integer" }) priceBookVersion!: number
  @Column({ name: "business_calendar_id", type: "uuid" }) businessCalendarId!: string
  @Column({ name: "business_calendar_version", type: "integer" }) businessCalendarVersion!: number
  @Column({ name: "business_calendar_source_version", type: "text" }) businessCalendarSourceVersion!: string
  @Column({ name: "subject_version", type: "integer", nullable: true }) subjectVersion!: number | null
  @Column({ name: "program_template_id", type: "uuid", nullable: true }) programTemplateId!: string | null
  @Column({ name: "program_template_version", type: "integer", nullable: true }) programTemplateVersion!: number | null
  @Column({ name: "request_payload", type: "jsonb" }) requestPayload!: Record<string, unknown>
  @Column({ name: "result_payload", type: "jsonb" }) resultPayload!: Record<string, unknown>
  @Column({ type: "jsonb" }) provenance!: Record<string, unknown>
  @Column({ name: "calculated_at", type: "timestamptz" }) calculatedAt!: Date
  @Column({ name: "valid_until", type: "timestamptz" }) validUntil!: Date
  @Column({ name: "operation_id", type: "uuid" }) operationId!: string
  @Column({ name: "idempotency_key", type: "text" }) idempotencyKey!: string
  @Column({ name: "actor_id", type: "uuid", nullable: true }) actorId!: string | null
  @Column({ name: "request_id", type: "text" }) requestId!: string
  @Column({ name: "entry_surface", type: "text" }) entrySurface!: string
  @Column({ name: "operational_context", type: "jsonb", nullable: true }) operationalContext!: Record<string, unknown> | null
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date
}

@Entity({ name: "accepted_offering_quote_links" })
@Index("accepted_offering_quote_links_operation_idx", ["operationId"])
export class AcceptedOfferingQuoteLinkEntity {
  @PrimaryColumn({ type: "uuid" }) id!: string
  @Column({ name: "quote_snapshot_id", type: "uuid" }) quoteSnapshotId!: string
  @Column({ name: "booking_item_id", type: "uuid", nullable: true }) bookingItemId!: string | null
  @Column({ name: "event_id", type: "uuid", nullable: true }) eventId!: string | null
  @Column({ name: "program_registration_id", type: "uuid", nullable: true }) programRegistrationId!: string | null
  /** Booking-item links store their parent Booking version in this column. */
  @Column({ name: "target_version", type: "integer" }) targetVersion!: number
  @Column({ name: "accepted_at", type: "timestamptz" }) acceptedAt!: Date
  @Column({ name: "accepted_by", type: "uuid", nullable: true }) acceptedBy!: string | null
  @Column({ name: "operation_id", type: "uuid" }) operationId!: string
  @Column({ name: "request_id", type: "text" }) requestId!: string
  @Column({ name: "entry_surface", type: "text" }) entrySurface!: string
  @CreateDateColumn({ name: "created_at", type: "timestamptz" }) createdAt!: Date
}

export const databaseEntities = [
  UserEntity,
  WorkspaceSettingsEntity,
  SessionEntity,
  CustomerEntity,
  LeadEntity,
  TaskEntity,
  ResourceEntity,
  ProgramTemplateEntity,
  ProgramCategoryEntity,
  ProgramOccurrenceEntity,
  ProgramRegistrationEntity,
  EventEntity,
  EventCategoryEntity,
  BookingEntity,
  PromotionEntity,
  BookingLeadLinkEntity,
  BookingItemEntity,
  ResourceAllocationEntity,
  PaymentEntity,
  SavedViewEntity,
  IdempotencyKeyEntity,
  ChangeLogEntity,
  OutboxEventEntity,
  OutboxDeliveryEntity,
  OutboxDeliveryAttemptEntity,
  OutboxDeliveryReplayEntity,
  PublicOfferingProjectionStateEntity,
  PublicOfferingProjectionInvalidationReceiptEntity,
  CmsNodeEntity,
  CmsNodeRevisionEntity,
  CmsReleaseEntity,
  CmsReleaseItemEntity,
  CmsActiveReleaseEntity,
  CmsPublicProfileEntity,
  CmsSourceLinkEntity,
  CmsSiteSettingsEntity,
  CmsSiteSettingsRevisionEntity,
  MediaAssetEntity,
  MediaBlobEntity,
  MediaVariantEntity,
  MediaUploadEntity,
  MediaProcessingJobEntity,
  MediaUsageEntity,
  ResourceGroupEntity,
  ResourceGroupMemberEntity,
  EventServiceTemplateEntity,
  CatalogOfferingEntity,
  CampgroundOfferingTermsEntity,
  AddonOfferingTermsEntity,
  OfferingBindingEntity,
  BusinessCalendarEntity,
  BusinessCalendarDateEntity,
  BusinessCalendarDateOverrideEntity,
  PriceBookEntity,
  RatePlanEntity,
  PriceRuleEntity,
  OfferingAddonAssignmentEntity,
  OfferingQuoteSnapshotEntity,
  AcceptedOfferingQuoteLinkEntity,
]
