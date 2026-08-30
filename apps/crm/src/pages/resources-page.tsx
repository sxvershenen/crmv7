import { useMemo } from "react"
import { IconAlertTriangle, IconFilter } from "@tabler/icons-react"
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"

import { LoadingRows, PageFrame, PageState } from "@crm/ui"

import { ResourceCategoryNav } from "@app/components/resources/resource-category-nav"
import { ResourceControls } from "@app/components/resources/resource-controls"
import { ResourcesGrid } from "@app/components/resources/resources-grid"
import { resourceRepository, type ResourceRepository } from "@app/data/resources-repository"
import type { Resource, ResourceBlockFilter, ResourceQuery, ResourceWarningFilter } from "@app/entities/resources"
import { isResourceKind, resourceBlockFilters, resourceWarningFilters } from "@app/entities/resources"
import { useResources } from "@app/features/use-resources"

function oneOf<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return value && options.includes(value as T) ? value as T : fallback
}

export function ResourcesPage({ repository = resourceRepository }: { repository?: ResourceRepository }) {
  const { kind } = useParams()
  const location = useLocation()

  if (!isResourceKind(kind)) return <Navigate replace to={`/resources/houses${location.search}`} />
  return <ResourcesScreen kind={kind} repository={repository} />
}

function ResourcesScreen({ kind, repository }: { kind: ResourceQuery["kind"]; repository: ResourceRepository }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const block = oneOf(searchParams.get("block"), resourceBlockFilters, "all")
  const warning = oneOf(searchParams.get("warning"), resourceWarningFilters, "all")
  const query = useMemo<ResourceQuery>(() => ({ block, kind, warning }), [block, kind, warning])
  const { retry, state } = useResources(query, repository)

  const setFilter = (name: "block" | "warning", value: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (value === "all") next.delete(name)
      else next.set(name, value)
      return next
    })
  }
  const resetFilters = () => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    next.delete("block")
    next.delete("warning")
    return next
  })
  const openResource = (resource: Resource) => navigate(`/resources/${resource.kind}/${resource.id}`)
  const blockResource = (resource: Resource) => navigate(`/resources/${resource.kind}/${resource.id}?tab=blocks`)

  return (
    <PageFrame className="space-y-3" width="wide">
      <ResourceCategoryNav value={kind} />
      <ResourceControls
        block={block}
        onBlockChange={(value: ResourceBlockFilter) => setFilter("block", value)}
        onWarningChange={(value: ResourceWarningFilter) => setFilter("warning", value)}
        warning={warning}
      />

      {state.status === "loading" ? <div className="rounded-xl border bg-surface-raised"><LoadingRows /></div> : null}
      {state.status === "error" ? (
        <div className="rounded-xl border bg-surface-raised">
          <PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={retry} title="Ресурсы не загрузились" tone="danger">{state.message}</PageState>
        </div>
      ) : null}
      {state.status === "ready" && state.data.resources.length === 0 ? (
        <div className="rounded-xl border bg-surface-raised">
          <PageState actionLabel="Сбросить фильтры" icon={IconFilter} onAction={resetFilters} title="Ресурсы не найдены">Измените состояние блокировки или фильтр предупреждений.</PageState>
        </div>
      ) : null}
      {state.status === "ready" && state.data.resources.length > 0 ? <ResourcesGrid onBlock={blockResource} onOpen={openResource} resources={state.data.resources} /> : null}
    </PageFrame>
  )
}
