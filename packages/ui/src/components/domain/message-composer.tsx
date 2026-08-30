import { IconSend } from "@tabler/icons-react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type MessageComposerOption = {
  label: string
  value: string
}

export function MessageComposer({
  ariaLabel = "Новое сообщение",
  className,
  disabled,
  onSend,
  onTypeChange,
  onValueChange,
  placeholder = "Напишите сообщение…",
  sendLabel = "Отправить",
  type,
  typeOptions = [],
  value,
}: {
  ariaLabel?: string
  className?: string
  disabled?: boolean
  onSend: () => void
  onTypeChange?: (value: string) => void
  onValueChange: (value: string) => void
  placeholder?: string
  sendLabel?: string
  type?: string
  typeOptions?: MessageComposerOption[]
  value: string
}) {
  const canSend = Boolean(value.trim()) && !disabled

  return (
    <InputGroup className={cn("bg-background", className)} data-slot="message-composer">
      <InputGroupTextarea
        aria-label={ariaLabel}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canSend) {
            event.preventDefault()
            onSend()
          }
        }}
        placeholder={placeholder}
        rows={3}
        value={value}
      />
      <InputGroupAddon align="block-end" className="justify-between gap-2 border-t px-2 py-1.5">
        {type && onTypeChange && typeOptions.length ? (
          <Select onValueChange={(next) => next !== null && onTypeChange(next)} value={type}>
            <SelectTrigger aria-label="Тип коммуникации" className="h-7 max-w-[min(15rem,70vw)] border-0 bg-muted/70 px-2 shadow-none" size="sm">
              <SelectValue>{typeOptions.find((option) => option.value === type)?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent align="start">
              {typeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : <span className="text-[10px] font-normal text-muted-foreground">⌘ Enter</span>}
        <InputGroupButton
          aria-label={sendLabel}
          className="ml-auto rounded-full"
          disabled={!canSend}
          onClick={onSend}
          size="icon-sm"
          variant="default"
        >
          <IconSend aria-hidden="true" />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
