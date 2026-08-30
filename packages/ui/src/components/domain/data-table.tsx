import type { ComponentProps, ReactNode } from "react"
import { IconArrowsSort, IconChevronDown, IconChevronUp } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type SortDirection = "asc" | "desc"

export function DataTableShell({
  children,
  className,
  tableClassName,
  ...props
}: ComponentProps<"div"> & { children: ReactNode; tableClassName?: string }) {
  return (
    <div
      className={cn("overflow-x-auto rounded-xl border bg-surface-raised shadow-xs", className)}
      data-slot="data-table-shell"
      {...props}
    >
      <table className={cn("w-full border-collapse text-left text-xs font-normal", tableClassName)}>{children}</table>
    </div>
  )
}

export function SortableHeader({
  active = false,
  align = "left",
  children,
  className,
  direction = "asc",
  disabled = false,
  label,
  onSort,
  ...props
}: Omit<ComponentProps<"th">, "aria-sort"> & {
  active?: boolean
  align?: "left" | "right"
  direction?: SortDirection
  disabled?: boolean
  label?: ReactNode
  onSort: () => void
}) {
  const SortIcon = !active ? IconArrowsSort : direction === "asc" ? IconChevronUp : IconChevronDown
  return (
    <th
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-3 py-2 text-xs font-normal text-muted-foreground", align === "right" && "text-right", className)}
      {...props}
    >
      <Button
        className={cn("-mx-2 h-7 px-2 text-xs font-normal text-muted-foreground hover:text-foreground", align === "right" && "ml-auto")}
        disabled={disabled}
        onClick={onSort}
        size="xs"
        variant="ghost"
      >
        {label ?? children}
        <SortIcon aria-hidden="true" className={cn("size-3.5", !active && "opacity-40")} />
      </Button>
    </th>
  )
}

export function MainSecondaryCell({
  children,
  className,
  main,
  secondary,
  ...props
}: ComponentProps<"td"> & { main?: ReactNode; secondary?: ReactNode }) {
  return (
    <td className={cn("min-w-0 px-3 py-2.5 align-middle text-xs font-normal", className)} {...props}>
      {main !== undefined || secondary !== undefined ? (
        <div className="min-w-0">
          <div className="truncate text-xs font-normal text-foreground">{main}</div>
          {secondary !== undefined ? <div className="mt-0.5 truncate text-[11px] font-normal text-muted-foreground">{secondary}</div> : null}
        </div>
      ) : children}
    </td>
  )
}

export function RowActions({ children, className, ...props }: ComponentProps<"td">) {
  return (
    <td className={cn("w-12 px-2 py-2 align-middle", className)} {...props}>
      <div className="flex items-center justify-end gap-1">{children}</div>
    </td>
  )
}
