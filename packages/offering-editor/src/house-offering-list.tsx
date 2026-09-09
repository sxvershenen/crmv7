import { useCallback, useEffect, useState } from "react"
import { IconAlertTriangle, IconHome, IconSearch, IconTent } from "@tabler/icons-react"

import type { CatalogOffering, HouseOfferingListQuery, StayOfferingListQuery } from "@crm/contracts"
import { Button, LoadingRows, PageState, StatusBadge } from "@crm/ui"

import {
  offeringEditorErrorMessage,
  type OfferingEditorGateway,
} from "./gateway.js"

export type HouseOfferingListProps = {
  gateway: Pick<OfferingEditorGateway, "listHouses">
  onOpenOffering: (offering: CatalogOffering) => void
  query?: Partial<Pick<HouseOfferingListQuery, "limit" | "q" | "state">>
}

export type CampgroundOfferingListProps = {
  gateway: Pick<OfferingEditorGateway, "listCampgrounds">
  onOpenOffering: (offering: CatalogOffering) => void
  query?: Partial<Pick<HouseOfferingListQuery, "limit" | "q" | "state">>
}

const stateTone = {
  active: "success",
  archived: "neutral",
  draft: "warning",
  paused: "danger",
} as const

const stateLabel = {
  active: "Активно",
  archived: "В архиве",
  draft: "Черновик",
  paused: "Приостановлено",
} as const

/** Shared list surface; the host owns routing and list-query persistence. */
export function HouseOfferingList({ gateway, onOpenOffering, query }: HouseOfferingListProps) {
  return <StayOfferingList kind="house" loadOfferings={(input) => gateway.listHouses({ ...input, kind: "house" })} onOpenOffering={onOpenOffering} {...(query ? { query } : {})} />
}

export function CampgroundOfferingList({ gateway, onOpenOffering, query }: CampgroundOfferingListProps) {
  return <StayOfferingList kind="campground" loadOfferings={(input) => gateway.listCampgrounds({ ...input, kind: "campground" })} onOpenOffering={onOpenOffering} {...(query ? { query } : {})} />
}

function StayOfferingList({ kind, loadOfferings, onOpenOffering, query }: {
  kind: "house" | "campground"
  loadOfferings: (input: StayOfferingListQuery) => Promise<{ items: CatalogOffering[]; nextCursor: string | null }>
  onOpenOffering: (offering: CatalogOffering) => void
  query?: Partial<Pick<HouseOfferingListQuery, "limit" | "q" | "state">>
}) {
  const [items, setItems] = useState<CatalogOffering[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const copy = kind === "campground"
    ? { empty: "Кемпингов пока нет", emptyAction: "Создайте кемпинг в операционном каталоге.", error: "Кемпинги не загрузились", noun: "кемпинги" }
    : { empty: "Домиков пока нет", emptyAction: "Создайте домик в операционном каталоге.", error: "Домики не загрузились", noun: "домики" }
  const ItemIcon = kind === "campground" ? IconTent : IconHome

  const load = useCallback(async () => {
    setError(null)
    setItems(null)
    try {
      const response = await loadOfferings({ kind, limit: 25, ...query })
      setItems(response.items)
    } catch (loadError) {
      setError(offeringEditorErrorMessage(loadError, `Не удалось загрузить ${kind === "campground" ? "кемпинги" : "домики"}.`))
    }
  }, [kind, loadOfferings, query])

  useEffect(() => { void load() }, [load])

  if (items === null && error === null) {
    return <div className="overflow-hidden rounded-xl border bg-background"><LoadingRows /></div>
  }
  if (error) {
    return <div className="rounded-xl border bg-background"><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={() => void load()} title={copy.error} tone="danger">{error}</PageState></div>
  }
  if (!items?.length) {
    return <div className="rounded-xl border bg-background"><PageState icon={query?.q ? IconSearch : ItemIcon} title={query?.q ? `Не нашли ${copy.noun}` : copy.empty}>{query?.q ? "Измените строку поиска." : copy.emptyAction}</PageState></div>
  }

  return <div className="divide-y overflow-hidden rounded-xl border bg-background" data-slot={`${kind}-offering-list`}>
    {items.map((offering) => (
      <div className="flex items-center gap-3 p-3" key={offering.id}>
        <ItemIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{offering.operationalName}</p>
          <p className="truncate text-xs text-muted-foreground">{offering.code} · {offering.currency} · {offering.timezone}</p>
        </div>
        <StatusBadge tone={stateTone[offering.state]}>{stateLabel[offering.state]}</StatusBadge>
        <Button aria-label={`Открыть ${offering.operationalName}`} onClick={() => onOpenOffering(offering)} size="sm" variant="outline">Открыть</Button>
      </div>
    ))}
  </div>
}
