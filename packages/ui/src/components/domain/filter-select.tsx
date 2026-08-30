import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type FilterSelectOption = {
  value: string
  label: string
  disabled?: boolean
}

export function FilterSelect({
  className,
  label,
  onValueChange,
  options,
  placeholder,
  value,
}: {
  className?: string
  label: string
  onValueChange: (value: string) => void
  options: FilterSelectOption[]
  placeholder?: string
  value: string
}) {
  return (
    <Select onValueChange={(nextValue) => nextValue !== null && onValueChange(nextValue)} value={value}>
      <SelectTrigger aria-label={label} className={cn("max-w-52 text-xs font-normal", className)} size="sm">
        <SelectValue>{options.find((option) => option.value === value)?.label ?? placeholder ?? label}</SelectValue>
      </SelectTrigger>
      <SelectContent align="start">
        {options.map((option) => (
          <SelectItem disabled={option.disabled} key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
