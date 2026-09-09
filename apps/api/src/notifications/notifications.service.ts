import { ForbiddenException, Inject, Injectable } from "@nestjs/common"
import { DataSource } from "typeorm"

import type {
  NotificationDto,
  NotificationList,
  NotificationListQuery,
  NotificationType,
  SessionUser,
} from "@crm/contracts"

type NotificationRow = {
  action: string
  actor_name: string | null
  changes: Record<string, unknown>
  created_at: Date | string
  entity_id: string
  entity_type: string
  id: string
  label: string | null
  read_at: Date | string | null
  task_blocked: boolean | null
  task_code: string | null
  task_due_at: Date | string | null
  task_status: string | null
  unread_count: string
}

const visibleEntityTypes = [
  "booking",
  "customer",
  "event",
  "lead",
  "payment",
  "program_occurrence",
  "program_registration",
  "program_template",
  "resource",
  "task",
] as const

@Injectable()
export class NotificationsService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async list(query: NotificationListQuery, actor: SessionUser): Promise<NotificationList> {
    this.assertCanView(actor)
    const rows = await this.dataSource.query<NotificationRow[]>(`
      SELECT
        cl.id,
        cl.entity_type,
        cl.entity_id,
        cl.action,
        cl.changes,
        cl.created_at,
        notification_reads.read_at,
        users.display_name AS actor_name,
        tasks.code AS task_code,
        tasks.due_at AS task_due_at,
        tasks.status AS task_status,
        tasks.blocked AS task_blocked,
        COALESCE(
          bookings.code,
          tasks.code,
          leads.name,
          customers.name,
          resources.name,
          program_templates.name,
          program_occurrences.name,
          program_registrations.code,
          events.name,
          cl.entity_id::text
        ) AS label,
        COUNT(*) FILTER (WHERE notification_reads.change_log_id IS NULL) OVER ()::text AS unread_count
      FROM change_log cl
      LEFT JOIN notification_reads
        ON notification_reads.change_log_id = cl.id
       AND notification_reads.user_id = $1
      LEFT JOIN users ON users.id = cl.actor_id
      LEFT JOIN bookings ON cl.entity_type = 'booking' AND bookings.id = cl.entity_id
      LEFT JOIN tasks ON cl.entity_type = 'task' AND tasks.id = cl.entity_id
      LEFT JOIN leads ON cl.entity_type = 'lead' AND leads.id = cl.entity_id
      LEFT JOIN customers ON cl.entity_type = 'customer' AND customers.id = cl.entity_id
      LEFT JOIN resources ON cl.entity_type = 'resource' AND resources.id = cl.entity_id
      LEFT JOIN program_templates ON cl.entity_type = 'program_template' AND program_templates.id = cl.entity_id
      LEFT JOIN program_occurrences ON cl.entity_type = 'program_occurrence' AND program_occurrences.id = cl.entity_id
      LEFT JOIN program_registrations ON cl.entity_type = 'program_registration' AND program_registrations.id = cl.entity_id
      LEFT JOIN events ON cl.entity_type = 'event' AND events.id = cl.entity_id
      WHERE cl.entity_type = ANY($2::text[])
        AND (cl.actor_id IS NULL OR cl.actor_id <> $1)
      ORDER BY cl.created_at DESC, cl.id DESC
      LIMIT $3
    `, [actor.id, visibleEntityTypes, query.limit])

