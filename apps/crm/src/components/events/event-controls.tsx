import { useState } from "react"
import { IconCalendarEvent, IconFilter, IconSettings, IconTable } from "@tabler/icons-react"

import {
  Badge,
  Button,
  Checkbox,
  DateNavigator,
  FilterSelect,
  IconButton,
  PageNav,
  SettingsBar,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  ViewTabs,
  type Assignee,
  type DateRange,
} from "@crm/ui"

import type { EventCategory, EventPeriod, EventStatus, EventStatusFilter, EventView } from "@app/entities/events"
import { eventStatusFilters, eventStatusFilterLabels } from "@app/entities/events"
import { fromIso, shiftIso, toIso } from "./event-format"

export type EventFilterValues = {
  category: string
  assignee: string
  nearest: boolean
  requiresAction: boolean
  unpaid: boolean
  conflict: boolean
}

type EventsControlsProps = {
  activeFilters: number
  assignees: Assignee[]
  categories: EventCategory[]
  date: string
  filterValues: EventFilterValues
  onDateChange: (value: string) => void
  onFilterChange: (name: string, value: string, fallback?: string) => void
  onOpenCategories: () => void
  onPeriodChange: (value: EventPeriod) => void
  onRangeChange: (from: string, to: string) => void
  onReset: () => void
  onViewChange: (value: EventView) => void
  period: EventPeriod
  rangeEnd: string
  view: EventView
}

export function EventsNav({ counts, onChange, value }: { counts: Record<EventStatus, number>; onChange: (value: EventStatusFilter) => void; value: EventStatusFilter }) {
  return <PageNav ariaLabel="Статусы мероприятий" items={eventStatusFilters.map((status) => ({
    value: status,
    label: status === "in_work" || status === "booked" ? `${eventStatusFilterLabels[status]} · ${counts[status]}` : eventStatusFilterLabels[status],
    compactLabel: eventStatusFilterLabels[status],
  }))} onValueChange={(next) => onChange(next as EventStatusFilter)} value={value} />
}

export function EventsControls(props: EventsControlsProps) {
  const primary = props.view === "scheduler" ? (
    <DateNavigator
      label="Дата мероприятий"
      nextLabel="Следующий период"
      onNext={() => props.onDateChange(shiftIso(props.date, props.period === "week" ? 7 : 3))}
      onPrevious={() => props.onDateChange(shiftIso(props.date, props.period === "week" ? -7 : -3))}
      onValueChange={(next) => next && props.onDateChange(toIso(next))}
      previousLabel="Предыдущий период"
      value={fromIso(props.date)}
    />
  ) : <EventRangeControl {...props} />

  const views = <ViewTabs ariaLabel="Вид мероприятий" items={[{ icon: IconTable, label: "Таблица", value: "table" }, { icon: IconCalendarEvent, label: "Scheduler", value: "scheduler" }]} onValueChange={(next) => props.onViewChange(next as EventView)} value={props.view} />
  const filterSheet = <EventFilterSheet {...props} />
  const mobileToolbarActions = <div className="flex min-w-0 justify-end gap-1">{views}{filterSheet}<IconButton label="Категории мероприятий" onClick={props.onOpenCategories} variant="outline"><IconSettings aria-hidden="true" /></IconButton></div>

  return (
    <SettingsBar
      actions={<>{views}<IconButton label="Управление категориями мероприятий" onClick={props.onOpenCategories} variant="outline"><IconSettings aria-hidden="true" /></IconButton></>}
      filters={<><CategorySelect categories={props.categories} onChange={(value) => props.onFilterChange("category", value, "all")} value={props.filterValues.category} />{props.view === "scheduler" ? <PeriodSelect onChange={props.onPeriodChange} value={props.period} /> : null}{filterSheet}</>}
      mobileActions={<span aria-hidden="true" className="hidden" />}
      mobilePrimary={<div className="grid w-full min-w-0 gap-2"><div className="min-w-0">{primary}</div>{mobileToolbarActions}</div>}
      primary={primary}
    />
  )
}

