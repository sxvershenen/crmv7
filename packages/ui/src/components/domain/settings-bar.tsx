import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function SettingsBar({
  actions,
  className,
  filters,
  mobileActions,
  mobilePrimary,
  primary,
}: {
  actions?: ReactNode
  className?: string
  filters?: ReactNode
  mobileActions?: ReactNode
  mobilePrimary?: ReactNode
  primary: ReactNode
}) {
  return (
    <div
      data-slot="settings-bar"
      className={cn("rounded-lg border bg-surface-raised p-2 shadow-xs sm:p-3", className)}
    >
      <div className="flex min-h-8 items-center gap-2 md:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-2">{mobilePrimary ?? primary}</div>
        {mobileActions ?? actions ? <div className="ml-auto flex shrink-0 items-center gap-1">{mobileActions ?? actions}</div> : null}
      </div>
      <div className="hidden min-h-8 min-w-0 items-center gap-2 md:flex">
        <div className="flex min-w-0 shrink-0 items-center gap-2">{primary}</div>
        {filters ? <div className="flex min-w-0 flex-1 items-center gap-2">{filters}</div> : <div className="flex-1" />}
        {actions ? <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
    </div>
  )
}
