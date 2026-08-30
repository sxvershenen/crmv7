import type { ElementType } from "react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type PageNavItem = {
  value: string
  label: string
  compactLabel?: string
  icon?: ElementType
  disabled?: boolean
}

export function PageNav({
  ariaLabel = "Разделы страницы",
  className,
  items,
  onValueChange,
  value,
}: {
  ariaLabel?: string
  className?: string
  items: PageNavItem[]
  onValueChange: (value: string) => void
  value: string
}) {
  return (
    <Tabs className={cn("min-w-0", className)} onValueChange={onValueChange} value={value}>
      <TabsList aria-label={ariaLabel} className="max-w-full justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" variant="line">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <TabsTrigger aria-label={item.label} className="p-2" disabled={item.disabled} key={item.value} value={item.value}>
              {Icon ? <Icon aria-hidden="true" data-icon="inline-start" /> : null}
              {item.compactLabel ? (
                <>
                  <span className="sm:hidden">{item.compactLabel}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </>
              ) : item.label}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}

export type ViewTabItem = {
  value: string
  label: string
  icon: ElementType
  disabled?: boolean
}

export function ViewTabs({
  ariaLabel = "Вид экрана",
  className,
  items,
  onValueChange,
  value,
}: {
  ariaLabel?: string
  className?: string
  items: ViewTabItem[]
  onValueChange: (value: string) => void
  value: string
}) {
  return (
    <Tabs className={cn("min-w-0", className)} onValueChange={onValueChange} value={value}>
      <TabsList aria-label={ariaLabel} className="gap-0 p-0.5 group-data-horizontal/tabs:h-8">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Tooltip key={item.value}>
              <TooltipTrigger
                render={
                  <TabsTrigger
                    aria-label={item.label}
                    className="size-7 min-w-7 flex-none p-0"
                    disabled={item.disabled}
                    value={item.value}
                  />
                }
              >
                <Icon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>{item.label}</TooltipContent>
            </Tooltip>
          )
        })}
      </TabsList>
    </Tabs>
  )
}
