import type { ReactNode } from "react"

import { cn } from "@crm/ui"

import type { ProgramCategoryIcon, ProgramCategoryTone } from "@app/entities/programs"
import { ProgramIcon } from "./program-presentation"

export function ProgramIdentity({ className, icon, secondary, title, tone }: { className?: string; icon: ProgramCategoryIcon; secondary: ReactNode; title: string; tone: ProgramCategoryTone }) {
  return (
    <div className={cn("flex min-w-0 items-start gap-2", className)} data-slot="program-identity">
      <ProgramIcon icon={icon} tone={tone} />
      <div className="min-w-0 flex-1 pt-px" data-slot="program-identity-stack">
        <p className="truncate text-xs font-normal leading-4 text-foreground" title={title}>{title}</p>
        <div className="mt-0.5 truncate text-[10px] font-normal leading-4 text-muted-foreground">{secondary}</div>
      </div>
    </div>
  )
}
