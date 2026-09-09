import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { QueryClient, QueryClientContext, QueryClientProvider } from "@tanstack/react-query"
import { IconAlertTriangle, IconFilter } from "@tabler/icons-react"
import { useSearchParams } from "react-router-dom"

import { Button, PageFrame, PageState } from "@crm/ui"

import { shiftIso } from "@app/components/bookings/booking-date"
import { BookingCategoryNav, BookingControls, SchedulerResourceSelect } from "@app/components/bookings/bookings-controls"
import { AgendaView, BookingTable, BookingsLoading } from "@app/components/bookings/bookings-views"
import { VerticalScheduler } from "@app/components/bookings/vertical-scheduler"
import type { Booking, BookingDataset, BookingQuery, BookingResource, BookingSortKey, BookingView, SortDirection } from "@app/entities/bookings"
import { bookingCategories, bookingViews } from "@app/entities/bookings"
import { useBookings } from "@app/features/use-bookings"

const DEFAULT_DATE = "2026-08-23"
const EMPTY_BOOKING_RESOURCES: BookingResource[] = []
const standaloneQueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

function oneOf<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return value && options.includes(value as T) ? value as T : fallback
}

function positiveNumber(value: string | null) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

function validDate(value: string | null, fallback: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value! : fallback
}

export function BookingsPage(props: { defaultView?: BookingView }) {
  // The app shell supplies the shared client. Keeping this small fallback makes
  // the route independently renderable in Storybook/unit tests as well.
  const client = useContext(QueryClientContext)
  return client ? <BookingsPageContent {...props} /> : <QueryClientProvider client={standaloneQueryClient}><BookingsPageContent {...props} /></QueryClientProvider>
}

