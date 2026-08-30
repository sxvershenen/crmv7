import type { ElementType, ReactNode } from "react"

import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

import { IconBox, type IconBoxVariant } from "./icon-box"

export function SummaryMetric({
  children,
  className,
  icon,
  label,
  tone = "neutral",
  value,
}: {
  children: ReactNode
  className?: string
  icon: ElementType
  label: string
  tone?: IconBoxVariant
  value: number | string
}) {
  return (
    <article className={cn("overflow-hidden rounded-xl border bg-surface-raised shadow-[0_1px_2px_rgb(0_0_0/0.02)]", className)} data-slot="summary-metric">
      <header className="flex min-h-12 items-center gap-2.5 px-3 py-2.5">
        <IconBox icon={icon} size="sm" variant={tone} />
        <h2 className="min-w-0 flex-1 truncate text-xs font-normal leading-5">{label}</h2>
        <span className="shrink-0 text-base font-normal tabular-nums text-foreground">{value}</span>
      </header>
      <Separator />
      <div className="min-h-10 px-3 py-2 text-[10px] font-normal leading-[14px] text-muted-foreground">{children}</div>
    </article>
  )
}
