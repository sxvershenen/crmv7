import { randomUUID } from "node:crypto"

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common"
import { Brackets, DataSource, type EntityManager } from "typeorm"

import type { CrmSettings, SessionUser, TeamMember, WorkspaceProfile, WorkspaceProfileUpdate, WorkspaceSettingsUpdate, WorkspaceTeamListQuery } from "@crm/contracts"
import { ChangeLogEntity, IdempotencyKeyEntity, OutboxEventEntity, WorkspaceSettingsEntity, UserEntity } from "@crm/db"
import { assertCapability } from "@crm/domain"

const settingsId = "00000000-0000-4000-8000-000000000001"
const roleLabels: Record<string, string> = { admin: "Администратор", manager: "Менеджер", lead_manager: "Менеджер по заявкам", manager_supervisor: "Руководитель менеджеров", supervisor: "Руководитель", technical_admin: "Технический администратор", readonly: "Только просмотр" }
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()

@Injectable()
export class WorkspaceService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async getProfile(actor: SessionUser): Promise<WorkspaceProfile> {
    assertCapability(actor.capabilities, "canView")
    return this.profile(await this.dataSource.getRepository(UserEntity).findOneBy({ id: actor.id }), actor)
  }

  async updateProfile(input: WorkspaceProfileUpdate, actor: SessionUser, requestId: string): Promise<WorkspaceProfile> {
    assertCapability(actor.capabilities, "canEdit")
    return this.dataSource.transaction(async (manager) => {
      const scope = "workspace-profile:update"
      const hash = JSON.stringify(input)
      const replay = await this.replay(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay as WorkspaceProfile
      const current = await manager.getRepository(UserEntity).findOneBy({ id: actor.id })
      if (!current) throw new NotFoundException({ code: "USER_NOT_FOUND", message: "Пользователь не найден" })
      if (current.version !== input.version) throw this.versionConflict(current)
      const before = this.profile(current, actor)
      const patch: Partial<UserEntity> = {
        ...(input.name === undefined ? {} : { displayName: input.name }), ...(input.email === undefined ? {} : { email: input.email.toLocaleLowerCase("ru-RU") }),
        ...(input.phone === undefined ? {} : { phone: input.phone }), ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
        ...(input.browserNotifications === undefined ? {} : { browserNotifications: input.browserNotifications }), ...(input.emailNotifications === undefined ? {} : { emailNotifications: input.emailNotifications }),
        ...(input.telegramNotifications === undefined ? {} : { telegramNotifications: input.telegramNotifications }), ...(input.notifyConflicts === undefined ? {} : { notifyConflicts: input.notifyConflicts }),
        ...(input.notifyNewLeads === undefined ? {} : { notifyNewLeads: input.notifyNewLeads }), ...(input.notifyOverdueTasks === undefined ? {} : { notifyOverdueTasks: input.notifyOverdueTasks }), updatedBy: actor.id,
      }
      const result = await manager.createQueryBuilder().update(UserEntity).set({ ...patch, version: () => '"version" + 1', updatedAt: () => "now()" }).where("id = :id AND version = :version", { id: actor.id, version: input.version }).execute()
      if (result.affected !== 1) throw this.versionConflict(await manager.getRepository(UserEntity).findOneByOrFail({ id: actor.id }))
      const saved = await manager.getRepository(UserEntity).findOneByOrFail({ id: actor.id })
      const after = this.profile(saved, actor)
      await this.recordMutation(manager, saved.id, "user_profile", "updated", actor.id, requestId, { before, after })
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, after)
      return after
    })
  }

  async listTeam(query: WorkspaceTeamListQuery, actor: SessionUser): Promise<TeamMember[]> {
    assertCapability(actor.capabilities, "canView")
    const userQuery = this.dataSource.getRepository(UserEntity).createQueryBuilder("user").orderBy("user.display_name", "ASC")
    if (!query.includeArchived) userQuery.andWhere("user.archived_at IS NULL AND user.status <> :archived", { archived: "archived" })
    const users = await userQuery.getMany()
    const openItems = await this.openItemCounts()
    const lastActive = await this.dataSource.query<Array<{ user_id: string; last_active_at: Date }>>(`SELECT user_id, max(last_seen_at) AS last_active_at FROM sessions GROUP BY user_id`)
    const lastActiveById = new Map(lastActive.map((row) => [row.user_id, row.last_active_at]))
    return users.map((user) => ({ id: user.id, version: user.version, name: user.displayName, email: user.email, phone: user.phone, initials: initials(user.displayName), role: roleLabels[user.role] ?? user.role, status: user.status === "invited" ? "invited" : user.status === "archived" || user.status === "blocked" ? "archived" : "active", openItems: openItems.get(user.id) ?? 0, lastActiveAt: lastActiveById.get(user.id)?.toISOString() ?? null, schedule: { status: "unconfigured" }, leave: { status: "unconfigured" } }))
  }

  async getSettings(actor: SessionUser): Promise<CrmSettings> {
    assertCapability(actor.capabilities, "canView")
    return this.settings(await this.ensureSettings(), actor)
  }

  async updateSettings(input: WorkspaceSettingsUpdate, actor: SessionUser, requestId: string): Promise<CrmSettings> {
    if (!actor.capabilities.canManageSettings) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для изменения настроек" })
    return this.dataSource.transaction(async (manager) => {
      const scope = "workspace-settings:update"
      const hash = JSON.stringify(input)
      const replay = await this.replay(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay as CrmSettings
      const current = await manager.getRepository(WorkspaceSettingsEntity).findOneBy({ id: settingsId }) ?? await this.createDefaultSettings(manager, actor.id)
      if (current.version !== input.version) throw this.settingsVersionConflict(current)
      const before = this.settings(current, actor)
      const organization = { ...current.organization, ...(input.organization ?? {}) }
      const operations = { ...current.operations, ...(input.operations ?? {}) }
      const site = { ...current.site, ...(input.site ?? {}), connectionStatus: "planned" }
      const integrations = this.normalizeIntegrations(current.integrations)
      const result = await manager.createQueryBuilder().update(WorkspaceSettingsEntity).set({ organization, operations, site, integrations, updatedBy: actor.id, version: () => '"version" + 1', updatedAt: () => "now()" }).where("id = :id AND version = :version", { id: settingsId, version: input.version }).execute()
      if (result.affected !== 1) throw this.settingsVersionConflict(await manager.getRepository(WorkspaceSettingsEntity).findOneByOrFail({ id: settingsId }))
      const saved = await manager.getRepository(WorkspaceSettingsEntity).findOneByOrFail({ id: settingsId })
      const after = this.settings(saved, actor)
      await this.recordMutation(manager, saved.id, "workspace_settings", "updated", actor.id, requestId, { before, after })
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, after)
      return after
    })
  }

  private profile(row: UserEntity | null, actor: SessionUser): WorkspaceProfile {
    if (!row) throw new NotFoundException({ code: "USER_NOT_FOUND", message: "Пользователь не найден" })
    return { id: row.id, version: row.version, name: row.displayName, email: row.email, phone: row.phone, role: roleLabels[row.role] ?? row.role, initials: initials(row.displayName), language: "ru", timezone: row.timezone, browserNotifications: row.browserNotifications, emailNotifications: row.emailNotifications, telegramNotifications: row.telegramNotifications, notifyConflicts: row.notifyConflicts, notifyNewLeads: row.notifyNewLeads, notifyOverdueTasks: row.notifyOverdueTasks, capabilities: actor.capabilities }
  }

  private async ensureSettings() {
    const existing = await this.dataSource.getRepository(WorkspaceSettingsEntity).findOneBy({ id: settingsId })
    if (existing) return existing
    return this.dataSource.transaction((manager) => this.createDefaultSettings(manager, null))
  }

  private async createDefaultSettings(manager: EntityManager, actorId: string | null) {
    const row = manager.create(WorkspaceSettingsEntity, { id: settingsId, organization: { currency: "RUB", email: "info@svistoplyasovo.ru", locale: "ru-RU", name: "Свистоплясово", phone: "+7 000 000-00-00", timezone: "Europe/Moscow" }, operations: { autoAssignNewLeads: false, bookingPrefix: "B", conflictWarnings: true, defaultLeadSource: "Сайт", requireClientPhone: true }, site: { connectionStatus: "planned", defaultAssigneeId: null, defaultSource: "Сайт", intakeEnabled: true, publishAggregatedAvailability: false, publishPrices: true, publishResources: true, siteUrl: "https://svistoplyasovo.ru" }, integrations: this.defaultIntegrations(), staffConfiguration: {}, createdBy: actorId, updatedBy: actorId, archivedAt: null })
    return manager.save(row)
  }

  private settings(row: WorkspaceSettingsEntity, actor: SessionUser): CrmSettings {
    const site = { ...row.site, connectionStatus: "planned" as const }
    return { id: row.id, version: row.version, organization: row.organization as CrmSettings["organization"], operations: row.operations as CrmSettings["operations"], site: site as CrmSettings["site"], integrations: this.normalizeIntegrations(row.integrations) as CrmSettings["integrations"], capabilities: { canView: actor.capabilities.canView, canEdit: actor.capabilities.canEdit, canManageSettings: actor.capabilities.canManageSettings } }
  }

  private defaultIntegrations() { return [{ id: "site", name: "Публичный сайт", description: "Формы и опубликованные данные", status: "planned", lastSyncAt: null }, { id: "cms", name: "CMS и публикации", description: "Контент, SEO и медиа", status: "planned", lastSyncAt: null }, { id: "telephony", name: "Телефония", description: "Звонки и записи разговоров", status: "attention", lastSyncAt: null }, { id: "analytics", name: "Веб-аналитика", description: "UTM и атрибуция заявок", status: "connected", lastSyncAt: null }] as Array<Record<string, unknown>> }
  private normalizeIntegrations(value: Array<Record<string, unknown>>) { return (value?.length ? value : this.defaultIntegrations()).map((item) => item.id === "site" || item.id === "cms" ? { ...item, status: "planned" } : item) }

  private async openItemCounts() {
    const rows = await this.dataSource.query<Array<{ assignee_id: string; count: string }>>(`
      SELECT assignee_id, count(*)::text AS count FROM (
        SELECT jsonb_array_elements(task.assignees)->>'id' AS assignee_id FROM tasks task WHERE task.archived_at IS NULL AND task.status <> 'done'
        UNION ALL SELECT jsonb_array_elements(lead.assignees)->>'id' FROM leads lead WHERE lead.archived_at IS NULL AND lead.status IN ('new','in_progress','waiting')
        UNION ALL SELECT jsonb_array_elements(booking.snapshot->'assignees')->>'id' FROM bookings booking WHERE booking.archived_at IS NULL AND booking.status NOT IN ('completed','cancelled','archived')
        UNION ALL SELECT jsonb_array_elements_text(occurrence.assignee_ids) FROM program_occurrences occurrence WHERE occurrence.archived_at IS NULL AND occurrence.status NOT IN ('completed','cancelled')
        UNION ALL SELECT jsonb_array_elements_text(event.assignee_ids) FROM events event WHERE event.archived_at IS NULL AND event.status NOT IN ('completed','cancelled')
      ) queues WHERE assignee_id IS NOT NULL GROUP BY assignee_id
    `)
    return new Map(rows.map((row) => [row.assignee_id, Number(row.count)]))
  }

  private versionConflict(user: UserEntity) { return new ConflictException({ code: "VERSION_CONFLICT", message: "Профиль был изменён другим сотрудником", details: { entityId: user.id, serverVersion: user.version } }) }
  private settingsVersionConflict(row: WorkspaceSettingsEntity) { return new ConflictException({ code: "VERSION_CONFLICT", message: "Настройки были изменены другим сотрудником", details: { entityId: row.id, serverVersion: row.version } }) }
  private async replay(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string) {
    const row = await manager.getRepository(IdempotencyKeyEntity).createQueryBuilder("key").where("key.scope = :scope", { scope }).andWhere(new Brackets((query) => query.where("key.operation_id = :operationId", { operationId }).orWhere("key.idempotency_key = :idempotencyKey", { idempotencyKey }))).getOne()
    if (!row) return null
    if (row.requestHash !== requestHash) throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Ключ идемпотентности уже использован с другими данными" })
    if (row.responseBody) return row.responseBody
    throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Операция уже выполняется" })
  }
  private async remember(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string, response: unknown) {
    await manager.getRepository(IdempotencyKeyEntity).save(manager.create(IdempotencyKeyEntity, { id: randomUUID(), scope, operationId, idempotencyKey, requestHash, responseStatus: 200, responseBody: response as Record<string, unknown>, createdAt: new Date() }))
  }
  private async recordMutation(manager: EntityManager, entityId: string, entityType: string, action: string, actorId: string, requestId: string, changes: Record<string, unknown>) {
    const now = new Date()
    await manager.getRepository(ChangeLogEntity).save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType, entityId, action, actorId, requestId, changes, createdAt: now }))
    await manager.getRepository(OutboxEventEntity).save(manager.create(OutboxEventEntity, { id: randomUUID(), topic: `${entityType}.${action}`, aggregateType: entityType, aggregateId: entityId, payload: { entityId, action }, availableAt: now, processedAt: null, attempts: 0, createdAt: now }))
  }
}
