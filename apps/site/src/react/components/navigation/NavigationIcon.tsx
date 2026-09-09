import {
  ArrowRight,
  Calculator,
  CalendarDays,
  Compass,
  Flame,
  Home,
  Layers,
  MapPin,
  Sparkles,
} from "lucide-react"
import type { SiteNavigationIcon } from "@crm/site-ui"

const icons = {
  home: Home,
  flame: Flame,
  sparkles: Sparkles,
  layers: Layers,
  calendar: CalendarDays,
  compass: Compass,
  "map-pin": MapPin,
  calculator: Calculator,
  "arrow-right": ArrowRight,
} satisfies Record<SiteNavigationIcon, typeof Home>

export function NavigationIcon({ icon, color }: { icon: SiteNavigationIcon; color?: string | undefined }) {
  const Icon = icons[icon]
  return <Icon aria-hidden="true" className="h-4 w-4" style={color ? { color } : undefined} />
}
