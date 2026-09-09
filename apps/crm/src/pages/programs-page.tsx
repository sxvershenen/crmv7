import { useMemo, useState } from "react"
import { IconAlertTriangle, IconFilter } from "@tabler/icons-react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { PageFrame, PageState } from "@crm/ui"

import { ProgramsControls, ProgramsNav } from "@app/components/programs/program-controls"
import { shiftIso } from "@app/components/programs/program-format"
import { ProgramScheduler } from "@app/components/programs/program-scheduler"
import { ProgramRegistrationsView, ProgramRunsView, ProgramsLoading, ProgramTemplatesView } from "@app/components/programs/program-views"
import { programsRepository, type ProgramsRepository } from "@app/data/programs-repository"
import type { ProgramQuery, ProgramRegistrationSortKey, ProgramRunSortKey, ProgramSortKey, ProgramTemplateSortKey } from "@app/entities/programs"
import { programPeriods, programRegistrationSortKeys, programRunSortKeys, programRunViews, programSections, programTemplateSortKeys } from "@app/entities/programs"
import { usePrograms } from "@app/features/use-programs"
import { useFixtureData } from "@app/lib/data-mode"

const DEFAULT_DATE = "2026-08-24"
const DEFAULT_RANGE_END = "2026-08-30"

function oneOf<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return value && options.includes(value as T) ? value as T : fallback
}

function validDate(value: string | null, fallback: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value! : fallback
}

