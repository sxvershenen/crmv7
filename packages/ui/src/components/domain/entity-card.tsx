import { IconPlus, IconUserOff } from "@tabler/icons-react"
import type { ElementType, ReactNode } from "react"

import { Avatar, AvatarFallback, AvatarGroupCount } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import type { Assignee } from "./assignees"

export function EntityCardLayout({ children, className, dataSlot = "entity-card-layout", rail }: { children: ReactNode; className?: string; dataSlot?: string; rail?: ReactNode }) {
  return <div className={cn("w-full min-w-0 text-xs font-normal", rail && "grid grid-cols-[minmax(0,1fr)_2rem] items-start gap-2", className)} data-slot={dataSlot}><div className="min-w-0" data-slot="entity-card-main">{children}</div>{rail}</div>
}

export function EntityCardDetails({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-2 space-y-1.5 text-muted-foreground", className)} data-slot="entity-card-details">{children}</div>
}

export function EntityCardInfoRow({ children, className, icon: Icon }: { children: ReactNode; className?: string; icon: ElementType }) {
  return <div className={cn("flex min-w-0 items-center gap-1.5 leading-4 text-muted-foreground", className)} data-slot="entity-card-info"><Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />{children}</div>
}

export function EntityCardRail({ children, className, dataSlot = "entity-card-rail" }: { children: ReactNode; className?: string; dataSlot?: string }) {
  return <div className={cn("flex w-8 flex-col items-center gap-2", className)} data-slot={dataSlot}>{children}</div>
}

export function EntityCardAssignees({ assignLabel = "Назначить ответственного", dataSlot = "entity-card-assignees", onAssign, people }: { assignLabel?: string; dataSlot?: string; onAssign?: () => void; people: Assignee[] }) {
  if (people.length === 0) {
    return onAssign
      ? <Button aria-label={assignLabel} className="pointer-events-auto size-6 rounded-full border-dashed bg-muted/40 p-0 text-muted-foreground shadow-none" onClick={onAssign} size="icon-xs" variant="outline"><IconPlus aria-hidden="true" className="size-3.5" /></Button>
      : <span aria-label="Без ответственного" className="inline-flex size-6 items-center justify-center rounded-full bg-muted/50 text-muted-foreground" role="img"><IconUserOff aria-hidden="true" className="size-3.5" /></span>
  }

  return <div aria-label={`Ответственные: ${people.map((person) => person.name).join(", ")}`} className="flex flex-col -space-y-1.5" data-slot={dataSlot} role="group">{people.slice(0, 3).map((person) => <Avatar className="size-6 after:hidden" key={person.id} title={person.name}><AvatarFallback className={cn("text-[9px] font-normal", person.colorClass)}>{person.initials}</AvatarFallback></Avatar>)}{people.length > 3 ? <Tooltip><TooltipTrigger render={<AvatarGroupCount aria-label={`Ещё ${people.length - 3} ответственных`} className="size-6 cursor-help text-[9px] ring-0" role="img" />}>+{people.length - 3}</TooltipTrigger><TooltipContent className="grid gap-1" side="left"><span className="text-[10px] opacity-70">Все ответственные</span>{people.map((person) => <span key={person.id}>{person.name}</span>)}</TooltipContent></Tooltip> : null}</div>
}
