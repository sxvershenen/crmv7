import { IconBath, IconBuildingCottage, IconMap, IconTent } from "@tabler/icons-react"
import { useLocation, useNavigate } from "react-router-dom"

import { PageNav } from "@crm/ui"

import type { ResourceKind } from "@app/entities/resources"
import { resourceKindLabels, resourceKinds } from "@app/entities/resources"

const icons = {
  houses: IconBuildingCottage,
  bath: IconBath,
  venues: IconMap,
  camping: IconTent,
} as const

const compactLabels = {
  houses: "Домики",
  bath: "Баня",
  venues: "Площадки",
  camping: "Кемпинг",
} as const

export function ResourceCategoryNav({ value }: { value: ResourceKind }) {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <PageNav
      ariaLabel="Направления ресурсов"
      items={resourceKinds.map((kind) => ({ compactLabel: compactLabels[kind], icon: icons[kind], label: resourceKindLabels[kind], value: kind }))}
      onValueChange={(kind) => navigate({ pathname: `/resources/${kind}`, search: location.search })}
      value={value}
    />
  )
}