export function ProgramsPage({ repository = programsRepository }: { repository?: ProgramsRepository }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const section = oneOf(searchParams.get("section"), programSections, "templates")
  const view = oneOf(searchParams.get("view"), programRunViews, "table")
  const period = oneOf(searchParams.get("period"), programPeriods, "3days")
  const category = searchParams.get("category") ?? "all"
  const status = searchParams.get("status") ?? "all"
  const date = validDate(searchParams.get("date"), DEFAULT_DATE)
  const tableRangeEnd = validDate(searchParams.get("to"), DEFAULT_RANGE_END)
  const rangeEnd = section === "runs" && view === "scheduler" ? shiftIso(date, period === "week" ? 6 : 2) : tableRangeEnd
  const allowedSortKeys = section === "templates" ? programTemplateSortKeys : section === "runs" ? programRunSortKeys : programRegistrationSortKeys
  const fallbackSort: ProgramSortKey = section === "templates" ? "name" : section === "runs" ? "date" : "program"
  const sortKey = oneOf(searchParams.get("sort"), allowedSortKeys, fallbackSort)
  const sortDirection = oneOf(searchParams.get("order"), ["asc", "desc"] as const, "asc")
  const query = useMemo<ProgramQuery>(() => ({ category, date, rangeEnd, section, sort: { direction: sortDirection, key: sortKey }, status }), [category, date, rangeEnd, section, sortDirection, sortKey, status])
  const { assignRegistration, assignRun, assignTemplate, retry, state, updateRegistrationStatus, updateRunStatus } = usePrograms(query, repository)
  const [announcement, setAnnouncement] = useState("")

  const setParam = (name: string, value: string, fallback?: string) => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    if (value === fallback) next.delete(name)
    else next.set(name, value)
    if (name === "section") {
      for (const key of ["status", "sort", "order", "view", "period"]) next.delete(key)
    }
    return next
  })
  const setRange = (from: string, to: string) => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    if (from === DEFAULT_DATE) next.delete("date"); else next.set("date", from)
    if (to === DEFAULT_RANGE_END) next.delete("to"); else next.set("to", to)
    return next
  })
  const resetFilters = () => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    for (const key of ["category", "status"]) next.delete(key)
    return next
  })
  const handleSort = (key: ProgramSortKey) => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    if (section === "runs" && key === "revenue") {
      const nextRevenueSort = sortKey === "revenue" && sortDirection === "desc"
        ? { key: "revenue", direction: "asc" }
        : sortKey === "revenue" && sortDirection === "asc"
          ? { key: "paid", direction: "desc" }
          : sortKey === "paid" && sortDirection === "desc"
            ? { key: "paid", direction: "asc" }
            : { key: "revenue", direction: "desc" }
      next.set("sort", nextRevenueSort.key)
      next.set("order", nextRevenueSort.direction)
      return next
    }
    next.set("sort", key)
    next.set("order", sortKey === key && sortDirection === "asc" ? "desc" : "asc")
    return next
  })
  const changeRunStatus = async (id: string, nextStatus: Parameters<typeof updateRunStatus>[1]) => {
    await updateRunStatus(id, nextStatus)
    setAnnouncement(`Статус проведения #${id} сохранён`)
  }
  const changeRegistrationStatus = async (id: string, nextStatus: Parameters<typeof updateRegistrationStatus>[1]) => {
    await updateRegistrationStatus(id, nextStatus)
    setAnnouncement(`Статус регистрации #${id} сохранён`)
  }
  const assignTemplateOwner = async (id: string) => {
    await assignTemplate(id)
    setAnnouncement(`Марина Кириллова назначена шаблону ${id}`)
  }
  const assignRunOwner = async (id: string) => {
    await assignRun(id)
    setAnnouncement(`Марина Кириллова назначена проведению #${id}`)
  }
  const assignRegistrationOwner = async (id: string) => {
    await assignRegistration(id)
    setAnnouncement(`Марина Кириллова назначена регистрации #${id}`)
  }
  const items = state.status === "ready" ? section === "templates" ? state.data.templates : section === "runs" ? state.data.runs : state.data.registrations : []

  return (
    <PageFrame className="space-y-3" width="full">
      <ProgramsNav onChange={(next) => setParam("section", next, "templates")} value={section} />
      <ProgramsControls
        activeFilters={Number(category !== "all") + Number(status !== "all")}
        categories={state.status === "ready" ? state.data.categories : []}
        category={category}
        date={date}
        onCategoryChange={(next) => setParam("category", next, "all")}
        onDateChange={(next) => setParam("date", next, DEFAULT_DATE)}
        onOpenCategories={() => navigate("/programs/categories")}
        onPeriodChange={(next) => setParam("period", next, "3days")}
        onRangeChange={setRange}
        onReset={resetFilters}
        onStatusChange={(next) => setParam("status", next, "all")}
        onViewChange={(next) => setParam("view", next, "table")}
        period={period}
        rangeEnd={tableRangeEnd}
        section={section}
        status={status}
        view={view}
      />

      {state.status === "loading" ? <ProgramsLoading /> : null}
      {state.status === "error" ? <div className="rounded-xl border bg-surface-raised"><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={retry} title="Программы не загрузились" tone="danger">{state.message}</PageState></div> : null}
      {state.status === "ready" && items.length === 0 ? <div className="rounded-xl border bg-surface-raised"><PageState actionLabel="Сбросить фильтры" icon={IconFilter} onAction={resetFilters} title="Ничего не найдено">Измените период, категорию или статус.</PageState></div> : null}
      {state.status === "ready" && items.length > 0 ? (
        <>
          {section === "templates" ? <ProgramTemplatesView items={state.data.templates} onAssign={assignTemplateOwner} onSort={(key) => handleSort(key)} sortDirection={sortDirection} sortKey={sortKey as ProgramTemplateSortKey} /> : null}
          {section === "runs" && view === "table" ? <ProgramRunsView items={state.data.runs} onAssign={assignRunOwner} onSort={(key) => handleSort(key)} onStatusChange={changeRunStatus} sortDirection={sortDirection} sortKey={sortKey as ProgramRunSortKey} /> : null}
          {section === "runs" && view === "scheduler" ? <ProgramScheduler date={date} items={state.data.runs} onAssign={assignRunOwner} onStatusChange={changeRunStatus} period={period} /> : null}
          {section === "registrations" ? <ProgramRegistrationsView items={state.data.registrations} {...(useFixtureData || import.meta.env.MODE === "test" ? { onAssign: assignRegistrationOwner } : {})} onSort={(key) => handleSort(key)} onStatusChange={changeRegistrationStatus} sortDirection={sortDirection} sortKey={sortKey as ProgramRegistrationSortKey} /> : null}
          <p className="text-[11px] text-muted-foreground">Показано: {items.length}</p>
        </>
      ) : null}
      <p aria-live="polite" className="sr-only">{announcement}</p>
    </PageFrame>
  )
}
