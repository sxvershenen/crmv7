import { useMemo } from "react"
import { IconAlertTriangle, IconCategory } from "@tabler/icons-react"

import { LoadingRows, PageFrame, PageState } from "@crm/ui"
import { CreateEventCategoryAction, EventCategoriesGrid } from "@app/components/events/event-categories"
import { eventsRepository, type EventsRepository } from "@app/data/events-repository"
import type { EventQuery } from "@app/entities/events"
import { useEvents } from "@app/features/use-events"

export function EventCategoriesPage({ repository = eventsRepository }: { repository?: EventsRepository }) {
  const query = useMemo<EventQuery>(() => ({ status: "all", category: "all", assignee: "all", date: "0001-01-01", rangeEnd: "9999-12-31", nearest: false, requiresAction: false, unpaid: false, conflict: false, sort: { direction: "asc", key: "name" } }), [])
  const { retry, state } = useEvents(query, repository)
  return <PageFrame className="space-y-3" width="wide"><div className="flex min-h-9 items-center justify-between gap-3 border-b pb-2"><div><p className="text-sm font-semibold">Категории мероприятий</p><p className="text-[11px] text-muted-foreground">Иконка и цвет отделяют тип от операционного статуса.</p></div><CreateEventCategoryAction /></div>{state.status === "loading" ? <div className="rounded-xl border bg-surface-raised"><LoadingRows count={4} /></div> : null}{state.status === "error" ? <div className="rounded-xl border bg-surface-raised"><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={retry} title="Категории не загрузились" tone="danger">{state.message}</PageState></div> : null}{state.status === "ready" && state.data.categories.length === 0 ? <div className="rounded-xl border bg-surface-raised"><PageState icon={IconCategory} title="Категорий пока нет">Создайте первую категорию мероприятий, чтобы отделять типы событий в рабочих списках.</PageState></div> : null}{state.status === "ready" && state.data.categories.length > 0 ? <EventCategoriesGrid categories={state.data.categories} /> : null}</PageFrame>
}
