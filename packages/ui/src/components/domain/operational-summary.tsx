import { useId, useState, type ElementType, type ReactNode } from "react"
import { IconChevronDown } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { type IconBoxVariant } from "./icon-box"
import { ListRow, ListSection } from "./list-section"

export function OperationalSummary({
  critical,
  criticalCount,
  details,
  detailsCount,
  icon,
  title = "Операционная сводка",
  tone = "neutral",
}: {
  critical?: ReactNode
  criticalCount?: number
  details: ReactNode
  detailsCount: number
  icon: ElementType
  title?: string
  tone?: IconBoxVariant
}) {
  const [open, setOpen] = useState(false)
  const detailsId = useId()
  const total = (criticalCount ?? 0) + detailsCount

  return <div className="overflow-hidden rounded-xl border bg-background" data-slot="operational-summary"><ListSection count={total} icon={icon} title={title} tone={tone}>{critical}<ListRow className="xl:hidden"><Button aria-controls={detailsId} aria-expanded={open} className="h-10 w-full justify-between rounded-none px-4 text-xs text-muted-foreground" onClick={() => setOpen((value) => !value)} variant="ghost"><span>{open ? "Скрыть детали" : `Показать детали · ${detailsCount}`}</span><IconChevronDown aria-hidden="true" className={cn("transition-transform", open && "rotate-180")} /></Button></ListRow><div className={cn("divide-y divide-border xl:contents", open ? "block" : "hidden")} id={detailsId}>{details}</div></ListSection></div>
}
