import type { ElementType } from "react"
import { IconBuilding, IconBus, IconCake, IconHeart } from "@tabler/icons-react"

import { IconBox, cn } from "@crm/ui"
import type { EventCategoryIcon, EventCategoryTone } from "@app/entities/events"

const icons: Record<EventCategoryIcon, ElementType> = { heart: IconHeart, building: IconBuilding, cake: IconCake, bus: IconBus }
const tones: Record<EventCategoryTone, string> = {
  rose: "bg-rose-100 text-rose-700", violet: "bg-violet-100 text-violet-700", amber: "bg-amber-100 text-amber-700", sky: "bg-sky-100 text-sky-700",
}

export function EventIcon({ className, icon, size = "sm", tone }: { className?: string; icon: EventCategoryIcon; size?: "sm" | "md"; tone: EventCategoryTone }) {
  return <IconBox className={cn(tones[tone], className)} icon={icons[icon]} size={size} variant="event" />
}
