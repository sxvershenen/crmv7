import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const statusStyles = {
  neutral: "border-border bg-muted text-foreground",
  info: "border-info/20 bg-info-subtle text-info-foreground",
  success: "border-success/20 bg-success-subtle text-success-foreground",
  warning: "border-warning/25 bg-warning-subtle text-warning-foreground",
  danger: "border-danger/20 bg-danger-subtle text-danger-foreground",
  conflict: "border-conflict/20 bg-danger-subtle text-conflict",
} as const

export type StatusTone = keyof typeof statusStyles

export function StatusBadge({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode
  className?: string
  tone?: StatusTone
}) {
  return (
    <Badge className={cn("font-normal", statusStyles[tone], className)} variant="outline">
      {children}
    </Badge>
  )
}
