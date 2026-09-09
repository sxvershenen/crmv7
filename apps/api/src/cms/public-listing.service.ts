import { BadRequestException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common"
import { DataSource } from "typeorm"

import {
  ListingDefinitionSchema,
  PublicCardProjectionSchema,
  PublicListingResultSchema,
  PublicReleasePageContentSchema,
  type ListingDefinition,
  type PublicCardProjection,
  type PublicListingQuery,
  type PublicListingResult,
} from "@crm/contracts"
import { resolvedContentHash } from "./public-content.service.js"

type ListingPageRow = {
  releaseId: string
  releaseCreatedAt: Date
  releasePublishedAt: Date | null
  resolvedContent: unknown
  resolvedContentHash: string
}

type ListingItemRow = {
  sourceKind: string
  sourceId: string
  path: string
  resolvedContent: unknown
  resolvedContentHash: string
  resourceKind: string | null
  resourceCapacity: number | null
  resourceSettings: Record<string, unknown> | null
  programCategoryId: string | null
  programDuration: number | null
  programCapacity: number | null
  programPrice: number | null
  programCurrency: string | null
}

type Scalar = string | number | boolean | null

const FIELDS = {
  resource: new Set(["title", "kind", "capacity", "spaceType", "secondaryType"]),
  program: new Set(["title", "categoryId", "durationMinutes", "capacity", "priceFrom"]),
} as const

@Injectable()
export class PublicListingService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async resolve(query: PublicListingQuery): Promise<PublicListingResult> {
    const page = await this.listingPage(query.path)
    const content = PublicReleasePageContentSchema.safeParse(page.resolvedContent)
    if (!content.success || content.data.path !== query.path || resolvedContentHash(page.resolvedContent) !== page.resolvedContentHash) throw this.invalidRelease()
    const listingSection = content.data.sections.find((section) => section.renderer === "listing")
    const rawDefinition = listingSection?.config.definition ?? listingSection?.config
    const parsedDefinition = ListingDefinitionSchema.safeParse(rawDefinition)
    if (!listingSection || !parsedDefinition.success) throw this.invalidRelease("У страницы каталога нет корректного ListingDefinition")
    const definition = parsedDefinition.data
    if (definition.entityKind !== "resource" && definition.entityKind !== "program") {
      throw new ServiceUnavailableException({ code: "LISTING_KIND_UNAVAILABLE", message: "Этот тип публичного каталога ещё не подключён" })
    }
    const entityKind = definition.entityKind
    this.validateDefinition(definition)
    const appliedFilters = this.validateQuery(definition, query)
    const sortId = query.sort ?? definition.defaultSortId
    const rows = await this.listingItems(page.releaseId, entityKind)
    const cards = rows.map((row) => this.card(row, entityKind)).filter((card): card is PublicCardProjection => card !== null)
    const filtered = cards.filter((card) => this.matches(card, definition, appliedFilters))
    filtered.sort(this.comparator(definition, sortId))
    const totalItems = filtered.length
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / definition.pageSize)
    if ((totalPages > 0 && query.page > totalPages) || (totalPages === 0 && query.page > 1)) this.badQuery("page", "Страница вне диапазона")
    const start = (query.page - 1) * definition.pageSize
    return PublicListingResultSchema.parse({
      definition,
      items: filtered.slice(start, start + definition.pageSize),
      page: query.page,
      totalPages,
      totalItems,
      appliedFilters,
      sortId,
      canonicalPath: query.path,
      robots: Object.keys(appliedFilters).length || query.sort !== null || query.page > 1 ? "noindex_follow" : "index_follow",
      releaseId: page.releaseId,
      asOf: (page.releasePublishedAt ?? page.releaseCreatedAt).toISOString(),
    })
  }

  private async listingPage(path: string): Promise<ListingPageRow> {
    const rows = await this.dataSource.query(`
      SELECT release.id AS "releaseId", release.created_at AS "releaseCreatedAt",
        release.published_at AS "releasePublishedAt", item.resolved_content AS "resolvedContent",
        item.resolved_content_hash AS "resolvedContentHash"
      FROM cms_active_release active
      JOIN cms_releases release ON release.id = active.release_id AND release.state = 'published'
      JOIN cms_release_items item ON item.release_id = release.id AND item.path = $1
      WHERE active.singleton_key = 'public'
      LIMIT 1
    `, [path]) as ListingPageRow[]
    if (!rows[0]) throw new NotFoundException({ code: "NOT_FOUND", message: "Опубликованный каталог не найден" })
    return rows[0]
  }

  private async listingItems(releaseId: string, kind: "resource" | "program"): Promise<ListingItemRow[]> {
    const sourceKind = kind === "resource" ? "resource" : "program_template"
    return this.dataSource.query(`
      SELECT link.source_kind AS "sourceKind", link.source_id AS "sourceId", item.path,
        item.resolved_content AS "resolvedContent", item.resolved_content_hash AS "resolvedContentHash",
        resource.kind AS "resourceKind", resource.capacity_total AS "resourceCapacity", resource.settings AS "resourceSettings",
        program.category_id AS "programCategoryId", program.duration_minutes AS "programDuration",
        program.participant_limit AS "programCapacity", program.base_price_amount AS "programPrice",
        program.currency AS "programCurrency"
      FROM cms_release_items item
      JOIN cms_source_links link ON link.node_id = item.node_id AND link.source_kind = $2
      LEFT JOIN resources resource ON $2 = 'resource' AND resource.id = link.source_id
        AND resource.archived_at IS NULL AND resource.settings->>'showOnSite' = 'true'
      LEFT JOIN program_templates program ON $2 = 'program_template' AND program.id = link.source_id
        AND program.archived_at IS NULL AND program.publication = 'published'
      WHERE item.release_id = $1
        AND (($2 = 'resource' AND resource.id IS NOT NULL) OR ($2 = 'program_template' AND program.id IS NOT NULL))
      ORDER BY item.path, link.source_id
    `, [releaseId, sourceKind]) as Promise<ListingItemRow[]>
  }

  private card(row: ListingItemRow, kind: "resource" | "program"): PublicCardProjection | null {
    const content = PublicReleasePageContentSchema.safeParse(row.resolvedContent)
    if (!content.success || content.data.path !== row.path || resolvedContentHash(row.resolvedContent) !== row.resolvedContentHash) return null
    const hero = content.data.hero
    const image = hero?.background ?? hero?.foreground ?? hero?.slides[0]?.image ?? null
    const settings = row.resourceSettings ?? {}
    const attributes: Record<string, Scalar> = kind === "resource" ? {
      kind: row.resourceKind,
      capacity: row.resourceCapacity,
      spaceType: scalar(settings.spaceType),
      secondaryType: scalar(settings.secondaryType),
    } : {
      categoryId: row.programCategoryId,
      durationMinutes: row.programDuration,
      capacity: row.programCapacity,
    }
    return PublicCardProjectionSchema.parse({
      id: row.sourceId,
      kind,
      title: content.data.title,
      summary: content.data.summary,
      hero,
      href: row.path,
      image,
      priceFrom: kind === "program" && row.programPrice !== null
        ? { amountMinor: row.programPrice, currency: row.programCurrency ?? "RUB" }
        : null,
      attributes,
    })
  }

  private validateDefinition(definition: ListingDefinition) {
    const allowed = FIELDS[definition.entityKind as "resource" | "program"]
    const filterIds = new Set(definition.filters.map((filter) => filter.id))
    const urlKeys = new Set(definition.filters.map((filter) => filter.urlKey))
    if (filterIds.size !== definition.filters.length || urlKeys.size !== definition.filters.length) throw this.invalidRelease("Фильтры каталога должны иметь уникальные id и URL keys")
    if (definition.filters.some((filter) => !allowed.has(filter.field))) throw this.invalidRelease("ListingDefinition использует недоступное публичное поле")
    if (definition.sorts.some((sort) => !allowed.has(sort.field))) throw this.invalidRelease("ListingDefinition использует недоступную сортировку")
    if (definition.defaultSortId && !definition.sorts.some((sort) => sort.id === definition.defaultSortId)) throw this.invalidRelease("Default sort отсутствует в ListingDefinition")
  }

  private validateQuery(definition: ListingDefinition, query: PublicListingQuery): Record<string, string> {
    const filtersByKey = new Map(definition.filters.map((filter) => [filter.urlKey, filter]))
    const applied: Record<string, string> = {}
    for (const [key, raw] of Object.entries(query.filters)) {
      if (!raw) continue
      const filter = filtersByKey.get(key)
      if (!filter) this.badQuery(key, "Неизвестный параметр фильтра")
      const normalized = filter.normalization === "lowercase" ? raw.toLocaleLowerCase("ru-RU") : raw
      const values = normalized.split(",").filter(Boolean)
      if (filter.control !== "multiselect" && values.length > 1) this.badQuery(key, "Фильтр принимает одно значение")
      if (filter.options) {
        const options = new Set(filter.options.map((option) => String(option.value)))
        if (values.some((value) => !options.has(value))) this.badQuery(key, "Недопустимое значение фильтра")
      }
      if (filter.valueType === "number" || filter.normalization === "integer") {
        const numericValues = filter.operators.includes("range") ? normalized.split("..").filter(Boolean) : values
        if (numericValues.length > 2 || numericValues.some((value) => !Number.isFinite(Number(value)))) this.badQuery(key, "Ожидалось число или диапазон min..max")
      }
      if (filter.valueType === "boolean" && values.some((value) => value !== "true" && value !== "false")) this.badQuery(key, "Ожидалось true или false")
      applied[key] = normalized
    }
    if (query.sort && !definition.sorts.some((sort) => sort.id === query.sort)) this.badQuery("sort", "Неизвестная сортировка")
    return Object.fromEntries(Object.entries(applied).sort(([left], [right]) => left.localeCompare(right)))
  }

  private matches(card: PublicCardProjection, definition: ListingDefinition, applied: Record<string, string>): boolean {
    return definition.filters.every((filter) => {
      const raw = applied[filter.urlKey]
      if (!raw) return true
      const actual = this.field(card, filter.field)
      const values = raw.split(",")
      const operators = new Set(filter.operators)
      if (operators.has("contains")) return String(actual ?? "").toLocaleLowerCase("ru-RU").includes(raw.toLocaleLowerCase("ru-RU"))
      if (operators.has("range")) {
        const [min, max] = raw.split("..")
        const numeric = Number(actual)
        return Number.isFinite(numeric) && (!min || numeric >= Number(min)) && (!max || numeric <= Number(max))
      }
      if (operators.has("gte")) return Number(actual) >= Number(raw)
      if (operators.has("lte")) return Number(actual) <= Number(raw)
      if (operators.has("in") || values.length > 1) return values.includes(String(actual))
      return String(actual) === raw
    })
  }

  private comparator(definition: ListingDefinition, sortId: string | null) {
    const sort = definition.sorts.find((candidate) => candidate.id === sortId)
    return (left: PublicCardProjection, right: PublicCardProjection) => {
      const leftValue = sort ? this.field(left, sort.field) : left.title
      const rightValue = sort ? this.field(right, sort.field) : right.title
      const compared = compareScalar(leftValue, rightValue)
      const directed = sort?.direction === "desc" ? -compared : compared
      return directed || left.id.localeCompare(right.id)
    }
  }

  private field(card: PublicCardProjection, field: string): Scalar {
    if (field === "title") return card.title
    if (field === "priceFrom") return card.priceFrom?.amountMinor ?? null
    return card.attributes[field] ?? null
  }

  private badQuery(field: string, message: string): never {
    throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Проверьте параметры каталога", fieldErrors: { [field]: [message] }, details: {} })
  }

  private invalidRelease(message = "Опубликованная версия каталога требует повторной публикации") {
    return new ServiceUnavailableException({ code: "CMS_RELEASE_INVALID", message })
  }
}

function scalar(value: unknown): Scalar {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : null
}

function compareScalar(left: Scalar, right: Scalar): number {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  if (typeof left === "number" && typeof right === "number") return left - right
  return String(left).localeCompare(String(right), "ru-RU", { numeric: true, sensitivity: "base" })
}
