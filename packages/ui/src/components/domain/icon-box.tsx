import type { ElementType, HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

const iconBoxVariants = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-info-subtle text-info-foreground",
  success: "bg-success-subtle text-success-foreground",
  warning: "bg-warning-subtle text-warning-foreground",
  danger: "bg-danger-subtle text-danger-foreground",
  stay: "bg-category-stay-subtle text-category-stay",
  program: "bg-category-program-subtle text-category-program",
  event: "bg-category-event-subtle text-category-event",
  task: "bg-category-task-subtle text-category-task",
  resourceHouses: "bg-resource-houses-subtle text-resource-houses",
  resourceBath: "bg-resource-bath-subtle text-resource-bath",
  resourceVenues: "bg-resource-venues-subtle text-resource-venues",
  resourceCamping: "bg-resource-camping-subtle text-resource-camping",
} as const

export type IconBoxVariant = keyof typeof iconBoxVariants

type IconBoxProps = HTMLAttributes<HTMLSpanElement> & {
  icon: ElementType
  label?: string
  size?: "sm" | "md" | "lg"
  variant?: IconBoxVariant
}

export function IconBox({
  className,
  icon: Icon,
  label,
  size = "md",
  variant = "neutral",
  ...props
}: IconBoxProps) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg",
        size === "sm" ? "size-7" : size === "lg" ? "size-11" : "size-9",
        iconBoxVariants[variant],
        className,
      )}
      role={label ? "img" : undefined}
      {...props}
    >
      <Icon aria-hidden="true" className={size === "sm" ? "size-4" : size === "lg" ? "size-5" : "size-[18px]"} stroke={1.8} />
    </span>
  )
}