function BookingsPageContent({ defaultView = "agenda" }: { defaultView?: BookingView }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const category = oneOf(searchParams.get("category"), bookingCategories, "all")
  const view = oneOf(searchParams.get("view"), bookingViews, defaultView)
  const date = validDate(searchParams.get("date"), DEFAULT_DATE)
  const rangeEnd = validDate(searchParams.get("to"), date)
  const resource = searchParams.get("resource") ?? "all"
  const source = searchParams.get("source") ?? "all"
  const amountFrom = positiveNumber(searchParams.get("amountFrom"))
  const debtFrom = positiveNumber(searchParams.get("debtFrom"))
  const utm = searchParams.get("utm") ?? "all"
  const promo = searchParams.get("promo") ?? "all"
  const conflictOnly = searchParams.get("conflict") === "1"
  const overpayOnly = searchParams.get("overpay") === "1"
  const sortKey = oneOf(searchParams.get("sort"), ["id", "client", "arrival", "resource", "status", "total", "assignee"] as const, "arrival")
  const sortDirection = oneOf(searchParams.get("order"), ["asc", "desc"] as const, "asc")
  const query = useMemo<BookingQuery>(() => ({
    amountFrom,
    category,
    conflictOnly,
    date: view === "scheduler" ? shiftIso(date, -2) : date,
    debtFrom,
    overpayOnly,
    promo,
    rangeEnd: view === "scheduler" ? shiftIso(date, 2) : view === "table" ? rangeEnd : date,
    resource,
    sort: { direction: sortDirection, key: sortKey },
    source,
    utm,
  }), [amountFrom, category, conflictOnly, date, debtFrom, overpayOnly, promo, rangeEnd, resource, sortDirection, sortKey, source, utm, view])
  const { assignSelf, retry, state, updateInterval } = useBookings(query)
  const [conflictMessage, setConflictMessage] = useState("")
  const [announcement, setAnnouncement] = useState("")
  const [laneCount, setLaneCount] = useState(3)
  const [lanePage, setLanePage] = useState(0)
  const [selectedSchedulerResource, setSelectedSchedulerResource] = useState("")
  const schedulerDataRef = useRef<BookingDataset | null>(null)
  if (state.status === "ready") schedulerDataRef.current = state.data
  const schedulerData = state.status === "ready" ? state.data : schedulerDataRef.current

  const setParam = (name: string, value: string, fallback?: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (value === fallback) next.delete(name)
      else next.set(name, value)
      return next
    })
  }
  const setDate = (nextDate: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (nextDate === DEFAULT_DATE) next.delete("date")
      else next.set("date", nextDate)
      next.delete("to")
      return next
    })
  }
  const navigateSchedulerDate = (nextDate: string) => {
    setDate(nextDate)
  }
  const setView = (nextView: BookingView) => setParam("view", nextView, defaultView)
  const handleSort = (key: BookingSortKey) => {
    const direction: SortDirection = sortKey === key && sortDirection === "asc" ? "desc" : "asc"
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set("view", "table")
      next.set("sort", key)
      next.set("order", direction)
      return next
    })
  }
  const handleScheduleChange = async (booking: Booking, startHour: number, endHour: number, resourceId: string) => {
    setConflictMessage("")
    setAnnouncement(`Бронирование #${booking.id}: новый интервал ${startHour}:00–${endHour}:00`)
    try {
      await updateInterval(booking.id, startHour, endHour, resourceId)
      setAnnouncement(`Бронирование #${booking.id} сохранено на сервере.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Интервал не изменён"
      setConflictMessage(message)
      setAnnouncement(message)
      throw error
    }
  }
  const assignBooking = async (id: string) => {
    try {
      const updated = await assignSelf(id)
      setAnnouncement(`Вы назначены ответственным за бронирование #${updated.id}.`)
    } catch (error) {
      setAnnouncement(error instanceof Error ? error.message : "Не удалось назначить ответственного")
    }
  }
  const resetFilters = () => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      for (const key of ["resource", "source", "amountFrom", "debtFrom", "utm", "promo", "conflict", "overpay"]) next.delete(key)
      return next
    })
  }
  const activeFilters = [resource !== "all", source !== "all", amountFrom > 0, debtFrom > 0, utm !== "all", promo !== "all", conflictOnly, overpayOnly].filter(Boolean).length
  const resources = state.status === "ready" ? state.data.resources : schedulerData?.resources ?? EMPTY_BOOKING_RESOURCES
  const schedulerPageCount = Math.max(1, Math.ceil(resources.length / laneCount))

  useEffect(() => {
    if (resources.length === 0) return
    const selectedIndex = resources.findIndex((item) => item.id === selectedSchedulerResource)
    const nextIndex = selectedIndex >= 0 ? selectedIndex : 0
    if (selectedIndex < 0) setSelectedSchedulerResource(resources[0]!.id)
    setLanePage(Math.min(Math.floor(nextIndex / laneCount), Math.max(0, schedulerPageCount - 1)))
  }, [laneCount, resources, schedulerPageCount, selectedSchedulerResource])

  const changeSchedulerPage = (page: number) => {
    const nextPage = Math.max(0, Math.min(schedulerPageCount - 1, page))
    setLanePage(nextPage)
    const firstResource = resources[nextPage * laneCount]
    if (firstResource) setSelectedSchedulerResource(firstResource.id)
  }
  const changeSchedulerResource = (resourceId: string) => {
    setSelectedSchedulerResource(resourceId)
    const index = resources.findIndex((item) => item.id === resourceId)
    if (index >= 0) setLanePage(Math.floor(index / laneCount))
  }
  const handleLaneCountChange = useCallback((count: number) => setLaneCount(count), [])

  return (
    <PageFrame className="space-y-3" width="full">
      <BookingCategoryNav
        actions={view === "scheduler" && resources.length > 0 ? <SchedulerResourceSelect onResourceChange={changeSchedulerResource} resource={selectedSchedulerResource || resources[0]!.id} resources={resources} /> : null}
        onChange={(next) => setParam("category", next, "all")}
        value={category}
      />
      <BookingControls
        activeFilters={activeFilters}
        onDateChange={setDate}
        onParamChange={setParam}
        onSchedulerPageChange={changeSchedulerPage}
        onViewChange={setView}
        resources={resources}
        schedulerPage={lanePage}
        schedulerPageCount={schedulerPageCount}
        value={{ amountFrom, conflictOnly, date, debtFrom, overpayOnly, promo, rangeEnd, resource, source, utm, view }}
      />

      {conflictMessage ? (
        <div className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-subtle px-3 py-2 text-xs font-normal text-danger-foreground" role="alert">
          <IconAlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1">{conflictMessage}</span>
          <Button aria-label="Скрыть конфликт" onClick={() => setConflictMessage("")} size="xs" variant="ghost">Скрыть</Button>
        </div>
      ) : null}

      {state.status === "loading" && (view !== "scheduler" || !schedulerData) ? <BookingsLoading /> : null}
      {state.status === "error" ? <div className="rounded-xl border bg-surface-raised"><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={retry} title="Брони не загрузились" tone="danger">{state.message}</PageState></div> : null}
      {state.status === "ready" && state.data.bookings.length === 0 && view !== "scheduler" ? <div className="rounded-xl border bg-surface-raised"><PageState actionLabel="Сбросить фильтры" icon={IconFilter} onAction={resetFilters} title="Бронирований нет">В выбранном периоде или наборе фильтров записей нет.</PageState></div> : null}
      {(state.status === "ready" && state.data.bookings.length > 0) || (view === "scheduler" && schedulerData && schedulerData.resources.length > 0) ? (
        <div data-bookings-view={view}>
          {view === "agenda" && state.status === "ready" ? <AgendaView data={state.data} date={date} /> : null}
          {view === "table" && state.status === "ready" ? <BookingTable bookings={state.data.bookings} onAssign={(id) => { void assignBooking(id) }} onSort={handleSort} sortDirection={sortDirection} sortKey={sortKey} /> : null}
          {view === "scheduler" && schedulerData ? <VerticalScheduler data={schedulerData} date={date} lanePage={lanePage} onAnnouncement={setAnnouncement} onChange={handleScheduleChange} onConflict={setConflictMessage} onLaneCountChange={handleLaneCountChange} onNavigateDate={navigateSchedulerDate} selectedResource={selectedSchedulerResource || schedulerData.resources[0]?.id || ""} /> : null}
        </div>
      ) : null}
      <p aria-live="assertive" className="sr-only">{announcement}</p>
    </PageFrame>
  )
}
