import { FilterSelect, SettingsBar } from "@crm/ui"

import type { ResourceBlockFilter, ResourceWarningFilter } from "@app/entities/resources"

const blockOptions = [
  { label: "Все блокировки", value: "all" },
  { label: "Есть блокировка", value: "active" },
  { label: "Без блокировки", value: "none" },
]

const warningOptions = [
  { label: "Все предупреждения", value: "all" },
  { label: "С предупреждениями", value: "with" },
]

export function ResourceControls({
  block,
  onBlockChange,
  onWarningChange,
  warning,
}: {
  block: ResourceBlockFilter
  onBlockChange: (value: ResourceBlockFilter) => void
  onWarningChange: (value: ResourceWarningFilter) => void
  warning: ResourceWarningFilter
}) {
  const blockSelect = (
    <FilterSelect
      className="w-[9.25rem]"
      label="Блокировка"
      onValueChange={(value) => onBlockChange(value as ResourceBlockFilter)}
      options={blockOptions}
      value={block}
    />
  )
  const warningSelect = (
    <FilterSelect
      className="w-[10.5rem]"
      label="Предупреждения"
      onValueChange={(value) => onWarningChange(value as ResourceWarningFilter)}
      options={warningOptions}
      value={warning}
    />
  )

  return (
    <SettingsBar
      filters={warningSelect}
      mobilePrimary={<>{blockSelect}{warningSelect}</>}
      primary={blockSelect}
    />
  )
}
