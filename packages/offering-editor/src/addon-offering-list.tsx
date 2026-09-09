import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { IconAlertTriangle, IconPuzzle, IconSearch } from "@tabler/icons-react"

import type {
  AddOnOfferingListItem,
  AddOnOfferingListQuery,
} from "@crm/contracts"
import { Button, LoadingRows, PageState, StatusBadge } from "@crm/ui"

import { offeringEditorErrorMessage, type OfferingEditorGateway } from "./gateway.js"

export type AddOnUsageFilter = "all" | "used" | "unused"
type AddOnPriceReadiness = AddOnOfferingListItem["priceReadiness"]
export type AddOnPriceReadinessFilter = "all" | AddOnPriceReadiness

export type AddOnOfferingListFilters = Partial<Pick<
  AddOnOfferingListQuery,
  "categoryKey" | "limit" | "q" | "scope" | "serviceType" | "standalone" | "state"
>> & {
  priceReadiness?: AddOnPriceReadinessFilter
  usage?: AddOnUsageFilter
}

export type AddOnOfferingListProps = {
  filters?: AddOnOfferingListFilters
  gateway: Pick<OfferingEditorGateway, "listAddOns">
  onOpenOffering: (item: AddOnOfferingListItem) => void
}

const stateTone = { active: "success", archived: "neutral", draft: "warning", paused: "danger" } as const
const stateLabel = { active: "Активно", archived: "В архиве", draft: "Черновик", paused: "Приостановлено" } as const
const serviceTypeLabel = {
  content_only: "Информационная услуга",
  package_service: "Пакетная услуга",
  person_service: "На участника",
  quantity_service: "По количеству",
  scheduled_resource: "Ресурс по расписанию",
} as const
const scopeLabel = { offering_specific: "Для одного предложения", reusable: "Общая библиотека" } as const
const readinessLabel = { draft_only: "Цена в черновике", missing: "Цена не задана", not_sellable: "Только по заявке", ready: "Цена готова" } as const
const readinessTone = { draft_only: "warning", missing: "danger", not_sellable: "neutral", ready: "success" } as const

/** Route-neutral operational registry. Search and filter persistence remain host-owned. */
export function AddOnOfferingList({ filters, gateway, onOpenOffering }: AddOnOfferingListProps) {
  const [items, setItems] = useState<AddOnOfferingListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestSequence = useRef(0)

  const load = useCallback(async () => {
    const request = ++requestSequence.current
    setError(null)
    setItems(null)
    try {
      const response = await gateway.listAddOns({
        kind: "addon",
        limit: filters?.limit ?? 25,
        ...(filters?.q ? { q: filters.q } : {}),
        ...(filters?.state ? { state: filters.state } : {}),
        ...(filters?.serviceType ? { serviceType: filters.serviceType } : {}),
        ...(filters?.scope ? { scope: filters.scope } : {}),
        ...(filters?.categoryKey ? { categoryKey: filters.categoryKey } : {}),
        ...(filters?.standalone !== undefined ? { standalone: filters.standalone } : {}),
      })
      if (request === requestSequence.current) setItems(response.items)
    } catch (loadError) {
      if (request === requestSequence.current) setError(offeringEditorErrorMessage(loadError, "Не удалось загрузить дополнения и услуги."))
    }
  }, [filters, gateway])

  useEffect(() => { void load() }, [load])

  return <AddOnOfferingListView error={error} {...(filters ? { filters } : {})} items={items} onOpenOffering={onOpenOffering} onRetry={() => void load()} />
}

export function AddOnOfferingListView({ error, filters, items, onOpenOffering, onRetry }: {
  error: string | null
  filters?: AddOnOfferingListFilters
  items: AddOnOfferingListItem[] | null
  onOpenOffering: (item: AddOnOfferingListItem) => void
  onRetry: () => void
}) {

  const visibleItems = useMemo(() => (items ?? []).filter((item) => {
    if (filters?.priceReadiness && filters.priceReadiness !== "all" && item.priceReadiness !== filters.priceReadiness) return false
    if (filters?.usage === "used" && item.usageCount === 0) return false
    if (filters?.usage === "unused" && item.usageCount > 0) return false
    return true
  }), [filters?.priceReadiness, filters?.usage, items])
  const hasResultFilters = Boolean(filters?.priceReadiness && filters.priceReadiness !== "all") || Boolean(filters?.usage && filters.usage !== "all")
  const hasSearchOrFilters = Boolean(filters?.q || filters?.state || filters?.serviceType || filters?.scope || filters?.categoryKey || filters?.standalone !== undefined || hasResultFilters)

  if (items === null && error === null) return <div className="overflow-hidden rounded-xl border bg-background"><LoadingRows /></div>
  if (error) return <div className="rounded-xl border bg-background"><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={onRetry} title="Допы не загрузились" tone="danger">{error}</PageState></div>
  if (!items?.length) return <div className="rounded-xl border bg-background"><PageState icon={hasSearchOrFilters ? IconSearch : IconPuzzle} title={hasSearchOrFilters ? "Допы не найдены" : "Допов пока нет"}>{hasSearchOrFilters ? "Измените поиск или фильтры." : "Первый доп создаётся через operational API с валидным производственным календарём."}</PageState></div>
  if (!visibleItems.length) return <div className="rounded-xl border bg-background"><PageState icon={IconSearch} title="Нет результатов по готовности или использованию">Сбросьте фильтр цены или использования.</PageState></div>

  return <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3" data-slot="addon-offering-list">
    {visibleItems.map((item) => <article className="flex min-w-0 flex-col rounded-xl border bg-background p-4" key={item.offering.id}>
      <div className="flex min-w-0 items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info-subtle text-info-foreground"><IconPuzzle aria-hidden="true" className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.offering.operationalName}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{serviceTypeLabel[item.terms.serviceType]} · {item.terms.categoryKey}</p></div><StatusBadge tone={stateTone[item.offering.state]}>{stateLabel[item.offering.state]}</StatusBadge></div>
      <div className="mt-4 flex flex-wrap gap-1.5"><StatusBadge tone={readinessTone[item.priceReadiness]}>{readinessLabel[item.priceReadiness]}</StatusBadge><StatusBadge tone="neutral">В заказах: {item.usageCount}</StatusBadge>{item.offering.fulfillment.kind === "addon" && item.offering.fulfillment.standalone ? <StatusBadge tone="info">Можно отдельно</StatusBadge> : null}</div>
      <div className="mt-4 flex items-center gap-2 border-t pt-3"><p className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">{scopeLabel[item.offering.fulfillment.kind === "addon" ? item.offering.fulfillment.scope : "reusable"]}</p><Button aria-label={`Открыть ${item.offering.operationalName}`} onClick={() => onOpenOffering(item)} size="sm" variant="outline">Открыть</Button></div>
    </article>)}
  </div>
}
