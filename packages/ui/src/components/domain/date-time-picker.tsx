import { useEffect, useMemo, useState } from "react"
import { IconCalendarTime } from "@tabler/icons-react"
import { ru } from "date-fns/locale"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

function parseLocalDateTime(value: string) {
  if (!value) return undefined
  const [datePart = ""] = value.split("T")
  const [year, month, day] = datePart.split("-").map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

function formatDatePart(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" })

function displayDateTime(value: string) {
  const date = parseLocalDateTime(value)
  const time = value.split("T")[1]
  if (!date) return ""
  return `${dateTimeFormatter.format(date).replace(" г.", "")}${time ? `, ${time}` : ""}`
}

function calendarBounds() {
  const year = new Date().getFullYear()
  return { startMonth: new Date(year - 30, 0), endMonth: new Date(year + 10, 11) }
}

export function DateTimePicker({ className, disabled, id, label = "Дата и время", onValueChange, placeholder, value }: {
  className?: string
  disabled?: boolean
  id?: string
  label?: string
  onValueChange: (value: string) => void
  placeholder?: string
  value: string
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [datePart = "", timePart = ""] = draft.split("T")

  useEffect(() => { if (!open) setDraft(value) }, [open, value])

  return <Popover onOpenChange={(next) => { setOpen(next); if (next) setDraft(value) }} open={open}>
    <PopoverTrigger render={<Button aria-label={label} className={cn("w-full min-w-0 justify-start text-[13px] font-normal", !value && "text-muted-foreground", className)} disabled={disabled} id={id} variant="outline" />}>
      <IconCalendarTime aria-hidden="true" />
      <span className="truncate">{displayDateTime(value) || placeholder || label}</span>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-[min(calc(100vw-2rem),22rem)] p-0">
      <Calendar {...calendarBounds()} captionLayout="dropdown" className="mx-auto [--cell-size:--spacing(10)] sm:[--cell-size:--spacing(8)]" locale={ru} mode="single" onSelect={(next) => setDraft(next ? `${formatDatePart(next)}T${timePart || "12:00"}` : "")} selected={parseLocalDateTime(draft)} />
      <div className="grid gap-3 border-t p-3">
        <label className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 text-xs"><span className="text-muted-foreground">Время</span><Input aria-label={`${label}: время`} disabled={!datePart} onChange={(event) => setDraft(`${datePart}T${event.target.value}`)} type="time" value={timePart} /></label>
        <div className="flex justify-between gap-2">
          <Button onClick={() => { onValueChange(""); setOpen(false) }} size="sm" type="button" variant="ghost">Очистить</Button>
          <Button disabled={!datePart || !timePart} onClick={() => { onValueChange(`${datePart}T${timePart}`); setOpen(false) }} size="sm" type="button">Готово</Button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
}

export type DateTimeRangeValue = { from: string; to: string }

export function DateTimeRangePicker({ className, disabled, id, label = "Период", onValueChange, placeholder, value }: {
  className?: string
  disabled?: boolean
  id?: string
  label?: string
  onValueChange: (value: DateTimeRangeValue) => void
  placeholder?: string
  value: DateTimeRangeValue
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const selected = useMemo<DateRange | undefined>(() => {
    const from = parseLocalDateTime(draft.from)
    const to = parseLocalDateTime(draft.to)
    return from ? { from, ...(to ? { to } : {}) } : undefined
  }, [draft])
  const fromTime = draft.from.split("T")[1] ?? ""
  const toTime = draft.to.split("T")[1] ?? ""
  const display = value.from && value.to ? `${displayDateTime(value.from)} — ${displayDateTime(value.to)}` : ""

  useEffect(() => { if (!open) setDraft(value) }, [open, value])

  return <Popover onOpenChange={(next) => { setOpen(next); if (next) setDraft(value) }} open={open}>
    <PopoverTrigger render={<Button aria-label={label} className={cn("w-full min-w-0 justify-start text-[13px] font-normal", !display && "text-muted-foreground", className)} disabled={disabled} id={id} variant="outline" />}>
      <IconCalendarTime aria-hidden="true" /><span className="truncate">{display || placeholder || label}</span>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-[min(calc(100vw-2rem),22rem)] p-0">
      <Calendar {...calendarBounds()} captionLayout="dropdown" className="mx-auto [--cell-size:--spacing(10)] sm:[--cell-size:--spacing(8)]" locale={ru} mode="range" onSelect={(next) => setDraft({ from: next?.from ? `${formatDatePart(next.from)}T${fromTime || "12:00"}` : "", to: next?.to ? `${formatDatePart(next.to)}T${toTime || "12:00"}` : "" })} selected={selected} />
      <div className="grid grid-cols-2 gap-3 border-t p-3">
        <label className="grid gap-1 text-xs"><span className="text-muted-foreground">Начало</span><Input aria-label={`${label}: время начала`} disabled={!draft.from} onChange={(event) => setDraft((current) => ({ ...current, from: `${current.from.split("T")[0]}T${event.target.value}` }))} type="time" value={fromTime} /></label>
        <label className="grid gap-1 text-xs"><span className="text-muted-foreground">Окончание</span><Input aria-label={`${label}: время окончания`} disabled={!draft.to} onChange={(event) => setDraft((current) => ({ ...current, to: `${current.to.split("T")[0]}T${event.target.value}` }))} type="time" value={toTime} /></label>
        <div className="col-span-2 flex justify-between gap-2">
          <Button onClick={() => { onValueChange({ from: "", to: "" }); setOpen(false) }} size="sm" type="button" variant="ghost">Очистить</Button>
          <Button disabled={!draft.from || !draft.to || !fromTime || !toTime || draft.from >= draft.to} onClick={() => { onValueChange(draft); setOpen(false) }} size="sm" type="button">Готово</Button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
}
