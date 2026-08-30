import { useState, type ReactNode } from "react"
import {
  IconCalendarEvent,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconFilter,
  IconTable,
} from "@tabler/icons-react"

import {
  Badge,
  Button,
  Checkbox,
  DateNavigator,
  FilterSelect,
  IconButton,
  PageNav,
  SettingsBar,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  ViewTabs,
  type DateRange,
} from "@crm/ui"

import type { BookingCategory, BookingResource, BookingView } from "@app/entities/bookings"
import { bookingCategories, bookingCategoryLabels } from "@app/entities/bookings"
import { fromIso, shiftIso, toIso } from "./booking-date"

const sourceOptions = ["Сайт", "Телефон", "Telegram", "VK"]
const selectAll = (label: string) => ({ label: `Все · ${label}`, value: "all" })

export function BookingCategoryNav({ actions, onChange, value }: { actions?: ReactNode; onChange: (value: BookingCategory) => void; value: BookingCategory }) {
  return (
    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
      <PageNav
        ariaLabel="Категория ресурсов"
        className="flex-1"
        items={bookingCategories.map((item) => ({ label: bookingCategoryLabels[item], value: item }))}
        onValueChange={(next) => onChange(next as BookingCategory)}
        value={value}
      />
      {actions ? <div className="ml-auto min-w-0 max-w-[45vw] shrink-0 sm:max-w-52">{actions}</div> : null}
    </div>
  )
}

export type BookingControlsValue = {
  amountFrom: number
  conflictOnly: boolean
  date: string
  debtFrom: number
  overpayOnly: boolean
  promo: string
  rangeEnd: string
  resource: string
  source: string
  utm: string
  view: BookingView
}

type BookingControlsProps = {
  activeFilters: number
  onDateChange: (date: string) => void
  onParamChange: (name: string, value: string, fallback?: string) => void
  onSchedulerPageChange: (page: number) => void
  onViewChange: (view: BookingView) => void
  resources: BookingResource[]
  schedulerPage: number
  schedulerPageCount: number
  value: BookingControlsValue
}

export function BookingControls({ activeFilters, onDateChange, onParamChange, onSchedulerPageChange, onViewChange, resources, schedulerPage, schedulerPageCount, value }: BookingControlsProps) {
  const range: DateRange = { from: fromIso(value.date), to: fromIso(value.rangeEnd) }
  const primary = value.view === "table" ? (
    <DateNavigator
      label="Диапазон бронирований"
      mode="range"
      nextLabel="Следующий диапазон"
      onNext={() => shiftRange(range, 1, onParamChange)}
      onPrevious={() => shiftRange(range, -1, onParamChange)}
      onValueChange={(next) => {
        if (!next?.from) return
        onParamChange("date", toIso(next.from))
        onParamChange("to", toIso(next.to ?? next.from))
      }}
      previousLabel="Предыдущий диапазон"
      value={range}
    />
  ) : (
    <DateNavigator
      label="Дата бронирований"
      nextLabel="Следующий день"
      onNext={() => onDateChange(shiftIso(value.date, 1))}
      onPrevious={() => onDateChange(shiftIso(value.date, -1))}
      onValueChange={(next) => next && onDateChange(toIso(next))}
      previousLabel="Предыдущий день"
      value={fromIso(value.date)}
    />
  )

  const views = (
    <ViewTabs
      ariaLabel="Вид бронирований"
      items={[
        { icon: IconCalendarEvent, label: "Agenda", value: "agenda" },
        { icon: IconClock, label: "Scheduler", value: "scheduler" },
        { icon: IconTable, label: "Таблица", value: "table" },
      ]}
      onValueChange={(next) => onViewChange(next as BookingView)}
      value={value.view}
    />
  )

  return (
    <SettingsBar
      actions={<>{views}{value.view === "scheduler" ? <SchedulerResourcePager onPageChange={onSchedulerPageChange} page={schedulerPage} pageCount={schedulerPageCount} /> : null}</>}
      filters={
        <>
          {value.view !== "scheduler" ? (
            <FilterSelect
              label="Ресурс"
              onValueChange={(next) => onParamChange("resource", next, "all")}
              options={[selectAll("ресурсы"), ...resources.map((item) => ({ label: item.name, value: item.id }))]}
              value={value.resource}
            />
          ) : null}
          <FilterSelect
            label="Источник"
            onValueChange={(next) => onParamChange("source", next, "all")}
            options={[selectAll("источники"), ...sourceOptions.map((item) => ({ label: item, value: item }))]}
            value={value.source}
          />
          <FilterSheet activeCount={activeFilters} onChange={onParamChange} resources={resources} value={value} />
        </>
      }
      mobileActions={<>{views}<FilterSheet activeCount={activeFilters} onChange={onParamChange} resources={resources} value={value} /></>}
      primary={primary}
    />
  )
}