    return {
      items: rows.map((row) => this.toDto(row)),
      unreadCount: Number(rows[0]?.unread_count ?? 0),
    }
  }

  async markRead(id: string, actor: SessionUser) {
    this.assertCanView(actor)
    await this.dataSource.query(`
      INSERT INTO notification_reads (user_id, change_log_id, read_at)
      SELECT $1, change_log.id, now()
      FROM change_log
      WHERE change_log.id = $2
        AND change_log.entity_type = ANY($3::text[])
        AND (change_log.actor_id IS NULL OR change_log.actor_id <> $1)
      ON CONFLICT (user_id, change_log_id) DO UPDATE SET read_at = EXCLUDED.read_at
    `, [actor.id, id, visibleEntityTypes])
    return { ok: true as const }
  }

  async markAllRead(actor: SessionUser) {
    this.assertCanView(actor)
    await this.dataSource.query(`
      INSERT INTO notification_reads (user_id, change_log_id, read_at)
      SELECT $1, change_log.id, now()
      FROM change_log
      WHERE change_log.entity_type = ANY($2::text[])
        AND (change_log.actor_id IS NULL OR change_log.actor_id <> $1)
      ON CONFLICT (user_id, change_log_id) DO UPDATE SET read_at = EXCLUDED.read_at
    `, [actor.id, visibleEntityTypes])
    return { ok: true as const }
  }

  private toDto(row: NotificationRow): NotificationDto {
    const label = row.label ?? row.entity_id
    const type = this.type(row)
    const title = this.title(row, type, label)
    return {
      id: row.id,
      type,
      title,
      description: row.actor_name ? `Изменил: ${row.actor_name}` : null,
      entityType: row.entity_type,
      entityId: row.entity_id,
      href: this.href(row),
      occurredAt: new Date(row.created_at).toISOString(),
      readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    }
  }

  private type(row: NotificationRow): NotificationType {
    if (row.entity_type === "lead" && row.action === "created") return "new_lead"
    if (row.entity_type === "booking" && row.action === "status_changed" && this.changeValue(row.changes, "after") === "cancelled") return "booking_cancelled"
    if (row.entity_type === "task" && row.action === "assigned") return "assignee_change"
    if (row.entity_type === "task" && row.task_due_at && new Date(row.task_due_at) < new Date() && row.task_status !== "done") return "overdue_task"
    if (row.entity_type === "resource" && row.action === "block_cancelled") return "unblocked"
    return "other_user_change"
  }

  private title(row: NotificationRow, type: NotificationType, label: string) {
    if (type === "new_lead") return `Новая заявка: ${label}`
    if (type === "booking_cancelled") return `Бронь ${label} отменена`
    if (type === "assignee_change") return `Изменёны ответственные: ${label}`
    if (type === "overdue_task") return `Просрочена задача ${label}`
    if (type === "unblocked") return `Ограничение ресурса снято: ${label}`
    return `${this.entityLabel(row.entity_type)} ${label}: ${this.actionLabel(row.action)}`
  }

  private href(row: NotificationRow) {
    if (row.entity_type === "booking") return `/bookings/${row.entity_id}`
    if (row.entity_type === "customer") return `/customers/${row.entity_id}`
    if (row.entity_type === "event") return `/events/${row.entity_id}`
    if (row.entity_type === "lead") return `/leads/${row.entity_id}`
    if (row.entity_type === "payment") {
      const bookingId = this.changeValue(row.changes, "bookingId")
      return bookingId ? `/bookings/${bookingId}` : "/finance"
    }
    if (row.entity_type === "program_occurrence") return `/programs/runs/${row.entity_id}`
    if (row.entity_type === "program_registration") return `/programs/registrations/${row.entity_id}`
    if (row.entity_type === "program_template") return `/programs/${row.entity_id}`
    if (row.entity_type === "resource") return `/resources/all/${row.entity_id}`
    if (row.entity_type === "task") return `/tasks/${row.task_code ?? row.entity_id}`
    return "/"
  }

  private changeValue(changes: Record<string, unknown>, key: string) {
    const value = changes[key]
    return typeof value === "string" ? value : null
  }

  private entityLabel(entityType: string) {
    const labels: Record<string, string> = {
      booking: "Бронь",
      customer: "Клиент",
      event: "Событие",
      lead: "Заявка",
      payment: "Оплата",
      program_occurrence: "Проведение",
      program_registration: "Регистрация",
      program_template: "Программа",
      resource: "Ресурс",
      task: "Задача",
    }
    return labels[entityType] ?? "Запись"
  }

  private actionLabel(action: string) {
    const labels: Record<string, string> = {
      archived: "архивирована",
      created: "создана",
      lead_linked: "связь с заявкой добавлена",
      lead_relinked: "связь с заявкой изменена",
      lead_unlinked: "связь с заявкой снята",
      payment: "оплата добавлена",
      refund: "возврат добавлен",
      status_changed: "статус изменён",
      updated: "изменена",
    }
    return labels[action] ?? "изменена"
  }

  private assertCanView(actor: SessionUser) {
    if (!actor.capabilities.canView) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для просмотра уведомлений" })
  }
}
