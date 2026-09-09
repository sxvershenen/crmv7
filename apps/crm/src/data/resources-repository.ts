import type { Resource, ResourceDataset, ResourceEditorRecord, ResourceKind, ResourceQuery } from "@app/entities/resources"
import { resourcesFixture } from "@app/fixtures/resources"
import { apiClient, type ApiClientError } from "@app/lib/api-client"
import { useFixtureData } from "@app/lib/data-mode"
import { businessDateTimeToIso, toBusinessDateTimeInput } from "@app/lib/business-datetime"
import { ResourceAllocationDtoSchema, ResourceBlockDtoSchema, ResourceDtoSchema, ResourceCreateSchema, ResourceUpdateSchema } from "@crm/contracts"

const defaultResourceColors = { bath: "orange", camping: "green", houses: "blue", venues: "violet" } as const

export interface ResourceRepository {
  list(query: ResourceQuery): Promise<ResourceDataset>
}

export interface ResourceEditorRepository {
  get(id: string): Promise<ResourceEditorRecord | null>
  save(resource: ResourceEditorRecord): Promise<ResourceEditorRecord>
}

export type ApiResourceRepositoryOptions = { client?: Pick<typeof apiClient, "get" | "patch" | "post"> }

export function selectResources(data: Resource[], query: ResourceQuery): Resource[] {
  return data.filter((resource) => {
    if (resource.kind !== query.kind) return false
    if (query.block === "active" && !resource.hasActiveBlock) return false
    if (query.block === "none" && resource.hasActiveBlock) return false
    if (query.warning === "with" && resource.warning === null) return false
    return true
  })
}

export class FixtureResourceRepository implements ResourceRepository, ResourceEditorRepository {
  private data = structuredClone(resourcesFixture)
  private editorData = new Map<string, ResourceEditorRecord>()

  async list(query: ResourceQuery): Promise<ResourceDataset> {
    return Promise.resolve({ resources: selectResources(structuredClone(this.data), query) })
  }

  async get(id: string): Promise<ResourceEditorRecord | null> {
    const cached = this.editorData.get(id)
    if (cached) return Promise.resolve(structuredClone(cached))
    const resource = this.data.find((item) => item.id === id)
    if (!resource) return Promise.resolve(null)
    const editor = toEditorRecord(resource)
    this.editorData.set(id, editor)
    return Promise.resolve(structuredClone(editor))
  }

  async save(resource: ResourceEditorRecord): Promise<ResourceEditorRecord> {
    const next = structuredClone(resource)
    next.hasActiveBlock = next.blocks.some((block) => block.status === "active") || (next.hasActiveBlock && next.blocks.length === 0)
    this.editorData.set(next.id, next)
    const flat = toListResource(next)
    const index = this.data.findIndex((item) => item.id === next.id)
    if (index >= 0) this.data[index] = flat
    else this.data.unshift(flat)
    return Promise.resolve(structuredClone(next))
  }
}

function toEditorRecord(resource: Resource): ResourceEditorRecord {
  return {
    ...structuredClone(resource),
    active: true,
    blocks: [
      { id: `block-${resource.id}-current`, from: "2026-09-02T09:00", to: "2026-09-02T15:00", reason: resource.hasActiveBlock ? "Плановое техническое обслуживание" : "Плановое обслуживание — отменено", status: resource.hasActiveBlock ? "active" : "cancelled" },
      { id: `block-${resource.id}-cancelled`, from: "2026-08-18T12:00", to: "2026-08-18T16:00", reason: "Частное мероприятие — отменено", status: "cancelled" },
    ],
    cmsId: `cms-${resource.id}`,
    colorKey: defaultResourceColors[resource.kind],
    customIconDataUrl: "",
    customIconName: "",
    description: "Демонстрационное описание ресурса для проверки длинного текста, переносов и публикации на сайте.",
    monthlyLoadPercent: 68,
    rules: {
      availableDays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      bookingStepMinutes: "30",
      defaultCheckIn: "14:00",
      defaultCheckOut: "12:00",
      maxDurationMinutes: "10080",
      minDurationMinutes: "120",
      preparationAfterMinutes: "60",
      preparationBeforeMinutes: "30",
    },
    showOnSite: true,
    spaceType: resource.kind === "venues" ? "outdoor" : null,
  }
}

