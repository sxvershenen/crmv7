import {
  IconAlertTriangle,
  IconCheck,
  IconLoader2,
  IconPencil,
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"

const stateConfig = {
  dirty: {
    icon: IconPencil,
    label: "Есть изменения",
    styles: "border-warning/25 bg-warning-subtle text-warning-foreground",
  },
  saving: {
    icon: IconLoader2,
    label: "Сохранение",
    styles: "border-info/20 bg-info-subtle text-info-foreground",
  },
  saved: {
    icon: IconCheck,
    label: "Сохранено",
    styles: "border-success/25 bg-background text-success-foreground",
  },
  conflict: {
    icon: IconAlertTriangle,
    label: "Конфликт версий",
    styles: "border-danger/25 bg-background text-danger-foreground",
  },
} as const

export type EditorSaveState = keyof typeof stateConfig

export function EditorSaveStateIndicator({
  className,
  detail,
  state,
}: {
  className?: string
  detail?: string
  state: EditorSaveState
}) {
  const config = stateConfig[state]
  const Icon = config.icon

  return (
    <div
      aria-live="polite"
      className={cn(
        "inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] leading-4",
        config.styles,
        className,
      )}
      role={state === "conflict" ? "alert" : "status"}
    >
      <Icon
        aria-hidden="true"
        className={cn("size-3.5 shrink-0", state === "saving" && "animate-spin")}
        stroke={1.8}
      />
      <span className="font-medium">{config.label}</span>
      {detail ? <span className="truncate opacity-80">{detail}</span> : null}
    </div>
  )
}
