import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isEqual,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { ru } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { cn } from "../lib/cn"
import { Button, IconButton } from "./primitives"

export interface DateRange { from?: Date; to?: Date }
export interface CalendarPreset { label: string; range: DateRange }
export interface DateRangeCalendarProps {
  value: DateRange
  onChange: (range: DateRange) => void
  unavailable?: ((date: Date) => boolean) | undefined
  minDate?: Date
  maxDate?: Date
  month?: Date
  onMonthChange?: (month: Date) => void
  presets?: CalendarPreset[]
  className?: string
  locale?: typeof ru
}

const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

function withinRange(day: Date, range: DateRange, hoverDate?: Date) {
  if (!range.from) return false
  const end = range.to ?? hoverDate
  if (!end) return false
  const lower = isBefore(end, range.from) ? end : range.from
  const upper = isAfter(end, range.from) ? end : range.from
  return (isAfter(day, lower) || isEqual(day, lower)) && (isBefore(day, upper) || isEqual(day, upper))
}

export function DateRangeCalendar({ className, locale = ru, maxDate, minDate = startOfDay(new Date()), month, onChange, onMonthChange, presets = [], unavailable = () => false, value }: DateRangeCalendarProps) {
  const [localMonth, setLocalMonth] = useState(month ?? value.from ?? new Date())
  const [hoverDate, setHoverDate] = useState<Date>()
  const visibleMonth = month ?? localMonth
  const days = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 }),
  }), [visibleMonth])

  const disabled = (day: Date) =>
    (minDate ? isBefore(day, startOfDay(minDate)) : false) ||
    (maxDate ? isAfter(day, startOfDay(maxDate)) : false) ||
    unavailable(day)

  const moveMonth = (amount: number) => {
    const next = addMonths(visibleMonth, amount)
    if (month === undefined) setLocalMonth(next)
    onMonthChange?.(next)
  }

  const selectDay = (day: Date) => {
    if (disabled(day)) return
    if (!value.from || value.to) {
      onChange({ from: day })
      return
    }
    const from = isBefore(day, value.from) ? day : value.from
    const to = isBefore(day, value.from) ? value.from : day
    const containsUnavailable = eachDayOfInterval({ start: from, end: to }).some(disabled)
    if (containsUnavailable) {
      onChange({ from: day })
      return
    }
    onChange({ from, to })
  }

  return (
    <div className={cn("site-calendar", className)}>
      {presets.length ? <div className="site-cluster">{presets.map((preset) => <Button key={preset.label} type="button" variant="secondary" size="sm" onClick={() => onChange(preset.range)}>{preset.label}</Button>)}</div> : null}
      <div className="site-calendar__header">
        <IconButton type="button" label="Предыдущий месяц" variant="secondary" onClick={() => moveMonth(-1)}><ChevronLeft size={17} /></IconButton>
        <h3 className="site-calendar__title" aria-live="polite">{format(visibleMonth, "LLLL yyyy", { locale })}</h3>
        <IconButton type="button" label="Следующий месяц" variant="secondary" onClick={() => moveMonth(1)}><ChevronRight size={17} /></IconButton>
      </div>
      <div className="site-calendar__week" aria-hidden="true">{weekdays.map((weekday) => <div className="site-calendar__weekday" key={weekday}>{weekday}</div>)}</div>
      <div className="site-calendar__grid" role="grid" aria-label={format(visibleMonth, "LLLL yyyy", { locale })}>
        {days.map((day) => {
          const isStart = Boolean(value.from && isSameDay(day, value.from))
          const isEnd = Boolean(value.to && isSameDay(day, value.to))
          const isSelected = isStart || isEnd
          const isUnavailable = disabled(day)
          const inRange = withinRange(day, value, hoverDate)
          return (
            <button
              key={day.toISOString()}
              type="button"
              role="gridcell"
              className={cn(
                "site-calendar__day",
                !isSameMonth(day, visibleMonth) && "site-calendar__day--outside",
                isToday(day) && "site-calendar__day--today",
                inRange && "site-calendar__day--range",
                isSelected && "site-calendar__day--selected",
              )}
              disabled={isUnavailable}
              aria-label={format(day, "d MMMM yyyy", { locale })}
              aria-selected={isSelected || inRange}
              aria-current={isToday(day) ? "date" : undefined}
              onClick={() => selectDay(day)}
              onMouseEnter={() => { if (value.from && !value.to && !isUnavailable) setHoverDate(day) }}
              onMouseLeave={() => setHoverDate(undefined)}
            >
              {format(day, "d")}
            </button>
          )
        })}
      </div>
      <div className="site-calendar__legend"><span><i className="is-selected" />Выбрано</span><span><i className="is-unavailable" />Недоступно</span><span><i />Свободно</span></div>
    </div>
  )
}

export interface GuestStepperProps {
  label: ReactNode
  description?: ReactNode
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
}

export function GuestStepper({ description, label, max = 99, min = 0, onChange, value }: GuestStepperProps) {
  return <div className="site-stepper"><div><strong>{label}</strong>{description ? <div style={{ color: "var(--site-color-text-muted)", fontSize: "var(--site-text-caption)" }}>{description}</div> : null}</div><div className="site-stepper__controls"><IconButton type="button" label="Уменьшить" variant="secondary" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}><Minus size={15} /></IconButton><output aria-live="polite" style={{ minWidth: "2ch", textAlign: "center", fontWeight: 600 }}>{value}</output><IconButton type="button" label="Увеличить" variant="secondary" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}><Plus size={15} /></IconButton></div></div>
}

export interface BookingSummaryLine { label: ReactNode; value: ReactNode }
export interface BookingSummaryProps { lines: BookingSummaryLine[]; total?: ReactNode; totalLabel?: ReactNode; note?: ReactNode }

export function BookingSummary({ lines, note, total, totalLabel = "Предварительно" }: BookingSummaryProps) {
  return <div className="site-booking-summary">{lines.map((line, index) => <div className="site-booking-summary__row" key={index}><span>{line.label}</span><strong>{line.value}</strong></div>)}{total ? <div className="site-booking-summary__row site-booking-summary__total"><span>{totalLabel}</span><strong>{total}</strong></div> : null}{note ? <small style={{ color: "var(--site-color-text-muted)", lineHeight: 1.45 }}>{note}</small> : null}</div>
}
