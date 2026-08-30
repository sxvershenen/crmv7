import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

const widthClasses = {
  content: "max-w-6xl",
  full: "max-w-none",
  wide: "max-w-[1440px]",
} as const

export type PageFrameProps = ComponentProps<"div"> & {
  width?: keyof typeof widthClasses
}

/** Operational page container. The authoritative page title stays in the CRM topbar. */
export function PageFrame({ className, width = "wide", ...props }: PageFrameProps) {
  return (
    <div
      data-slot="page-frame"
      className={cn("mx-auto w-full px-3 py-3 sm:px-5 sm:py-4 xl:px-6", widthClasses[width], className)}
      {...props}
    />
  )
}
