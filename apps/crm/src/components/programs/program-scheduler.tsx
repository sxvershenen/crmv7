import { IconCalendarOff, IconUser } from "@tabler/icons-react"
import { useNavigate } from "react-router-dom"

import { Assignees, Progress } from "@crm/ui"

import type { ProgramPeriod, ProgramRun, ProgramRunStatus } from "@app/entities/programs"
import { formatProgramDate, formatProgramTime, shiftIso } from "./program-format"
import { ProgramIdentity } from "./program-identity"
import { ProgramStatusSelect } from "./program-status-select"

export function ProgramScheduler({ date, items, onAssign, onStatusChange, period }: { date: string; items: ProgramRun[]; onAssign: (id: string) => void; onStatusChange: (id: string, status: ProgramRunStatus) => void; period: ProgramPeriod }) {
  const navigate = useNavigate()
  const days = Array.from({ length: period === "week" ? 7 : 3 }, (_, index) => shiftIso(date, index))
  const grouped = new Map(days.map((day) => [day, items.filter((item) => item.startsAt.slice(0, 10) === day)]))

  return (
    <section aria-label="Календарь проведений" data-testid="program-scheduler">
      <div className="md:hidden">
        <DayColumn day={days[0]!} items={grouped.get(days[0]!) ?? []} onAssign={onAssign} onOpen={(id) => navigate(`/programs/runs/${id}`)} onStatusChange={onStatusChange} />
      </div>
      <div className={period === "week" ? "hidden gap-2 md:grid md:grid-cols-3 xl:grid-cols-7" : "hidden grid-cols-3 gap-3 md:grid"}>
        {days.map((day) => <DayColumn day={day} items={grouped.get(day) ?? []} key={day} onAssign={onAssign} onOpen={(id) => navigate(`/programs/runs/${id}`)} onStatusChange={onStatusChange} />)}
      </div>
    </section>
  )
}

function DayColumn({ day, items, onAssign, onOpen, onStatusChange }: { day: string; items: ProgramRun[]; onAssign: (id: string) => void; onOpen: (id: string) => void; onStatusChange: (id: string, status: ProgramRunStatus) => void }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-xl border bg-surface-raised shadow-xs">
      <header className="border-b bg-muted/45 px-3 py-2"><p className="text-xs font-medium capitalize">{formatProgramDate(`${day}T12:00:00+03:00`)}</p><p className="text-[10px] text-muted-foreground">{items.length ? `${items.length} провед.` : "Нет проведений"}</p></header>
      {items.length ? <div className="divide-y">{items.map((item) => (
        <div className="relative p-2.5" key={item.id}>
          <button aria-label={`Открыть проведение ${item.name}`} className="absolute inset-0 rounded-none hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => onOpen(item.id)} type="button" />
          <ProgramIdentity className="pointer-events-none relative [&_p]:line-clamp-2 [&_p]:whitespace-normal" icon={item.categoryIcon} secondary={<span className="flex items-center justify-between gap-2"><span>#{item.id}</span><span className="tabular-nums">{formatProgramTime(item.startsAt)}</span></span>} title={item.name} tone={item.categoryTone} />
          <div className="pointer-events-none relative mt-2 flex items-center gap-2"><IconUser aria-hidden="true" className="size-3.5 text-muted-foreground" /><Progress aria-label={`Участников: ${item.participantCount} из ${item.participantLimit}`} className="flex-1" value={item.participantLimit ? item.participantCount / item.participantLimit * 100 : 0} /><span className="text-[10px] tabular-nums">{item.participantCount}/{item.participantLimit}</span></div>
          <div className="relative z-10 mt-2 flex items-center justify-between gap-2" onClick={(event) => event.stopPropagation()}><Assignees assignLabel={`Назначить ответственного проведению ${item.name}`} emptyVariant="icon" onAssign={() => onAssign(item.id)} people={item.assignees} size="compact" /><ProgramStatusSelect kind="run" label={`Статус проведения #${item.id}`} onChange={(status) => onStatusChange(item.id, status)} value={item.status} /></div>
        </div>
      ))}</div> : <div className="flex min-h-28 flex-col items-center justify-center gap-1.5 p-4 text-center text-[10px] text-muted-foreground"><IconCalendarOff aria-hidden="true" className="size-5" /><span>На этот день ничего не запланировано</span></div>}
    </article>
  )
}