function toListResource(record: ResourceEditorRecord): Resource {
  const flat = structuredClone(record) as ResourceEditorRecord & Record<string, unknown>
  for (const key of ["active", "blocks", "cmsId", "colorKey", "customIconDataUrl", "customIconName", "description", "monthlyLoadPercent", "rules", "showOnSite", "spaceType"]) delete flat[key]
  return flat as unknown as Resource
}

export function createEmptyResource(kind: ResourceKind): ResourceEditorRecord {
  const resource = toEditorRecord({
    capacity: { mode: "fixed", total: 1 },
    futureBookingCount: 0,
    hasActiveBlock: false,
    iconKey: kind === "bath" ? "bath" : kind === "venues" ? "map" : kind === "camping" ? "tent" : "cottage",
    id: "new",
    kind,
    name: "Новый ресурс",
    nextAvailableFrom: null,
    nextBookingAt: null,
    permissions: { canEdit: true, canManageBlocks: true },
    secondaryType: "",
    warning: null,
  })
  if (useFixtureData || import.meta.env.MODE === "test") return resource
  return {
    ...resource,
    blocks: [],
    cmsId: "",
    description: "",
    monthlyLoadPercent: null,
    rules: {
      availableDays: [],
      bookingStepMinutes: "",
      defaultCheckIn: "",
      defaultCheckOut: "",
      maxDurationMinutes: "",
      minDurationMinutes: "",
      preparationAfterMinutes: "",
      preparationBeforeMinutes: "",
    },
    showOnSite: false,
  }
}

type VersionedEditor = ResourceEditorRecord & { version: number; apiCode: string }

const kindToApi = (kind: ResourceKind) => kind
const kindFromApi = (kind: string): ResourceKind => ({
  house: "houses", houses: "houses", venue: "venues", venues: "venues", bath: "bath",
  camping: "camping", campground: "camping", campground_owned_tent: "camping", campground_own_tent_area: "camping",
}[kind] as ResourceKind) ?? "houses"
const localDateTime = (value: string) => toBusinessDateTimeInput(value)

function mapBlock(block: ReturnType<typeof ResourceBlockDtoSchema.parse>): ResourceEditorRecord["blocks"][number] {
  return { id: block.id, from: localDateTime(block.startAt), to: localDateTime(block.endAt), reason: block.reason, status: block.status === "active" ? "active" : "cancelled" }
}

function mapResource(dto: ReturnType<typeof ResourceDtoSchema.parse>): VersionedEditor {
  const kind = kindFromApi(dto.kind)
  const resource: VersionedEditor = {
    id: dto.id, kind, name: dto.name, secondaryType: dto.secondaryType, iconKey: dto.iconKey,
    capacity: dto.capacity.mode === "shared" ? { mode: "shared", occupied: dto.capacity.occupied ?? 0, total: dto.capacity.total } : { mode: "fixed", total: dto.capacity.total },
    nextBookingAt: dto.nextBookingAt, nextAvailableFrom: dto.nextAvailableFrom, hasActiveBlock: dto.hasActiveBlock,
    futureBookingCount: dto.futureBookingCount, warning: dto.warning, permissions: dto.permissions,
    active: dto.active, blocks: dto.blocks.map(mapBlock), cmsId: dto.cmsId, colorKey: dto.colorKey,
    customIconDataUrl: dto.customIconDataUrl, customIconName: dto.customIconName, description: dto.description,
    monthlyLoadPercent: dto.monthlyLoadPercent, rules: dto.rules, showOnSite: dto.showOnSite,
    spaceType: dto.spaceType, version: dto.version, apiCode: dto.code,
  }
  return resource
}

function settingsFor(resource: ResourceEditorRecord) {
  return {
    active: resource.active, secondaryType: resource.secondaryType, iconKey: resource.iconKey, colorKey: resource.colorKey,
    customIconDataUrl: resource.customIconDataUrl, customIconName: resource.customIconName, description: resource.description,
    cmsId: resource.cmsId, showOnSite: resource.showOnSite, spaceType: resource.spaceType, rules: resource.rules,
  }
}

