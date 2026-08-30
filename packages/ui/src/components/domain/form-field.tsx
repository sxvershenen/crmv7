import type { ReactNode } from "react"

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

import type { FilterSelectOption } from "./filter-select"

export function FormField({ children, className, error, htmlFor, label }: { children: ReactNode; className?: string; error?: string | undefined; htmlFor: string; label: string }) {
  return <div className={cn("space-y-1.5", className)} data-slot="form-field"><Label className="text-xs font-medium" htmlFor={htmlFor}>{label}</Label>{children}{error ? <p className="text-[11px] text-danger-foreground">{error}</p> : null}</div>
}

export function FormSelect({ className, disabled = false, id, label, onValueChange, options, placeholder, value }: { className?: string; disabled?: boolean; id: string; label: string; onValueChange: (value: string) => void; options: FilterSelectOption[]; placeholder?: string; value: string }) {
  return <Select disabled={disabled} onValueChange={(nextValue) => nextValue !== null && onValueChange(nextValue)} value={value}><SelectTrigger aria-label={label} className={cn("w-full max-w-none text-[13px] font-normal", className)} id={id}><SelectValue>{options.find((option) => option.value === value)?.label ?? placeholder ?? label}</SelectValue></SelectTrigger><SelectContent align="start">{options.map((option) => <SelectItem disabled={option.disabled} key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
}
