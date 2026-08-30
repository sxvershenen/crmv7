import type { ReactNode } from "react"

import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

import { IconBox, type IconBoxVariant } from "./icon-box"

export function ListSection({
  children,
  className,
  count,
  icon,
  title,
  tone = "neutral",
}: {
  children: ReactNode
  className?: string
  count: number
  icon: React.ElementType
  title: string
  tone?: IconBoxVariant
}) {
  return (
    <section aria-labelledby={`section-${title}`} className={cn("min-w-0", className)} data-slot="list-section">
      <header className="flex min-h-12 items-center gap-3 px-4 py-3 sm:px-5">
        <IconBox icon={icon} size="sm" variant={tone} />
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-5" id={`section-${title}`}>
          {title}
        </h2>
        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal tabular-nums text-muted-foreground">
          {count}
        </span>
      </header>
      <Separator />
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}

export function ListRow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn("min-w-0", className)} data-slot="list-row">{children}</div>
}
