import { useMemo } from "react"
import { IconAlertTriangle, IconCategory } from "@tabler/icons-react"

import { LoadingRows, PageFrame, PageState } from "@crm/ui"

import { CreateCategoryAction, ProgramCategoriesGrid } from "@app/components/programs/program-categories"
import { programsRepository, type ProgramsRepository } from "@app/data/programs-repository"
import type { ProgramQuery } from "@app/entities/programs"
import { usePrograms } from "@app/features/use-programs"

export function ProgramCategoriesPage({ repository = programsRepository }: { repository?: ProgramsRepository }) {
  const query = useMemo<ProgramQuery>(() => ({ category: "all", date: "2026-08-24", rangeEnd: "2026-08-30", section: "templates", sort: { direction: "asc", key: "name" }, status: "all" }), [])
  const { retry, state } = usePrograms(query, repository)
  return (
    <PageFrame className="space-y-3" width="wide">
      <div className="flex min-h-9 items-center justify-between gap-3 border-b pb-2"><div><p className="text-sm font-semibold">Категории программ</p><p className="text-[11px] text-muted-foreground">Иконка и цвет помогают отличать тип программы.</p></div><CreateCategoryAction /></div>
      {state.status === "loading" ? <div className="rounded-xl border bg-surface-raised"><LoadingRows count={4} /></div> : null}
      {state.status === "error" ? <div className="rounded-xl border bg-surface-raised"><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={retry} title="Категории не загрузились" tone="danger">{state.message}</PageState></div> : null}
      {state.status === "ready" && state.data.categories.length === 0 ? <div className="rounded-xl border bg-surface-raised"><PageState icon={IconCategory} title="Категорий пока нет">Создайте первую категорию программ, чтобы отличать типы программ в рабочих списках.</PageState></div> : null}
      {state.status === "ready" && state.data.categories.length > 0 ? <ProgramCategoriesGrid categories={state.data.categories} /> : null}
    </PageFrame>
  )
}