export class ApiResourceRepository implements ResourceRepository, ResourceEditorRepository {
  private readonly client: Pick<typeof apiClient, "get" | "patch" | "post">
  private readonly versions = new Map<string, number>()
  private readonly codes = new Map<string, string>()
  private readonly editors = new Map<string, VersionedEditor>()

  constructor(options: ApiResourceRepositoryOptions = {}) { this.client = options.client ?? apiClient }

  async list(query: ResourceQuery): Promise<ResourceDataset> {
    const params = new URLSearchParams({ kind: kindToApi(query.kind), archived: "false" })
    const rows = await this.client.get(`/resources?${params}`, ResourceDtoSchema.array())
    return { resources: selectResources(rows.map((row) => this.remember(mapResource(row))), query) }
  }

  async get(id: string): Promise<ResourceEditorRecord | null> {
    try {
      const dto = await this.client.get(`/resources/${encodeURIComponent(this.codes.get(id) ?? id)}`, ResourceDtoSchema)
      const mapped = this.remember(mapResource(dto))
      this.editors.set(mapped.id, structuredClone(mapped))
      return structuredClone(mapped)
    } catch (error) {
      if (error instanceof Error && "code" in error && ((error as ApiClientError).code === "NOT_FOUND" || (error as ApiClientError).status === 404)) return null
      throw error
    }
  }

  async save(resource: ResourceEditorRecord): Promise<ResourceEditorRecord> {
    if (resource.id === "new") {
      const created = await this.client.post("/resources", ResourceCreateSchema.parse({
        kind: kindToApi(resource.kind), name: resource.name, capacityMode: resource.capacity.mode,
        capacityTotal: resource.capacity.total, settings: settingsFor(resource),
      }), ResourceDtoSchema)
      const mapped = this.remember(mapResource(created))
      this.editors.set(mapped.id, structuredClone(mapped))
      return structuredClone(mapped)
    }
    const previous = this.editors.get(resource.id)
    const version = this.versions.get(resource.id)
    if (version === undefined) throw new Error("Версия ресурса неизвестна. Обновите редактор.")
    const dto = await this.client.patch(`/resources/${encodeURIComponent(this.codes.get(resource.id) ?? resource.id)}`, ResourceUpdateSchema.parse({
      version, kind: kindToApi(resource.kind), name: resource.name, capacityMode: resource.capacity.mode,
      capacityTotal: resource.capacity.total, settings: settingsFor(resource),
    }), ResourceDtoSchema)
    let current = this.remember(mapResource(dto))
    const previousBlocks = new Map((previous?.blocks ?? []).map((block) => [block.id, block]))
    for (const block of resource.blocks) {
      if (block.status === "active" && !previousBlocks.has(block.id)) {
        const created = await this.client.post(`/resources/${encodeURIComponent(current.apiCode)}/blocks`, {
          startAt: businessDateTimeToIso(block.from), endAt: businessDateTimeToIso(block.to), reason: block.reason,
          operationId: crypto.randomUUID(), expectedVersion: current.version,
        }, ResourceAllocationDtoSchema)
        void created
        current = (await this.get(resource.id) as VersionedEditor | null) ?? current
      }
    }
    for (const [id, old] of previousBlocks) {
      const next = resource.blocks.find((block) => block.id === id)
      if (old.status === "active" && next?.status === "cancelled") {
        await this.client.post(`/resources/${encodeURIComponent(current.apiCode)}/blocks/${encodeURIComponent(id)}/cancel`, { version: current.version, operationId: crypto.randomUUID() }, ResourceBlockDtoSchema)
        current = (await this.get(resource.id) as VersionedEditor | null) ?? current
      }
    }
    this.editors.set(current.id, structuredClone(current))
    return structuredClone(current)
  }

  private remember(resource: VersionedEditor) {
    this.versions.set(resource.id, resource.version)
    this.codes.set(resource.id, resource.apiCode)
    return resource
  }
}

export const fixtureResourceRepository: ResourceRepository & ResourceEditorRepository = new FixtureResourceRepository()
export const apiResourceRepository: ResourceRepository & ResourceEditorRepository = new ApiResourceRepository()
export const resourceRepository: ResourceRepository & ResourceEditorRepository = useFixtureData ? fixtureResourceRepository : apiResourceRepository
