import type { CSSProperties, ElementType, ReactNode } from "react"
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconCheck,
  IconClock,
  IconHourglass,
  IconTool,
  IconUsers,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { StatusBadge } from "./status-badge"

const bookingToneConfig = {
  confirmed: {
    card: "border-info/20 bg-info-subtle text-info-foreground hover:bg-info-subtle dark:hover:bg-info-subtle",
    foreground: "text-info-foreground",
    secondary: "text-info-foreground/75",
    statusTone: "info",
    statusIcon: IconCheck,
  },
  conflict: {
    card: "border-danger/20 bg-danger-subtle text-danger-foreground hover:bg-danger-subtle dark:hover:bg-danger-subtle",
    foreground: "text-danger-foreground",
    secondary: "text-danger-foreground/75",
    statusTone: "danger",
    statusIcon: IconAlertTriangle,
  },
  neutral: {
    card: "border-border bg-muted text-foreground hover:bg-muted dark:hover:bg-muted",
    foreground: "text-foreground",
    secondary: "text-foreground/65",
    statusTone: "neutral",
    statusIcon: IconCalendarEvent,
  },
  paid: {
    card: "border-success/20 bg-success-subtle text-success-foreground hover:bg-success-subtle dark:hover:bg-success-subtle",
    foreground: "text-success-foreground",
    secondary: "text-success-foreground/75",
    statusTone: "success",
    statusIcon: IconCheck,
  },
  pending: {
    card: "border-warning/25 bg-warning-subtle text-warning-foreground hover:bg-warning-subtle dark:hover:bg-warning-subtle",
    foreground: "text-warning-foreground",
    secondary: "text-warning-foreground/75",
    statusTone: "warning",
    statusIcon: IconHourglass,
  },
} as const

export type SchedulerBookingTone = keyof typeof bookingToneConfig
export type SchedulerBookingDensity = "auto" | "compact" | "comfortable" | "default"

export type SchedulerBookingBlockProps = {
  actionSlot?: ReactNode
  ariaLabel?: string
  bottomResizeSlot?: ReactNode
  className?: string
  density?: SchedulerBookingDensity
  guests?: ReactNode
  height?: number
  icon?: ElementType
  id?: ReactNode
  onClick: () => void
  secondary?: ReactNode
  statusLabel: ReactNode
  timeLabel?: ReactNode
  title: ReactNode
  tone?: SchedulerBookingTone
  topResizeSlot?: ReactNode
}

function resolveDensity(density: SchedulerBookingDensity, height: number | undefined) {
  if (density !== "auto") return density
  if (height !== undefined && height < 72) return "compact"
  if (height !== undefined && height >= 132) return "comfortable"
  return "default"
}

export function SchedulerBookingBlock({
  actionSlot,
  ariaLabel,
  bottomResizeSlot,
  className,
  density = "auto",
  guests,
  height,
  id,
  onClick,
  secondary,
  statusLabel,
  timeLabel,
  title,
  tone = "confirmed",
  topResizeSlot,
}: SchedulerBookingBlockProps) {
  const config = bookingToneConfig[tone]
  const resolvedDensity = resolveDensity(density, height)
  const style: CSSProperties | undefined = height === undefined ? undefined : { height }

  return (
    <div
      className={cn("relative min-h-12 w-full min-w-0", config.foreground, className)}
      data-density={resolvedDensity}
      data-slot="scheduler-booking-block"
      data-tone={tone}
      style={style}
    >
      <Button
        aria-label={ariaLabel}
        className={cn(
          "absolute inset-0 h-full w-full min-w-0 items-stretch justify-start overflow-hidden whitespace-normal rounded-lg border p-0 text-left text-xs font-normal shadow-sm hover:brightness-[0.99] hover:shadow-md",
          config.card,
        )}
        onClick={onClick}
        variant="ghost"
      >
        <span className={cn("flex min-w-0 flex-1", resolvedDensity === "compact" ? "items-center px-2 py-1 pr-9" : "items-start p-3.5")}>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-start justify-between gap-2 pr-7">
              <span className="truncate text-xs font-normal text-current">{title}</span>
              {resolvedDensity !== "compact" && id !== undefined ? <span className={cn("shrink-0 text-[10px] font-normal tabular-nums", config.secondary)}>{id}</span> : null}
            </span>
            {resolvedDensity === "comfortable" && secondary !== undefined ? (
              <span className={cn("mt-0.5 block truncate text-[11px] font-normal", config.secondary)}>{secondary}</span>
            ) : null}
            {resolvedDensity !== "compact" ? (
              <>
                <StatusBadge className="mt-1.5 inline-flex max-w-full items-center gap-1 text-[10px] leading-3" tone={config.statusTone}>
                  <config.statusIcon aria-hidden="true" className="size-3" />
                  <span className="truncate">{statusLabel}</span>
                </StatusBadge>
                {timeLabel !== undefined || guests !== undefined ? (
                  <span className={cn("mt-1.5 flex min-w-0 flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-normal", config.secondary)}>
                    {timeLabel !== undefined ? <span className="inline-flex items-center gap-1"><IconClock aria-hidden="true" className="size-3.5" />{timeLabel}</span> : null}
                    {guests !== undefined ? <span className="inline-flex items-center gap-1"><IconUsers aria-hidden="true" className="size-3.5" />{guests}</span> : null}
                  </span>
                ) : null}
              </>
            ) : null}
          </span>
        </span>
      </Button>
      {actionSlot !== undefined ? <div className="absolute right-2 top-2 z-20" data-slot="scheduler-booking-actions">{actionSlot}</div> : null}
      {topResizeSlot !== undefined ? <div className="absolute inset-x-0 top-0 z-10" data-slot="scheduler-resize-top">{topResizeSlot}</div> : null}
      {bottomResizeSlot !== undefined ? <div className="absolute inset-x-0 bottom-0 z-10" data-slot="scheduler-resize-bottom">{bottomResizeSlot}</div> : null}
    </div>
  )
}

const preparationToneClasses = {
  danger: "border-danger/20 bg-danger-subtle text-danger-foreground",
  neutral: "border-border bg-surface-sunken text-foreground",
  warning: "border-warning/25 bg-warning-subtle text-warning-foreground",
} as const

export function PreparationBlock({
  className,
  height,
  icon: Icon = IconTool,
  label,
  onClick,
  timeLabel,
  tone = "neutral",
}: {
  className?: string
  height?: number
  icon?: ElementType
  label: ReactNode
  onClick?: () => void
  timeLabel?: ReactNode
  tone?: keyof typeof preparationToneClasses
}) {
  const content = (
    <>
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {timeLabel !== undefined ? <span className="shrink-0 tabular-nums text-current/70">{timeLabel}</span> : null}
    </>
  )
  const sharedClassName = cn(
    "flex min-h-8 w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[10px] font-normal",
    preparationToneClasses[tone],
    className,
  )
  const style: CSSProperties | undefined = height === undefined ? undefined : { height }

  if (onClick) {
    return (
      <Button className={sharedClassName} data-slot="preparation-block" onClick={onClick} style={style} variant="ghost">
        {content}
      </Button>
    )
  }

  return <div className={sharedClassName} data-slot="preparation-block" style={style}>{content}</div>
}
