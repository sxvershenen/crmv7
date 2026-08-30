import type { ElementType } from "react"
import { IconBath, IconBuildingCottage, IconFlame, IconHome, IconMap, IconTent, IconTrees } from "@tabler/icons-react"

import { IconBox, cn, type IconBoxVariant } from "@crm/ui"

import type { ResourceColorKey, ResourceKind } from "@app/entities/resources"

const categoryPresentation: Record<ResourceKind, { fallback: ElementType; color: ResourceColorKey }> = {
  houses: { fallback: IconBuildingCottage, color: "blue" },
  bath: { fallback: IconBath, color: "orange" },
  venues: { fallback: IconMap, color: "violet" },
  camping: { fallback: IconTent, color: "green" },
}

const colorVariants: Record<ResourceColorKey, IconBoxVariant> = {
  blue: "resourceHouses",
  orange: "resourceBath",
  violet: "resourceVenues",
  green: "resourceCamping",
  rose: "danger",
  amber: "warning",
  sky: "info",
  slate: "neutral",
}

const iconRegistry: Record<string, ElementType> = {
  bath: IconBath,
  cottage: IconBuildingCottage,
  flame: IconFlame,
  home: IconHome,
  map: IconMap,
  tent: IconTent,
  trees: IconTrees,
}

const customColorClasses: Record<ResourceColorKey, string> = { blue: "bg-blue-100", orange: "bg-orange-100", violet: "bg-violet-100", green: "bg-emerald-100", rose: "bg-rose-100", amber: "bg-amber-100", sky: "bg-sky-100", slate: "bg-slate-100" }

export function ResourceIdentityIcon({ color, customIconDataUrl, iconKey, kind, size = "md" }: { color?: ResourceColorKey; customIconDataUrl?: string; iconKey: string; kind: ResourceKind; size?: "sm" | "md" }) {
  const presentation = categoryPresentation[kind]
  if (customIconDataUrl) return <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md", size === "sm" ? "size-8" : "size-10", customColorClasses[color ?? presentation.color])}><img alt="" className="size-2/3 object-contain" src={customIconDataUrl} /></span>
  return <IconBox icon={iconRegistry[iconKey] ?? presentation.fallback} size={size} variant={colorVariants[color ?? presentation.color]} />
}
