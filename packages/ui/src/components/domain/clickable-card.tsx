import type { ComponentProps } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ClickableCard({ className, ...props }: Omit<ComponentProps<typeof Button>, "size" | "variant">) {
  return (
    <Button
      className={cn(
        "h-auto min-h-11 w-full items-start justify-start whitespace-normal rounded-xl border bg-card p-3 text-left text-xs font-normal text-card-foreground shadow-xs hover:bg-muted/50 hover:shadow-sm",
        className,
      )}
      data-slot="clickable-card"
      size="default"
      variant="ghost"
      {...props}
    />
  )
}
