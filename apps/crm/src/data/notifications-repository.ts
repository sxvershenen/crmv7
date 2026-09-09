import {
  NotificationListSchema,
  NotificationMutationResultSchema,
  type NotificationDto,
  type NotificationList,
} from "@crm/contracts"

import { apiClient } from "@app/lib/api-client"
import { useFixtureData } from "@app/lib/data-mode"

export interface NotificationsRepository {
  list(limit?: number): Promise<NotificationList>
  markAllRead(): Promise<void>
  markRead(id: string): Promise<void>
}

export class ApiNotificationsRepository implements NotificationsRepository {
  async list(limit = 30) {
    return apiClient.get(`/notifications?limit=${limit}`, NotificationListSchema)
  }

  async markRead(id: string) {
    await apiClient.post(`/notifications/${encodeURIComponent(id)}/read`, undefined, NotificationMutationResultSchema)
  }

  async markAllRead() {
    await apiClient.post("/notifications/read-all", undefined, NotificationMutationResultSchema)
  }
}

const now = Date.now()
const fixtureItems: NotificationDto[] = [
  {
    id: "71000000-0000-4000-8000-000000000001",
    type: "conflict",
    title: "Конфликт в брони #1048",
    description: "Ресурс уже занят в этом интервале",
    entityType: "booking",
    entityId: "72000000-0000-4000-8000-000000000001",
    href: "/bookings/1048",
    occurredAt: new Date(now - 5 * 60_000).toISOString(),
    readAt: null,
  },
  {
    id: "71000000-0000-4000-8000-000000000002",
    type: "new_lead",
    title: "Новая заявка #1079",
    description: "Источник: сайт",
    entityType: "lead",
    entityId: "72000000-0000-4000-8000-000000000002",
    href: "/leads/1079",
    occurredAt: new Date(now - 18 * 60_000).toISOString(),
    readAt: null,
  },
]

export class FixtureNotificationsRepository implements NotificationsRepository {
  private items = structuredClone(fixtureItems)

  async list(limit = 30) {
    const items = structuredClone(this.items.slice(0, limit))
    return { items, unreadCount: this.items.filter((item) => item.readAt === null).length }
  }

  async markRead(id: string) {
    const item = this.items.find((candidate) => candidate.id === id)
    if (item && item.readAt === null) item.readAt = new Date().toISOString()
  }

  async markAllRead() {
    const readAt = new Date().toISOString()
    this.items = this.items.map((item) => ({ ...item, readAt: item.readAt ?? readAt }))
  }
}

export const fixtureNotificationsRepository = new FixtureNotificationsRepository()
export const notificationsRepository: NotificationsRepository = useFixtureData
  ? fixtureNotificationsRepository
  : new ApiNotificationsRepository()
