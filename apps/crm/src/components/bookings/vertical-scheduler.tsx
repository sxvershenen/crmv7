import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  IconArrowDown,
  IconArrowUp,
  IconClockEdit,
  IconDots,
  IconHome,
  IconMap,
  IconBath,
  IconTent,
} from "@tabler/icons-react"
import { Link, useNavigate } from "react-router-dom"

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  FilterSelect,
  IconBox,
  IconButton,
  PreparationBlock,
  SchedulerBookingBlock,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  StatusBadge,
  cn,
  type SchedulerBookingTone,
} from "@crm/ui"

import type { Booking, BookingDataset, BookingResource, BookingStatus } from "@app/entities/bookings"
import { bookingStatusMeta } from "@app/entities/bookings"
import { formatDate, shiftIso, time } from "./booking-date"

const START_HOUR = 8
const END_HOUR = 24
const MAX_LANES = 5

type Preview = { end: number; id: string; start: number; valid: boolean } | null
type ActiveData = { action: "move" | "start" | "end"; booking: Booking }

type SchedulerProps = {
  data: BookingDataset
  date: string
  onAnnouncement: (message: string) => void
  onChange: (booking: Booking, start: number, end: number, resourceId: string) => Promise<void>
  onConflict: (message: string) => void
  onLaneCountChange: (count: number) => void
  onNavigateDate: (date: string) => void
  lanePage: number
  selectedResource: string
}

