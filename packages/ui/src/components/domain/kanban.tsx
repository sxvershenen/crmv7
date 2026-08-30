import type { ComponentProps, CSSProperties, ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function KanbanBoard({ children, className, columnCount, style, ...props }: ComponentProps<"div"> & { children: ReactNode; columnCount: number }) {
  return (
    <div
      className={cn("grid items-start gap-3", className)}
      data-slot="kanban-board"
      style={{ ...style, gridTemplateColumns: `repeat(${columnCount}, minmax(220px, 1fr))` } as CSSProperties}
      {...props}
    >
      {children}
    </div>
  )
}

export function KanbanColumn({
  attention,
  children,
  className,
  count,
  empty,
  emptyLabel = "Нет записей",
  isOver = false,
  label,
  markerClassName,
  setNodeRef,
}: {
  attention?: string
  children: ReactNode
  className?: string
  count: number
  empty?: boolean
  emptyLabel?: string
  isOver?: boolean
  label: string
  markerClassName?: string
  setNodeRef?: (node: HTMLElement | null) => void
}) {
  return (
    <section
      aria-label={`${label}: ${count}`}
      className={cn("min-w-0 rounded-xl border bg-surface-subtle", isOver && "ring-2 ring-ring", className)}
      data-slot="kanban-column"
      ref={setNodeRef}
    >
      <header className="flex h-10 items-center gap-2 rounded-t-xl border-b bg-surface-raised px-3">
        {markerClassName ? <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", markerClassName)} /> : null}
        <h2 className="text-xs font-normal">{label}</h2>
        <span className="text-[11px] tabular-nums text-muted-foreground">{count}</span>
        {attention ? <Badge className="ml-auto font-normal" variant="secondary">{attention}</Badge> : null}
      </header>
      <div className="min-h-40 space-y-2 p-2">
        {empty ? <p className="px-2 py-8 text-center text-[11px] text-muted-foreground">{emptyLabel}</p> : children}
      </div>
    </section>
  )
}

export function KanbanDropPlaceholder({ className, label, testId }: { className?: string; label: string; testId?: string }) {
  return <div aria-label={label} className={cn("h-20 rounded-xl border border-dashed border-ring bg-background/70 shadow-inner", className)} data-testid={testId} />
}
