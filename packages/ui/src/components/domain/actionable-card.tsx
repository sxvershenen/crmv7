import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function ActionableCard({
  actions,
  children,
  className,
  contentClassName,
  onOpen,
  openLabel,
}: {
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  onOpen: () => void
  openLabel: string
}) {
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card text-xs font-normal text-card-foreground shadow-xs",
        className,
      )}
      data-slot="actionable-card"
    >
      <button
        aria-label={openLabel}
        className="absolute inset-0 z-0 rounded-xl bg-transparent transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        onClick={onOpen}
        type="button"
      />
      <div className={cn("pointer-events-none relative z-[1] p-3", contentClassName)}>{children}</div>
      {actions ? <div className="absolute right-2 top-2 z-10 flex items-center gap-1">{actions}</div> : null}
    </article>
  )
}