export function VerticalScheduler({ data, date, lanePage, onAnnouncement, onChange, onConflict, onLaneCountChange, onNavigateDate, selectedResource }: SchedulerProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor))
  const [preview, setPreview] = useState<Preview>(null)
  const activeData = useRef<ActiveData | null>(null)
  const schedulerRoot = useRef<HTMLElement | null>(null)
  const scrollViewport = useRef<HTMLDivElement | null>(null)
  const pendingAnchor = useRef<{ day: string; offset: number } | null>(null)
  const navigationPending = useRef(false)
  const laneCount = useAdaptiveLaneCount(schedulerRoot, onLaneCountChange)
  const hourHeight = 48
  const visibleResources = laneCount === 1
    ? data.resources.filter((item) => item.id === selectedResource).slice(0, 1)
    : data.resources.slice(lanePage * laneCount, lanePage * laneCount + laneCount)
  const days = [-2, -1, 0, 1, 2].map((offset) => shiftIso(date, offset))

  useLayoutEffect(() => {
    const viewport = scrollViewport.current
    if (!viewport) return
    const frame = requestAnimationFrame(() => {
      const anchor = pendingAnchor.current
      const anchorDay = anchor ? viewport.querySelector<HTMLElement>(`[data-day="${anchor.day}"]`) : null
      const selectedDay = viewport.querySelector<HTMLElement>(`[data-day="${date}"]`)
      if (anchor && anchorDay) viewport.scrollTop = scrollOffsetWithinViewport(viewport, anchorDay) + anchor.offset
      else if (selectedDay) viewport.scrollTop = scrollOffsetWithinViewport(viewport, selectedDay)
      pendingAnchor.current = null
      navigationPending.current = false
    })
    return () => cancelAnimationFrame(frame)
  }, [data.window.from, data.window.to, date])

  const shiftWindow = (amount: -2 | 2) => {
    const viewport = scrollViewport.current
    if (!viewport || navigationPending.current) return
    const viewportTop = viewport.getBoundingClientRect().top
    const anchor = Array.from(viewport.querySelectorAll<HTMLElement>("[data-day]")).find((item) => item.getBoundingClientRect().bottom > viewportTop + 1)
    if (anchor) pendingAnchor.current = { day: anchor.dataset.day ?? date, offset: viewport.scrollTop - scrollOffsetWithinViewport(viewport, anchor) }
    navigationPending.current = true
    onNavigateDate(shiftIso(date, amount))
  }

  const handleScroll = () => {
    const viewport = scrollViewport.current
    if (!viewport || navigationPending.current) return
    const threshold = Math.max(160, viewport.clientHeight * 0.35)
    if (viewport.scrollTop < threshold) shiftWindow(-2)
    else if (viewport.scrollTop + viewport.clientHeight > viewport.scrollHeight - threshold) shiftWindow(2)
  }

  const calculate = (deltaY: number) => {
    if (!activeData.current) return null
    const delta = Math.round(deltaY / hourHeight)
    const { action, booking } = activeData.current
    const next = action === "move"
      ? { end: booking.endHour + delta, start: booking.startHour + delta }
      : action === "start"
        ? { end: booking.endHour, start: booking.startHour + delta }
        : { end: booking.endHour + delta, start: booking.startHour }
    return { ...next, id: booking.id, valid: isValidInterval(next.start, next.end) }
  }

  const handleStart = ({ active }: DragStartEvent) => {
    const value = active.data.current as ActiveData
    activeData.current = value
    setPreview({ end: value.booking.endHour, id: value.booking.id, start: value.booking.startHour, valid: true })
    onAnnouncement(`Изменение брони #${value.booking.id}. Текущее время ${time(value.booking.startHour)}–${time(value.booking.endHour)}.`)
  }
  const handleMove = ({ delta }: DragMoveEvent) => {
    const next = calculate(delta.y)
    if (!next) return
    setPreview(next)
    onAnnouncement(`Предпросмотр ${time(next.start)}–${time(next.end)}${next.valid ? "" : ". Недопустимый интервал"}`)
  }
  const handleEnd = ({ delta }: DragEndEvent) => {
    const next = calculate(delta.y)
    const booking = activeData.current?.booking
    setPreview(null)
    activeData.current = null
    if (!next || !booking || (next.start === booking.startHour && next.end === booking.endHour)) return
    if (!next.valid) {
      const message = "Недопустимый интервал: бронирование должно оставаться в пределах 08:00–24:00 и длиться не меньше часа."
      onConflict(message)
      onAnnouncement(message)
      return
    }
    void onChange(booking, next.start, next.end, booking.resourceId).catch(() => undefined)
  }

  return (
    <section aria-label={`Scheduler вокруг ${formatDate(date)}`} className="min-w-0 overflow-hidden rounded-xl border bg-surface-raised" data-lane-count={laneCount} data-orientation="vertical" data-testid="vertical-scheduler" ref={schedulerRoot}>
      <div className="max-h-[calc(100dvh-18rem)] min-h-[28rem] overflow-x-hidden overflow-y-auto overscroll-contain [overflow-anchor:none]" data-scheduler-scroll-viewport="true" onScroll={handleScroll} ref={scrollViewport}>
        <DndContext
          onDragCancel={() => { setPreview(null); activeData.current = null; onAnnouncement("Изменение отменено") }}
          onDragEnd={handleEnd}
          onDragMove={handleMove}
          onDragStart={handleStart}
          sensors={sensors}
        >
          {days.map((day) => (
            <SchedulerDay
              allResources={data.resources}
              bookings={data.bookings.filter((booking) => booking.date === day)}
              day={day}
              hourHeight={hourHeight}
              key={day}
              onChange={onChange}
              onConflict={onConflict}
              preview={preview}
              resources={visibleResources}
              laneCount={laneCount}
              selected={day === date}
            />
          ))}
        </DndContext>
      </div>
    </section>
  )
}