function EventRangeControl({ date, onRangeChange, rangeEnd }: EventsControlsProps) {
  const value: DateRange = { from: fromIso(date), to: fromIso(rangeEnd) }
  const duration = Math.max(1, Math.round((fromIso(rangeEnd).getTime() - fromIso(date).getTime()) / 86_400_000) + 1)
  const shift = (direction: number) => onRangeChange(shiftIso(date, direction * duration), shiftIso(rangeEnd, direction * duration))
  return <DateNavigator label="Диапазон мероприятий" mode="range" nextLabel="Следующий диапазон" onNext={() => shift(1)} onPrevious={() => shift(-1)} onValueChange={(next) => next?.from && onRangeChange(toIso(next.from), toIso(next.to ?? next.from))} previousLabel="Предыдущий диапазон" value={value} />
}

function CategorySelect({ categories, onChange, value }: { categories: EventCategory[]; onChange: (value: string) => void; value: string }) {
  return <FilterSelect className="w-44" label="Тип мероприятия" onValueChange={onChange} options={[{ label: "Все типы", value: "all" }, ...categories.map((item) => ({ label: item.name, value: item.id }))]} value={value} />
}

function PeriodSelect({ onChange, value }: { onChange: (value: EventPeriod) => void; value: EventPeriod }) {
  return <FilterSelect className="w-28" label="Период scheduler" onValueChange={(next) => onChange(next as EventPeriod)} options={[{ label: "3 дня", value: "3days" }, { label: "Неделя", value: "week" }]} value={value} />
}

function EventFilterSheet(props: EventsControlsProps) {
  const [open, setOpen] = useState(false)
  const toggle = (name: keyof Pick<EventFilterValues, "nearest" | "requiresAction" | "unpaid" | "conflict">, checked: boolean) => props.onFilterChange(name, checked ? "1" : "0", "0")
  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <Button aria-label="Фильтры мероприятий" className="h-8 text-xs font-normal" onClick={() => setOpen(true)} size="sm" variant="outline"><IconFilter aria-hidden="true" /><span className="hidden xl:inline">Фильтры</span>{props.activeFilters ? <Badge variant="secondary">{props.activeFilters}</Badge> : null}</Button>
      <SheetContent side="right">
        <SheetHeader><SheetTitle>Фильтры мероприятий</SheetTitle><SheetDescription>Тип, ответственный и операционные признаки хранятся в URL.</SheetDescription></SheetHeader>
        <div className="grid gap-3 px-4">
          <CategorySelect categories={props.categories} onChange={(value) => props.onFilterChange("category", value, "all")} value={props.filterValues.category} />
          <FilterSelect className="max-w-none" label="Ответственный" onValueChange={(value) => props.onFilterChange("assignee", value, "all")} options={[{ label: "Все ответственные", value: "all" }, ...props.assignees.map((person) => ({ label: person.name, value: person.id }))]} value={props.filterValues.assignee} />
          <FilterCheck checked={props.filterValues.nearest} label="Ближайшие" onChange={(checked) => toggle("nearest", checked)} />
          <FilterCheck checked={props.filterValues.requiresAction} label="Требуют действия" onChange={(checked) => toggle("requiresAction", checked)} />
          <FilterCheck checked={props.filterValues.unpaid} label="Неоплаченные" onChange={(checked) => toggle("unpaid", checked)} />
          <FilterCheck checked={props.filterValues.conflict} label="Конфликт" onChange={(checked) => toggle("conflict", checked)} />
          {props.view === "scheduler" ? <PeriodSelect onChange={props.onPeriodChange} value={props.period} /> : null}
        </div>
        <SheetFooter><Button onClick={() => setOpen(false)}>Применить</Button>{props.activeFilters ? <Button onClick={() => { props.onReset(); setOpen(false) }} variant="outline">Сбросить</Button> : null}</SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function FilterCheck({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-9 items-center gap-2 text-xs font-normal"><Checkbox checked={checked} onCheckedChange={(value) => onChange(Boolean(value))} />{label}</label>
}
