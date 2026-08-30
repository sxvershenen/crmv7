import type { ComponentProps, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export type IconButtonProps = Omit<ComponentProps<typeof Button>, "children" | "size"> & {
  children: ReactNode
  label: string
  size?: "icon" | "icon-lg" | "icon-sm" | "icon-xs"
  tooltipSide?: ComponentProps<typeof TooltipContent>["side"]
}

export function IconButton({
  children,
  label,
  size = "icon-sm",
  tooltipSide,
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button aria-label={label} size={size} {...props} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  )
}
