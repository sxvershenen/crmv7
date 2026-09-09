import type {
  CrmSettings,
  TeamMember,
  WorkspaceProfile,
} from "@app/entities/workspace";
import {
  crmSettingsFixture,
  teamMembersFixture,
  workspaceProfileFixture,
} from "@app/fixtures/workspace";
import { apiClient } from "@app/lib/api-client";
import { useFixtureData } from "@app/lib/data-mode";
import { CrmSettingsSchema, TeamMemberSchema, WorkspaceProfileSchema, WorkspaceTeamListQuerySchema } from "@crm/contracts";

export type ApiWorkspaceRepositoryOptions = { client?: Pick<typeof apiClient, "get" | "patch"> };

export interface WorkspaceRepository {
  getProfile(): Promise<WorkspaceProfile>;
  getSettings(): Promise<CrmSettings>;
  listTeam(): Promise<TeamMember[]>;
  saveProfile(profile: WorkspaceProfile): Promise<WorkspaceProfile>;
  saveSettings(settings: CrmSettings): Promise<CrmSettings>;
}

export class FixtureWorkspaceRepository implements WorkspaceRepository {
  private profile = structuredClone(workspaceProfileFixture);
  private settings = structuredClone(crmSettingsFixture);
  private team = structuredClone(teamMembersFixture);

  async getProfile() {
    return Promise.resolve(structuredClone(this.profile));
  }

  async getSettings() {
    return Promise.resolve(structuredClone(this.settings));
  }

  async listTeam() {
    return Promise.resolve(structuredClone(this.team));
  }

  async saveProfile(profile: WorkspaceProfile) {
    this.profile = structuredClone(profile);
    return Promise.resolve(structuredClone(this.profile));
  }

  async saveSettings(settings: CrmSettings) {
    this.settings = structuredClone(settings);
    return Promise.resolve(structuredClone(this.settings));
  }
}

const operationId = () => typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `workspace-${Date.now()}`
const idempotencyKey = () => operationId()

function profileFromApi(value: import("@crm/contracts").WorkspaceProfile): WorkspaceProfile {
  return { id: value.id, version: value.version, name: value.name, email: value.email, phone: value.phone, role: value.role, initials: value.initials, language: value.language, timezone: value.timezone, browserNotifications: value.browserNotifications, emailNotifications: value.emailNotifications, telegramNotifications: value.telegramNotifications, notifyConflicts: value.notifyConflicts, notifyNewLeads: value.notifyNewLeads, notifyOverdueTasks: value.notifyOverdueTasks }
}

function teamFromApi(value: import("@crm/contracts").TeamMember[], index: number): TeamMember[] {
  return value.map((member, memberIndex) => ({
    id: member.id, version: member.version, name: member.name, email: member.email, phone: member.phone, initials: member.initials,
    role: member.role, status: member.status, openItems: member.openItems, colorClass: ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-rose-500"][((index + memberIndex) % 5)] ?? "bg-blue-500",
    lastActiveLabel: member.lastActiveAt ? new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(member.lastActiveAt)) : member.status === "invited" ? "Приглашение отправлено" : "Нет данных",
  }))
}

function settingsFromApi(value: import("@crm/contracts").CrmSettings): CrmSettings {
  return {
    id: value.id, version: value.version, canManageSettings: value.capabilities.canManageSettings, organization: value.organization, operations: value.operations,
    site: { ...value.site, defaultAssigneeId: value.site.defaultAssigneeId ?? "queue" },
    integrations: value.integrations.map((item) => ({ ...item, lastSyncLabel: item.lastSyncAt ? new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(new Date(item.lastSyncAt)) : item.status === "planned" ? "Запланировано" : "Нет синхронизации" })),
  }
}

export class ApiWorkspaceRepository implements WorkspaceRepository {
  private readonly client: Pick<typeof apiClient, "get" | "patch">
  constructor(options: ApiWorkspaceRepositoryOptions = {}) { this.client = options.client ?? apiClient }

  async getProfile() { return profileFromApi(await this.client.get("workspace/profile", WorkspaceProfileSchema)) }
  async getSettings() { return settingsFromApi(await this.client.get("workspace/settings", CrmSettingsSchema)) }
  async listTeam() {
    const query = WorkspaceTeamListQuerySchema.parse({ includeArchived: false })
    return teamFromApi(await this.client.get(`workspace/team?includeArchived=${query.includeArchived}`, TeamMemberSchema.array()), 0)
  }
  async saveProfile(profile: WorkspaceProfile) {
    const value = await this.client.patch("workspace/profile", { version: profile.version, name: profile.name, email: profile.email, phone: profile.phone, timezone: profile.timezone, browserNotifications: profile.browserNotifications, emailNotifications: profile.emailNotifications, telegramNotifications: profile.telegramNotifications, notifyConflicts: profile.notifyConflicts, notifyNewLeads: profile.notifyNewLeads, notifyOverdueTasks: profile.notifyOverdueTasks, operationId: operationId(), idempotencyKey: idempotencyKey() }, WorkspaceProfileSchema)
    return profileFromApi(value)
  }
  async saveSettings(settings: CrmSettings) {
    const value = await this.client.patch("workspace/settings", { version: settings.version, organization: settings.organization, operations: settings.operations, site: { defaultAssigneeId: settings.site.defaultAssigneeId && settings.site.defaultAssigneeId !== "queue" ? settings.site.defaultAssigneeId : null, defaultSource: settings.site.defaultSource, intakeEnabled: settings.site.intakeEnabled, publishAggregatedAvailability: settings.site.publishAggregatedAvailability, publishPrices: settings.site.publishPrices, publishResources: settings.site.publishResources, siteUrl: settings.site.siteUrl }, operationId: operationId(), idempotencyKey: idempotencyKey() }, CrmSettingsSchema)
    return settingsFromApi(value)
  }
}

export const fixtureWorkspaceRepository = new FixtureWorkspaceRepository()
export const apiWorkspaceRepository: WorkspaceRepository = new ApiWorkspaceRepository()
export const workspaceRepository: WorkspaceRepository = useFixtureData ? fixtureWorkspaceRepository : apiWorkspaceRepository