export function SchedulerResourceSelect({ onResourceChange, resource, resources }: { onResourceChange: (resourceId: string) => void; resource: string; resources: BookingResource[] }) {
  return (
    <Select onValueChange={(next) => next !== null && onResourceChange(next)} value={resource}>
      <SelectTrigger aria-label="Ресурс scheduler" className="w-full min-w-0 max-w-52 bg-background text-xs font-normal" size="sm">
        <SelectValue className="min-w-0 overflow-hidden">{resources.find((item) => item.id === resource)?.name ?? "Ресурс"}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end" alignItemWithTrigger={false} className="w-auto max-w-[calc(100vw-1rem)] min-w-(--anchor-width)">
        {resources.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

function SchedulerResourcePager({ onPageChange, page, pageCount }: { onPageChange: (page: number) => void; page: number; pageCount: number }) {
  return (
    <div aria-label="Страницы ресурсов scheduler" className="hidden min-w-0 items-center gap-1 md:flex">
      <IconButton disabled={page === 0} label="Предыдущие ресурсы" onClick={() => onPageChange(Math.max(0, page - 1))} variant="outline"><IconChevronLeft /></IconButton>
      <span className="min-w-11 text-center text-[11px] font-normal tabular-nums text-muted-foreground">{page + 1}/{pageCount}</span>
      <IconButton disabled={page >= pageCount - 1} label="Следующие ресурсы" onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))} variant="outline"><IconChevronRight /></IconButton>
    </div>
  )
}

function FilterSheet({ activeCount, onChange, resources, value }: { activeCount: number; onChange: (name: string, value: string, fallback?: string) => void; resources: BookingResource[]; value: BookingControlsValue }) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <Button aria-label="Фильтры бронирований" onClick={() => setOpen(true)} size="sm" variant="outline">
        <IconFilter aria-hidden="true" />
        <span className="hidden xl:inline">Фильтры</span>
        {activeCount ? <Badge variant="secondary">{activeCount}</Badge> : null}
      </Button>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Фильтры бронирований</SheetTitle>
          <SheetDescription>Все значения хранятся в URL и доступны после обновления страницы.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-3 px-4">
          <FilterSelect className="max-w-none" label="Ресурс" onValueChange={(next) => onChange("resource", next, "all")} options={[selectAll("ресурсы"), ...resources.map((item) => ({ label: item.name, value: item.id }))]} value={value.resource} />
          <FilterSelect className="max-w-none" label="Источник" onValueChange={(next) => onChange("source", next, "all")} options={[selectAll("источники"), ...sourceOptions.map((item) => ({ label: item, value: item }))]} value={value.source} />
          <FilterSelect className="max-w-none" label="Минимальная сумма" onValueChange={(next) => onChange("amountFrom", next, "0")} options={[{ label: "Любая сумма", value: "0" }, { label: "От 20 000 ₽", value: "20000" }]} value={String(value.amountFrom)} />
          <FilterSelect className="max-w-none" label="Минимальный долг" onValueChange={(next) => onChange("debtFrom", next, "0")} options={[{ label: "Любой долг", value: "0" }, { label: "От 5 000 ₽", value: "5000" }]} value={String(value.debtFrom)} />
          <FilterSelect className="max-w-none" label="UTM" onValueChange={(next) => onChange("utm", next, "all")} options={[{ label: "Все UTM", value: "all" }, { label: "organic", value: "organic" }]} value={value.utm} />
          <FilterSelect className="max-w-none" label="Промокод" onValueChange={(next) => onChange("promo", next, "all")} options={[{ label: "Все промокоды", value: "all" }, { label: "Лето", value: "Лето" }]} value={value.promo} />
          <label className="flex min-h-9 items-center gap-2 text-xs font-normal"><Checkbox checked={value.conflictOnly} onCheckedChange={(checked) => onChange("conflict", checked ? "1" : "0", "0")} />Только конфликты</label>
          <label className="flex min-h-9 items-center gap-2 text-xs font-normal"><Checkbox checked={value.overpayOnly} onCheckedChange={(checked) => onChange("overpay", checked ? "1" : "0", "0")} />Только переплата</label>
        </div>
        <SheetFooter>
          <Button onClick={() => setOpen(false)}>Применить</Button>
          <Button onClick={() => {
            for (const key of ["resource", "source", "utm", "promo"]) onChange(key, "all", "all")
            for (const key of ["amountFrom", "debtFrom", "conflict", "overpay"]) onChange(key, "0", "0")
          }} variant="outline">Сбросить</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function shiftRange(value: DateRange, amount: number, onChange: BookingControlsProps["onParamChange"]) {
  if (!value.from) return
  const duration = value.to ? Math.round((value.to.getTime() - value.from.getTime()) / 86_400_000) : 0
  const nextFrom = new Date(value.from)
  nextFrom.setDate(nextFrom.getDate() + amount * (duration + 1))
  const nextTo = new Date(nextFrom)
  nextTo.setDate(nextTo.getDate() + duration)
  onChange("date", toIso(nextFrom))
  onChange("to", toIso(nextTo))
}
