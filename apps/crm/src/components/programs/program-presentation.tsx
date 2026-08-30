import type { ElementType } from "react"
import { IconCampfire, IconLeaf, IconPalette, IconSnowflake, IconSparkles } from "@tabler/icons-react"

import { IconBox, cn } from "@crm/ui"

import type { ProgramCategoryIcon, ProgramCategoryTone } from "@app/entities/programs"

const icons: Record<ProgramCategoryIcon, ElementType> = {
  campfire: IconCampfire,
  leaf: IconLeaf,
  palette: IconPalette,
  snowflake: IconSnowflake,
  sparkles: IconSparkles,
}

const tones: Record<ProgramCategoryTone, string> = {
  amber: "bg-amber-100 text-amber-700",
  emerald: "bg-emerald-100 text-emerald-700",
  violet: "bg-violet-100 text-violet-700",
  sky: "bg-sky-100 text-sky-700",
  rose: "bg-rose-100 text-rose-700",
}

export function ProgramIcon({ className, icon, size = "sm", tone }: { className?: string; icon: ProgramCategoryIcon; size?: "sm" | "md"; tone: ProgramCategoryTone }) {
  return <IconBox className={cn(tones[tone], className)} icon={icons[icon]} size={size} variant="program" />
}
