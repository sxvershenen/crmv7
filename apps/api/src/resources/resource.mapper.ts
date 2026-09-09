import type { SessionUser, ResourceSettings } from "@crm/contracts"
import { ResourceSettingsSchema } from "@crm/contracts"
import type { ResourceAllocationEntity, ResourceEntity } from "@crm/db"

import type { ResourceDto, ResourceReadModel } from "./resources.contracts.js"

const defaultIcons: Record<string, string> = { bath: "bath", camping: "tent", campground: "tent", campground_owned_tent: "tent", campground_own_tent_area: "tent", houses: "cottage", house: "cottage", venues: "map" }
const defaultColors: Record<string, ResourceReadModel["colorKey"]> = { bath: "orange", camping: "green", campground: "green", campground_owned_tent: "green", campground_own_tent_area: "green", houses: "blue", house: "blue", venues: "violet" }
const defaultRules: ResourceReadModel["rules"] = {
  availableDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], bookingStepMinutes: "", defaultCheckIn: "",
  defaultCheckOut: "", maxDurationMinutes: "", minDurationMinutes: "", preparationAfterMinutes: "", preparationBeforeMinutes: "",
}

export function resourceCapabilities(actor: SessionUser) {
  return {
    canView: actor.capabilities.canView,
    canCreate: actor.capabilities.canCreate,
    canEdit: actor.capabilities.canEdit,
    canArchive: actor.capabilities.canArchive,
    canOverrideConflict: actor.capabilities.canOverrideConflict,
  }
}

function settingsOf(resource: ResourceEntity): ResourceSettings {
  const parsed = ResourceSettingsSchema.safeParse(resource.settings ?? {})
  return parsed.success ? parsed.data : {}
}

export function toResourceDto(resource: ResourceEntity, actor: SessionUser, allocations: ResourceAllocationEntity[] = []): ResourceDto {
  const settings = settingsOf(resource)
  const now = Date.now()
  const operational = allocations.filter((item) => item.sourceType !== "resource_block" && item.status !== "cancelled" && item.archivedAt === null)
  const blocks = allocations.filter((item) => item.sourceType === "resource_block").map((item) => ({
    id: item.id, resourceId: item.resourceId, sourceType: "resource_block" as const, sourceId: item.sourceId,
    startAt: item.startAt.toISOString(), endAt: item.endAt.toISOString(), quantity: item.quantity,
    capacityImpact: item.capacityImpact, status: item.status as "tentative" | "active" | "cancelled", version: item.version,
    reason: settings.blockMetadata?.[item.id]?.reason ?? settings.blockMetadata?.[item.sourceId]?.reason ?? "",
  }))
  const future = operational.filter((item) => new Date(item.startAt).getTime() >= now).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  const current = operational.filter((item) => new Date(item.startAt).getTime() < now && new Date(item.endAt).getTime() > now)
  const activeBlocks = blocks.some((item) => item.status === "active" && new Date(item.endAt).getTime() > now)
  const nextAvailable = [...operational, ...blocks.filter((item) => item.status === "active")]
    .filter((item) => new Date(item.endAt).getTime() > now).sort((a, b) => new Date(a.endAt).getTime() - new Date(b.endAt).getTime())[0]?.endAt ?? null
  const capacity = resource.capacityMode === "shared"
    ? { mode: "shared" as const, occupied: current.reduce((sum, item) => sum + item.capacityImpact, 0), total: resource.capacityTotal }
    : { mode: "fixed" as const, total: resource.capacityTotal }
  const readModel = {
    active: settings.active ?? resource.archivedAt === null,
    secondaryType: settings.secondaryType ?? "",
    iconKey: settings.iconKey ?? defaultIcons[resource.kind] ?? "resource",
    capacity,
    nextBookingAt: future[0] ? new Date(future[0].startAt).toISOString() : null,
    nextAvailableFrom: nextAvailable ? new Date(nextAvailable).toISOString() : null,
    hasActiveBlock: activeBlocks,
    futureBookingCount: future.length,
    warning: null,
    permissions: { canEdit: actor.capabilities.canEdit, canManageBlocks: actor.capabilities.canEdit },
    monthlyLoadPercent: settings.monthlyLoadPercent ?? null,
    cmsId: settings.cmsId ?? "",
    colorKey: settings.colorKey ?? defaultColors[resource.kind] ?? "slate",
    customIconDataUrl: settings.customIconDataUrl ?? "",
    customIconName: settings.customIconName ?? "",
    description: settings.description ?? "",
    rules: settings.rules ?? defaultRules,
    showOnSite: settings.showOnSite ?? false,
    spaceType: settings.spaceType ?? null,
    blocks,
  } satisfies ResourceReadModel
  return {
    id: resource.id,
    code: resource.code,
    version: resource.version,
    kind: resource.kind,
    name: resource.name,
    capacityMode: resource.capacityMode as ResourceDto["capacityMode"],
    capacityTotal: resource.capacityTotal,
    settings,
    archived: resource.archivedAt !== null,
    createdAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt.toISOString(),
    capabilities: resourceCapabilities(actor),
    ...readModel,
  }
}