function SchedulerDay({ allResources, bookings, day, hourHeight, laneCount, onChange, onConflict, preview, resources, selected }: { allResources: BookingResource[]; bookings: Booking[]; day: string; hourHeight: number; laneCount: number; onChange: SchedulerProps["onChange"]; onConflict: (message: string) => void; preview: Preview; resources: BookingResource[]; selected: boolean }) {
  const laneGridStyle: CSSProperties = { gridTemplateColumns: `52px repeat(${laneCount}, minmax(0, 1fr))` }
  return (
    <div data-day={day}>
      <div className="sticky top-0 z-20 flex min-h-10 items-center border-y bg-muted px-3 text-xs font-normal text-foreground" data-day-divider="true" data-selected={selected ? "true" : undefined}>{formatDate(day)}{selected ? <StatusBadge className="ml-2 text-[10px] leading-3" tone="info">выбранный день</StatusBadge> : null}</div>
      <div className="grid border-b bg-muted/35" style={laneGridStyle}>
        <div aria-hidden="true" className="sticky left-0 z-10 border-r bg-muted/60" />
        {resources.map((resource) => <ResourceHeader key={resource.id} resource={resource} />)}
        {Array.from({ length: Math.max(0, laneCount - resources.length) }, (_, index) => <div className="border-l" key={`empty-${index}`} />)}
      </div>
      <div className="grid" style={laneGridStyle}>
        <TimeGutter hourHeight={hourHeight} />
        {resources.map((resource) => (
          <SchedulerLane
            allResources={allResources}
            bookings={bookings.filter((booking) => booking.resourceId === resource.id)}
            day={day}
            hourHeight={hourHeight}
            key={resource.id}
            onChange={onChange}
            onConflict={onConflict}
            preview={preview}
            resource={resource}
          />
        ))}
        {Array.from({ length: Math.max(0, laneCount - resources.length) }, (_, index) => <div className="relative border-l bg-background" key={`empty-${index}`} style={{ height: (END_HOUR - START_HOUR) * hourHeight }} />)}
      </div>
    </div>
  )
}

function ResourceHeader({ resource }: { resource: BookingResource }) {
  const Icon = resource.category === "houses" ? IconHome : resource.category === "bath" ? IconBath : resource.category === "venues" ? IconMap : IconTent
  return (
    <div className="flex min-w-0 items-center gap-2 border-l px-2 py-2 first-of-type:border-l-0">
      <IconBox icon={Icon} size="sm" variant={resource.category === "houses" ? "info" : resource.category === "camping" ? "success" : resource.category === "bath" ? "warning" : resource.category === "venues" ? "danger" : "warning"} />
      <p className="min-w-0 truncate text-xs font-normal">{resource.name}</p>
    </div>
  )
}

function TimeGutter({ hourHeight }: { hourHeight: number }) {
  return (
    <div className="sticky left-0 z-10 border-r bg-surface-raised" style={{ height: (END_HOUR - START_HOUR) * hourHeight }}>
      {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index).map((hour) => (
        <span className="absolute right-1 -translate-y-1/2 text-[10px] font-normal tabular-nums text-muted-foreground" key={hour} style={{ top: (hour - START_HOUR) * hourHeight }}>{time(hour)}</span>
      ))}
    </div>
  )
}

function SchedulerLane({ allResources, bookings, day, hourHeight, onChange, onConflict, preview, resource }: { allResources: BookingResource[]; bookings: Booking[]; day: string; hourHeight: number; onChange: SchedulerProps["onChange"]; onConflict: (message: string) => void; preview: Preview; resource: BookingResource }) {
  return (
    <div className="relative min-w-0 border-l bg-background first-of-type:border-l-0" data-resource-lane={resource.id} style={{ height: (END_HOUR - START_HOUR) * hourHeight }}>
      {Array.from({ length: END_HOUR - START_HOUR }, (_, index) => START_HOUR + index).map((hour) => (
        <Link
          aria-label={`Создать бронь: ${resource.name}, ${formatDate(day)}, ${time(hour)}`}
          className="absolute inset-x-0 border-t border-dashed border-border/75 hover:bg-info-subtle/40 focus-visible:z-10 focus-visible:bg-info-subtle/50"
          key={hour}
          style={{ height: hourHeight, top: (hour - START_HOUR) * hourHeight }}
          to={`/bookings/new?date=${day}&resource=${resource.id}&start=${hour}`}
        />
      ))}
      {bookings.map((booking) => <SchedulerCard booking={booking} hourHeight={hourHeight} key={booking.id} onChange={onChange} onConflict={onConflict} preview={preview?.id === booking.id ? preview : null} resources={allResources} />)}
    </div>
  )
}

