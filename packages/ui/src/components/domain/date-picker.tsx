import { useState } from "react"
import { IconCalendar, IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
import { ru } from "date-fns/locale"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import { IconButton } from "./icon-button"

type DatePickerSharedProps = {
  className?: string
  density?: "compact" | "form"
  disabled?: boolean
  id?: string
  label?: string
  placeholder?: string
}

export type SingleDatePickerProps = DatePickerSharedProps & {
  mode?: "single"
  onValueChange: (value: Date | undefined) => void
  value: Date | undefined
}

export type RangeDatePickerProps = DatePickerSharedProps & {
  mode: "range"
  onValueChange: (value: DateRange | undefined) => void
  value: DateRange | undefined
}

export type DatePickerProps = SingleDatePickerProps | RangeDatePickerProps
export type { DateRange }

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

function formatDate(value: Date | undefined) {
  return value ? dateFormatter.format(value).replace(" г.", "") : ""
}

export function DatePicker(props: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const label = props.label ?? (props.mode === "range" ? "Диапазон дат" : "Дата")
  const displayValue = props.mode === "range"
    ? props.value?.from
      ? `${formatDate(props.value.from)}${props.value.to ? ` — ${formatDate(props.value.to)}` : ""}`
      : ""
    : formatDate(props.value)

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-label={label}
            className={cn("min-w-36 justify-start font-normal", props.density === "form" ? "text-[13px]" : "text-xs", !displayValue && "text-muted-foreground", props.className)}
            disabled={props.disabled}
            id={props.id}
            size={props.density === "form" ? "default" : "sm"}
            variant="outline"
          />
        }
      >
        <IconCalendar aria-hidden="true" />
        <span className="truncate">{displayValue || props.placeholder || label}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        {props.mode === "range" ? (
          <Calendar
            className="[--cell-size:--spacing(11)] sm:[--cell-size:--spacing(8)]"
            locale={ru}
            mode="range"
            numberOfMonths={1}
            onSelect={props.onValueChange}
            selected={props.value}
          />
        ) : (
          <Calendar
            className="[--cell-size:--spacing(11)] sm:[--cell-size:--spacing(8)]"
            locale={ru}
            mode="single"
            onSelect={(nextValue) => {
              props.onValueChange(nextValue)
              if (nextValue) setOpen(false)
            }}
            selected={props.value}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}

type DateNavigatorSharedProps = {
  className?: string
  disabled?: boolean
  nextLabel?: string
  onNext: () => void
  onPrevious: () => void
  previousLabel?: string
}

export type DateNavigatorProps = DateNavigatorSharedProps & DatePickerProps

export function DateNavigator({
  className,
  disabled,
  nextLabel = "Следующий период",
  onNext,
  onPrevious,
  previousLabel = "Предыдущий период",
  ...pickerProps
}: DateNavigatorProps) {
  return (
    <div className={cn("flex items-center gap-1", className)} data-slot="date-navigator">
      <IconButton disabled={disabled} label={previousLabel} onClick={onPrevious} variant="outline">
        <IconChevronLeft aria-hidden="true" />
      </IconButton>
      {pickerProps.mode === "range" ? (
        <DatePicker {...pickerProps} {...(disabled === undefined ? {} : { disabled })} mode="range" />
      ) : (
        <DatePicker {...pickerProps} {...(disabled === undefined ? {} : { disabled })} mode="single" />
      )}
      <IconButton disabled={disabled} label={nextLabel} onClick={onNext} variant="outline">
        <IconChevronRight aria-hidden="true" />
      </IconButton>
    </div>
  )
}
