export const resourceKinds = ["houses", "bath", "venues", "camping"] as const
export const resourceBlockFilters = ["all", "active", "none"] as const
export const resourceWarningFilters = ["all", "with"] as const
export const resourceActivityStatuses = ["active", "inactive"] as const
export const resourceColorKeys = ["blue", "orange", "violet", "green", "rose", "amber", "sky", "slate"] as const
export const resourceSpaceTypes = ["outdoor", "indoor", "mixed"] as const
export const resourceBlockStatuses = ["active", "cancelled"] as const
export const resourceWeekDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const

export type ResourceKind = (typeof resourceKinds)[number]
export type ResourceBlockFilter = (typeof resourceBlockFilters)[number]
export type ResourceWarningFilter = (typeof resourceWarningFilters)[number]
export type ResourceActivityStatus = (typeof resourceActivityStatuses)[number]
export type ResourceColorKey = (typeof resourceColorKeys)[number]
export type ResourceSpaceType = (typeof resourceSpaceTypes)[number]
export type ResourceBlockStatus = (typeof resourceBlockStatuses)[number]
export type ResourceWeekDay = (typeof resourceWeekDays)[number]

export type ResourceCapacity =
  | { mode: "fixed"; total: number }
  | { mode: "shared"; occupied: number; total: number }

export type ResourceWarning = {
  id: string
  message: string
}

export type ResourcePermissions = {
  canEdit: boolean
  canManageBlocks: boolean
}

export type Resource = {
  id: string
  kind: ResourceKind
  name: string
  secondaryType: string
  iconKey: string
  capacity: ResourceCapacity
  nextBookingAt: string | null
  nextAvailableFrom: string | null
  hasActiveBlock: boolean
  futureBookingCount: number
  warning: ResourceWarning | null
  permissions: ResourcePermissions
}

export type ResourceQuery = {
  kind: ResourceKind
  block: ResourceBlockFilter
  warning: ResourceWarningFilter
}

export type ResourceDataset = {
  resources: Resource[]
}

export type ResourceEditorBlock = {
  id: string
  from: string
  to: string
  reason: string
  status: ResourceBlockStatus
}

export type ResourceEditorRules = {
  availableDays: ResourceWeekDay[]
  bookingStepMinutes: string
  defaultCheckIn: string
  defaultCheckOut: string
  maxDurationMinutes: string
  minDurationMinutes: string
  preparationAfterMinutes: string
  preparationBeforeMinutes: string
}

export type ResourceEditorRecord = Resource & {
  active: boolean
  blocks: ResourceEditorBlock[]
  cmsId: string
  colorKey: ResourceColorKey
  customIconDataUrl: string
  customIconName: string
  description: string
  monthlyLoadPercent: number | null
  rules: ResourceEditorRules
  showOnSite: boolean
  spaceType: ResourceSpaceType | null
}

export const resourceKindLabels: Record<ResourceKind, string> = {
  houses: "Домики",
  bath: "Баня и чан",
  venues: "Площадки",
  camping: "Кемпинг",
}

export const resourceActivityStatusLabels: Record<ResourceActivityStatus, string> = {
  active: "Активен",
  inactive: "Неактивен",
}

export const resourceSpaceTypeLabels: Record<ResourceSpaceType, string> = {
  outdoor: "Открытый",
  indoor: "В помещении",
  mixed: "Смешанный",
}

export const resourceWeekDayLabels: Record<ResourceWeekDay, string> = {
  mon: "Пн",
  tue: "Вт",
  wed: "Ср",
  thu: "Чт",
  fri: "Пт",
  sat: "Сб",
  sun: "Вс",
}

export function isResourceKind(value: string | undefined): value is ResourceKind {
  return resourceKinds.includes(value as ResourceKind)
}