function SchedulerCard({ booking, hourHeight, onChange, onConflict, preview, resources }: { booking: Booking; hourHeight: number; onChange: SchedulerProps["onChange"]; onConflict: (message: string) => void; preview: Preview; resources: BookingResource[] }) {
  const navigate = useNavigate()
  const { attributes, listeners, setActivatorNodeRef, setNodeRef } = useDraggable({ id: `move:${booking.id}`, data: { booking, action: "move" } satisfies ActiveData })
  const start = preview?.start ?? booking.startHour
  const end = preview?.end ?? booking.endHour
  const top = (start - START_HOUR) * hourHeight
  const height = Math.max(hourHeight, (end - start) * hourHeight)
  const preparationDuration = booking.preparationEndHour - booking.endHour
  const preparationTop = (end - START_HOUR) * hourHeight
  const preparationHeight = Math.max(32, preparationDuration * hourHeight)
  const tone = statusTone[booking.status]
  const oneHour = end - start === 1
  const style: CSSProperties = { height, top }
  return (
    <>
      {preview ? <div aria-label={`Исходный интервал бронирования #${booking.id}`} className="pointer-events-none absolute inset-x-1 z-[1] rounded-lg border border-dashed border-muted-foreground/50 bg-muted/25 opacity-60" style={{ height: (booking.endHour - booking.startHour) * hourHeight, top: (booking.startHour - START_HOUR) * hourHeight }} /> : null}
      <div
        className={cn("absolute inset-x-1 z-[3] min-w-0", preview && "opacity-90", preview && !preview.valid && "rounded-lg ring-2 ring-danger")}
        data-preview-invalid={preview && !preview.valid ? "true" : undefined}
        ref={setNodeRef}
        style={style}
      >
        <SchedulerBookingBlock
          actionSlot={<BookingScheduleActions booking={booking} onChange={onChange} onConflict={onConflict} resources={resources} />}
          ariaLabel={`Открыть бронирование #${booking.id}`}
          bottomResizeSlot={<ResizeHandle action="end" booking={booking} />}
          className="cursor-grab active:cursor-grabbing"
          density={oneHour ? "compact" : "auto"}
          guests={booking.guestCount}
          height={height}
          id={`#${booking.id}`}
          onClick={() => navigate(`/bookings/${booking.id}`)}
          secondary={booking.phone}
          statusLabel={bookingStatusMeta[booking.status].label}
          timeLabel={`${time(start)}–${time(end)}`}
          title={booking.clientName}
          tone={preview && !preview.valid ? "conflict" : tone}
          topResizeSlot={<ResizeHandle action="start" booking={booking} />}
        />
        <button
          aria-label={`Переместить бронирование #${booking.id}`}
          className="absolute inset-x-0 bottom-3 top-3 z-[5] cursor-grab touch-none rounded-md focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
          data-raw-control="dnd-handle"
          onClick={() => navigate(`/bookings/${booking.id}`)}
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
        />
      </div>
      {preparationDuration > 0 ? (
        <div className="absolute inset-x-1 z-[2] min-w-0" data-preparation-preview={preview ? "true" : undefined} style={{ height: preparationHeight, top: preparationTop }}>
          <PreparationBlock height={preparationHeight} label="Подготовка" timeLabel={`${time(end)}–${time(end + preparationDuration)}`} tone={preview && !preview.valid ? "danger" : "neutral"} />
        </div>
      ) : null}
    </>
  )
}

function ResizeHandle({ action, booking }: { action: "start" | "end"; booking: Booking }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: `${action}:${booking.id}`, data: { action, booking } satisfies ActiveData })
  return (
    <button
      aria-label={`${action === "start" ? "Изменить начало" : "Изменить окончание"} бронирования #${booking.id}`}
      className={cn("absolute inset-x-0 h-3 cursor-ns-resize touch-none", action === "start" ? "-top-1" : "-bottom-1")}
      data-raw-control="resize-hitzone"
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
    ><span aria-hidden="true" className="absolute left-1/2 top-1/2 h-0.5 w-8 -translate-x-1/2 rounded bg-current/70" /></button>
  )
}

