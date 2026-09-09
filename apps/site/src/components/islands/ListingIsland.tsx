import { useState } from "react"

import type { ListingFilterDefinition, PublicCardProjection, PublicListingResult } from "@crm/contracts"
import {
  CatalogCard,
  EmptyState,
  Grid,
  ListingFilterBar,
  Pagination,
  SectionHeading,
  Stack,
  type FilterDefinition,
  type ResponsiveMediaProps,
} from "@crm/site-ui"

interface ListingIslandProps {
  listing: PublicListingResult
  title?: string | undefined
  description?: string | null
}

export default function ListingIsland({ description, listing, title }: ListingIslandProps) {
  const [filters, setFilters] = useState<Record<string, string>>(listing.appliedFilters)
  const [sort, setSort] = useState(listing.sortId ?? "")
  const controls = listing.definition.filters.map((definition) => control(definition, filters[definition.urlKey] ?? ""))
  const navigate = (nextFilters: Record<string, string>, nextSort: string, page = 1) => {
    window.location.assign(href(listing.canonicalPath, nextFilters, nextSort, page, listing.definition.defaultSortId))
  }
  const attributes = (card: PublicCardProjection) => attributeLabels(card)

  return <section className="site-section" aria-labelledby="listing-title">
    <Stack gap="var(--site-space-6)">
      {title ? <SectionHeading level={1} title={title} description={description} id="listing-title" /> : null}
      <ListingFilterBar
        filters={controls}
        activeCount={Object.values(filters).filter(Boolean).length}
        onFilterChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
        onApply={() => navigate(filters, sort)}
        onReset={() => navigate({}, "")}
        {...(listing.definition.sorts.length ? { sort: {
          label: "Сортировка",
          value: sort,
          onChange: (event) => setSort(event.target.value),
          options: [
            ...(listing.definition.defaultSortId ? [] : [{ value: "", label: "По умолчанию" }]),
            ...listing.definition.sorts.map((option) => ({ value: option.id, label: option.label })),
          ],
        } } : {})}
      />
      <p className="site-type-caption" role="status">Найдено: {listing.totalItems}</p>
      {listing.items.length ? <Grid columns={1} desktopColumns={3}>
        {listing.items.map((card) => {
          const cardMedia = media(card)
          return <CatalogCard
            key={card.id}
            href={card.href}
            analyticsId={`listing:${listing.definition.id}:${card.id}`}
            title={card.title}
            eyebrow={kindLabel(card.kind)}
            attributes={attributes(card)}
            {...(card.summary ? { description: card.summary } : {})}
            {...(cardMedia ? { media: cardMedia } : {})}
            {...(card.priceFrom ? { price: money(card.priceFrom.amountMinor, card.priceFrom.currency) } : {})}
          />
        })}
      </Grid> : <EmptyState title="Ничего не найдено" description="Измените или сбросьте фильтры каталога." />}
      {listing.totalPages > 1 ? <Pagination current={listing.page} total={listing.totalPages} hrefForPage={(page) => href(listing.canonicalPath, listing.appliedFilters, listing.sortId ?? "", page, listing.definition.defaultSortId)} /> : null}
    </Stack>
  </section>
}

function control(definition: ListingFilterDefinition, value: string): FilterDefinition {
  const options = definition.options?.map((option) => ({ value: String(option.value), label: option.label }))
    ?? (definition.valueType === "boolean" ? [{ value: "true", label: "Да" }, { value: "false", label: "Нет" }] : [])
  return {
    key: definition.urlKey,
    label: definition.label,
    value,
    options,
    control: definition.control === "search" ? "search" : definition.control === "range" || definition.control === "date_range" ? "range" : "select",
    ...(definition.control === "range" ? { placeholder: "Например, 2..8" } : {}),
  }
}

function href(path: string, filters: Record<string, string>, sort: string, page: number, defaultSort: string | null) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters).sort(([left], [right]) => left.localeCompare(right))) if (value) query.set(key, value)
  if (sort && sort !== defaultSort) query.set("sort", sort)
  if (page > 1) query.set("page", String(page))
  const serialized = query.toString()
  return serialized ? `${path}?${serialized}` : path
}

function media(card: PublicCardProjection): ResponsiveMediaProps | undefined {
  if (!card.image) return undefined
  const variants = [...card.image.variants].sort((left, right) => (right.width ?? 0) - (left.width ?? 0))
  const fallback = variants.find((variant) => variant.format === "webp") ?? variants[0]
  if (!fallback) return undefined
  const grouped = new Map<string, typeof variants>()
  for (const variant of variants) grouped.set(variant.format, [...(grouped.get(variant.format) ?? []), variant])
  return {
    src: fallback.url,
    alt: card.image.alt ?? card.title,
    width: fallback.width ?? 1200,
    height: fallback.height ?? 800,
    loading: "lazy",
    sources: ["avif", "webp"].flatMap((format) => {
      const items = grouped.get(format) ?? []
      if (!items.length) return []
      return [{ type: `image/${format}` as "image/avif" | "image/webp", srcSet: items.map((item) => `${item.url}${item.width ? ` ${item.width}w` : ""}`).join(", ") }]
    }),
  }
}

function attributeLabels(card: PublicCardProjection): string[] {
  const labels: string[] = []
  const capacity = card.attributes.capacity
  if (typeof capacity === "number") labels.push(`до ${capacity} гостей`)
  const duration = card.attributes.durationMinutes
  if (typeof duration === "number") labels.push(`${duration} мин.`)
  const secondary = card.attributes.secondaryType
  if (typeof secondary === "string" && secondary) labels.push(secondary)
  return labels
}

function kindLabel(kind: PublicCardProjection["kind"]) {
  return kind === "resource" ? "Площадка" : kind === "program" ? "Программа" : "Предложение"
}

function money(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 }).format(amountMinor / 100)
}
