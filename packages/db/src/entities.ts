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

  @Column({ name: "booking_id", type: "uuid" })
  bookingId!: string

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

  @Column({ name: "created_by", type: "uuid", nullable: true })
  createdBy!: string | null
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

export const databaseEntities = [
  UserEntity,
  SessionEntity,
  CustomerEntity,
  LeadEntity,
  TaskEntity,
  ResourceEntity,
  ProgramTemplateEntity,
  ProgramOccurrenceEntity,
  ProgramRegistrationEntity,
  EventEntity,
  BookingEntity,
  BookingLeadLinkEntity,
  BookingItemEntity,
  ResourceAllocationEntity,
  PaymentEntity,
  SavedViewEntity,
  IdempotencyKeyEntity,
  ChangeLogEntity,
  OutboxEventEntity,
]
