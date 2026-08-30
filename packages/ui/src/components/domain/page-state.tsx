import type { ElementType, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import { IconBox } from "./icon-box"

export function PageState({
  actionLabel,
  children,
  icon,
  onAction,
  title,
  tone = "neutral",
}: {
  actionLabel?: string
  children?: ReactNode
  icon: ElementType
  onAction?: () => void
  title: string
  tone?: "neutral" | "danger" | "success" | "warning"
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center gap-3 p-6 text-center">
      <IconBox icon={icon} variant={tone} />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {children ? <div className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{children}</div> : null}
      </div>
      {actionLabel ? (
        <Button onClick={onAction} size="sm" variant="outline">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}

export function LoadingRows({ count = 3, className }: { className?: string; count?: number }) {
  return (
    <div aria-label="Загрузка" aria-live="polite" className={cn("divide-y", className)} role="status">
      {Array.from({ length: count }, (_, index) => (
        <div className="flex min-h-20 items-center gap-3 px-4 py-3" key={index}>
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  )
}
