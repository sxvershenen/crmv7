import { useMemo, useState } from "react"
import { IconAlertTriangle, IconFilter } from "@tabler/icons-react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { PageFrame, PageState } from "@crm/ui"

import { EventsControls, EventsNav, type EventFilterValues } from "@app/components/events/event-controls"
import { shiftIso } from "@app/components/events/event-format"
import { EventScheduler } from "@app/components/events/event-scheduler"
import { EventsLoading, EventsTableView } from "@app/components/events/event-views"
import { eventsRepository, type EventsRepository } from "@app/data/events-repository"
import type { EventQuery, EventSortKey, EventStatus, EventStatusFilter } from "@app/entities/events"
import { eventPeriods, eventSortKeys, eventStatusFilters, eventViews } from "@app/entities/events"
import { useEvents } from "@app/features/use-events"

const DEFAULT_DATE = "2026-08-24"
const DEFAULT_RANGE_END = "2026-08-30"

function oneOf<T extends string>(value: string | null, values: readonly T[], fallback: T): T { return value && values.includes(value as T) ? value as T : fallback }
function validDate(value: string | null, fallback: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value! : fallback }

export function EventsPage({ repository = eventsRepository }: { repository?: EventsRepository }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = oneOf(params.get("status"), eventStatusFilters, "all")
  const view = oneOf(params.get("view"), eventViews, "table")
  const period = oneOf(params.get("period"), eventPeriods, "3days")
  const date = validDate(params.get("date"), DEFAULT_DATE)
  const tableRangeEnd = validDate(params.get("to"), DEFAULT_RANGE_END)
  const rangeEnd = view === "scheduler" ? shiftIso(date, period === "week" ? 6 : 2) : tableRangeEnd
  const sortKey = oneOf(params.get("sort"), eventSortKeys, "date")
  const sortDirection = oneOf(params.get("order"), ["asc", "desc"] as const, "asc")
  const filterValues: EventFilterValues = {
    category: params.get("category") ?? "all",
    assignee: params.get("assignee") ?? "all",
    nearest: params.get("nearest") === "1",
    requiresAction: params.get("action") === "1",
    unpaid: params.get("unpaid") === "1",
    conflict: params.get("conflict") === "1",
  }
  const query = useMemo<EventQuery>(() => ({
    status, date, rangeEnd, sort: { key: sortKey, direction: sortDirection },
    category: filterValues.category, assignee: filterValues.assignee, nearest: filterValues.nearest,
    requiresAction: filterValues.requiresAction, unpaid: filterValues.unpaid, conflict: filterValues.conflict,
  }), [date, filterValues.assignee, filterValues.category, filterValues.conflict, filterValues.nearest, filterValues.requiresAction, filterValues.unpaid, rangeEnd, sortDirection, sortKey, status])
  const { assign, retry, state, updateStatus } = useEvents(query, repository)
  const [announcement, setAnnouncement] = useState("")
  const counts = state.status === "ready" ? state.data.counts : { in_work: 0, booked: 0, completed: 0, cancelled: 0, archived: 0 }

  const setParam = (name: string, value: string, fallback?: string) => setParams((current) => { const next = new URLSearchParams(current); if (value === fallback) next.delete(name); else next.set(name, value); return next })
  const setRange = (from: string, to: string) => setParams((current) => { const next = new URLSearchParams(current); if (from === DEFAULT_DATE) next.delete("date"); else next.set("date", from); if (to === DEFAULT_RANGE_END) next.delete("to"); else next.set("to", to); return next })
  const resetFilters = () => setParams((current) => { const next = new URLSearchParams(current); for (const key of ["category", "assignee", "nearest", "action", "unpaid", "conflict"]) next.delete(key); return next })
  const onFilterChange = (name: string, value: string, fallback?: string) => setParam(name === "requiresAction" ? "action" : name, value, fallback)
  const activeFilters = Number(filterValues.category !== "all") + Number(filterValues.assignee !== "all") + Number(filterValues.nearest) + Number(filterValues.requiresAction) + Number(filterValues.unpaid) + Number(filterValues.conflict)
  const handleSort = (key: EventSortKey) => setParams((current) => { const next = new URLSearchParams(current); next.set("sort", key); next.set("order", sortKey === key && sortDirection === "asc" ? "desc" : "asc"); return next })
  const changeStatus = async (id: string, next: EventStatus) => { await updateStatus(id, next); setAnnouncement(`Статус мероприятия #${id} изменён локально`) }
  const assignPerson = async (id: string) => { await assign(id); setAnnouncement(`Ответственный назначен мероприятию #${id}`) }

  return (
    <PageFrame className="space-y-3" width="full">
      <EventsNav counts={counts} onChange={(next: EventStatusFilter) => setParam("status", next, "all")} value={status} />
      <EventsControls activeFilters={activeFilters} assignees={state.status === "ready" ? state.data.assignees : []} categories={state.status === "ready" ? state.data.categories : []} date={date} filterValues={filterValues} onDateChange={(next) => setParam("date", next, DEFAULT_DATE)} onFilterChange={onFilterChange} onOpenCategories={() => navigate("/events/categories")} onPeriodChange={(next) => setParam("period", next, "3days")} onRangeChange={setRange} onReset={resetFilters} onViewChange={(next) => setParam("view", next, "table")} period={period} rangeEnd={tableRangeEnd} view={view} />
      {state.status === "loading" ? <EventsLoading /> : null}
      {state.status === "error" ? <div className="rounded-xl border bg-surface-raised"><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={retry} title="Мероприятия не загрузились" tone="danger">{state.message}</PageState></div> : null}
      {state.status === "ready" && state.data.events.length === 0 && view === "table" ? <div className="rounded-xl border bg-surface-raised"><PageState actionLabel="Сбросить фильтры" icon={IconFilter} onAction={resetFilters} title="Ничего не найдено">Измените период, тип или признаки.</PageState></div> : null}
      {state.status === "ready" && state.data.events.length > 0 && view === "table" ? <EventsTableView items={state.data.events} onAssign={assignPerson} onSort={handleSort} onStatusChange={changeStatus} sortDirection={sortDirection} sortKey={sortKey} /> : null}
      {state.status === "ready" && view === "scheduler" ? <EventScheduler date={date} items={state.data.events} onAssign={assignPerson} onStatusChange={changeStatus} period={period} /> : null}
      {state.status === "ready" && state.data.events.length > 0 ? <p className="text-[11px] text-muted-foreground">Показано: {state.data.events.length}</p> : null}
      <p aria-live="polite" className="sr-only">{announcement}</p>
    </PageFrame>
  )
}
