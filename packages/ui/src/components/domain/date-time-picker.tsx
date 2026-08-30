import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { DatePicker } from "./date-picker"

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

export function DateTimePicker({
  className,
  disabled,
  id,
  label = "Дата и время",
  onValueChange,
  value,
}: {
  className?: string
  disabled?: boolean
  id?: string
  label?: string
  onValueChange: (value: string) => void
  value: string
}) {
  const [datePart = "", timePart = ""] = value.split("T")

  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)_7rem] gap-2", className)} data-slot="date-time-picker">
      <DatePicker
        className="w-full min-w-0"
        density="form"
        {...(disabled === undefined ? {} : { disabled })}
        {...(id === undefined ? {} : { id })}
        label={label}
        onValueChange={(next) => onValueChange(next ? `${formatDatePart(next)}T${timePart || "12:00"}` : "")}
        value={parseLocalDateTime(value)}
      />
      <Input
        aria-label={`${label}: время`}
        disabled={disabled || !datePart}
        onChange={(event) => onValueChange(`${datePart}T${event.target.value}`)}
        type="time"
        value={timePart}
      />
    </div>
  )
}
