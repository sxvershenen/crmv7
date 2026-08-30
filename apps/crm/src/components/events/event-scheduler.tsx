import { IconCalendarOff, IconUser } from "@tabler/icons-react"
import { useNavigate } from "react-router-dom"

import { PaymentProgress } from "@crm/ui"

import type { CrmEvent, EventPeriod, EventStatus } from "@app/entities/events"
import { formatEventDate, formatEventTime, shiftIso } from "./event-format"
import { EventIdentity, StatusAssignee } from "./event-views"

export function EventScheduler({ date, items, onAssign, onStatusChange, period }: { date: string; items: CrmEvent[]; onAssign: (id: string) => void; onStatusChange: (id: string, status: EventStatus) => void; period: EventPeriod }) {
  const navigate = useNavigate()
  const days = Array.from({ length: period === "week" ? 7 : 3 }, (_, index) => shiftIso(date, index))
  const grouped = new Map(days.map((day) => [day, items.filter((item) => item.startsAt.slice(0, 10) === day)]))
  return (
    <section aria-label="Календарь мероприятий" data-testid="event-scheduler">
      <div className="md:hidden"><EventDay day={days[0]!} items={grouped.get(days[0]!) ?? []} onAssign={onAssign} onOpen={(id) => navigate(`/events/${id}`)} onStatusChange={onStatusChange} /></div>
      <div className={period === "week" ? "hidden gap-2 md:grid md:grid-cols-3 xl:grid-cols-7" : "hidden grid-cols-3 gap-3 md:grid"}>{days.map((day) => <EventDay day={day} items={grouped.get(day) ?? []} key={day} onAssign={onAssign} onOpen={(id) => navigate(`/events/${id}`)} onStatusChange={onStatusChange} />)}</div>
    </section>
  )
}

function EventDay({ day, items, onAssign, onOpen, onStatusChange }: { day: string; items: CrmEvent[]; onAssign: (id: string) => void; onOpen: (id: string) => void; onStatusChange: (id: string, status: EventStatus) => void }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-xl border bg-surface-raised shadow-xs">
      <header className="border-b bg-muted/45 px-3 py-2"><p className="text-xs font-medium capitalize">{formatEventDate(`${day}T12:00:00+03:00`)}</p><p className="text-[10px] text-muted-foreground">{items.length ? `${items.length} меропр.` : "Нет мероприятий"}</p></header>
      {items.length ? <div className="divide-y">{items.map((item) => (
        <div className="relative p-2.5" key={item.id}>
          <button aria-label={`Открыть мероприятие ${item.name}`} className="absolute inset-0 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => onOpen(item.id)} type="button" />
          <div className="pointer-events-none relative"><div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><EventIdentity event={item} /></div><span className="shrink-0 text-[11px] tabular-nums">{formatEventTime(item.startsAt)}</span></div>
          <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground"><IconUser aria-hidden="true" className="size-3.5" /><span className="tabular-nums">{item.guestCount}</span></div><PaymentProgress className="mt-2 w-full min-w-0" paid={item.paid} total={item.total} /></div>
          <div className="relative z-10 mt-2 border-t pt-2" onClick={(event) => event.stopPropagation()}><StatusAssignee event={item} onAssign={onAssign} onStatusChange={onStatusChange} /></div>
        </div>
      ))}</div> : <div className="flex min-h-28 flex-col items-center justify-center gap-1.5 p-4 text-center text-[10px] text-muted-foreground"><IconCalendarOff aria-hidden="true" className="size-5" /><span>На этот день ничего не запланировано</span></div>}
    </article>
  )
}