function BookingScheduleActions({ booking, onChange, onConflict, resources }: { booking: Booking; onChange: SchedulerProps["onChange"]; onConflict: (message: string) => void; resources: BookingResource[] }) {
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState(String(booking.startHour))
  const [end, setEnd] = useState(String(booking.endHour))
  const [resourceId, setResourceId] = useState(booking.resourceId)
  const run = async (nextStart: number, nextEnd: number, nextResource = booking.resourceId) => {
    try { await onChange(booking, nextStart, nextEnd, nextResource) }
    catch (error) { onConflict(error instanceof Error ? error.message : "Интервал не изменён") }
  }
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => START_HOUR + index).map((hour) => ({ label: time(hour), value: String(hour) }))
  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <DropdownMenu>
        <DropdownMenuTrigger render={<IconButton className="border-current/20 bg-transparent text-current shadow-none hover:bg-current/10 hover:text-current aria-expanded:bg-current/10 aria-expanded:text-current dark:bg-transparent dark:hover:bg-current/10" label={`Изменить бронь #${booking.id}`} size="icon-xs" variant="outline"><IconDots /></IconButton>} />
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={booking.startHour <= START_HOUR} onClick={() => void run(booking.startHour - 1, booking.endHour - 1)}><IconArrowUp />Раньше</DropdownMenuItem>
          <DropdownMenuItem disabled={booking.endHour >= END_HOUR} onClick={() => void run(booking.startHour + 1, booking.endHour + 1)}><IconArrowDown />Позже</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { setStart(String(booking.startHour)); setEnd(String(booking.endHour)); setResourceId(booking.resourceId); setOpen(true) }}><IconClockEdit />Время и ресурс</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SheetContent side="right">
        <SheetHeader><SheetTitle>Изменить бронь #{booking.id}</SheetTitle><SheetDescription>Альтернатива перетаскиванию.</SheetDescription></SheetHeader>
        <div className="grid gap-3 px-4">
          <FilterSelect className="max-w-none" label="Начало" onValueChange={setStart} options={hours.slice(0, -1)} value={start} />
          <FilterSelect className="max-w-none" label="Окончание" onValueChange={setEnd} options={hours.slice(1)} value={end} />
          <FilterSelect className="max-w-none" label="Ресурс" onValueChange={setResourceId} options={resources.map((item) => ({ label: item.name, value: item.id }))} value={resourceId} />
        </div>
        <SheetFooter>
          <Button disabled={!isValidInterval(Number(start), Number(end))} onClick={() => { void run(Number(start), Number(end), resourceId); setOpen(false) }}>Применить</Button>
          <Button onClick={() => setOpen(false)} variant="outline">Отмена</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

const statusTone: Record<BookingStatus, SchedulerBookingTone> = {
  cancelled: "neutral",
  confirmed: "confirmed",
  conflict: "conflict",
  debt: "pending",
  draft: "neutral",
  paid: "paid",
  unpaid: "pending",
}

function isValidInterval(start: number, end: number) { return start >= START_HOUR && end <= END_HOUR && end - start >= 1 }

function scrollOffsetWithinViewport(viewport: HTMLElement, element: HTMLElement) {
  return element.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop
}

function laneCountForWidth(width: number) {
  if (width < 700) return 1
  if (width < 920) return 2
  if (width < 1160) return 3
  if (width < 1420) return 4
  return MAX_LANES
}

function useAdaptiveLaneCount(root: RefObject<HTMLElement | null>, onChange: (count: number) => void) {
  const [laneCount, setLaneCount] = useState(() => laneCountForWidth(typeof window === "undefined" ? 1160 : window.innerWidth))
  useEffect(() => {
    const element = root.current
    if (!element || typeof ResizeObserver === "undefined") {
      const update = () => setLaneCount(laneCountForWidth(window.innerWidth))
      window.addEventListener("resize", update)
      update()
      return () => window.removeEventListener("resize", update)
    }
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0
      if (width > 0) setLaneCount(laneCountForWidth(width))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [root])
  useEffect(() => onChange(laneCount), [laneCount, onChange])
  return laneCount
}
