import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
} from "@crm/ui"

import type { ProgramRegistrationStatus, ProgramRunStatus } from "@app/entities/programs"
import { programRegistrationStatuses, programRegistrationStatusMeta, programRunStatuses, programRunStatusMeta } from "@app/entities/programs"

type ProgramStatusSelectProps =
  | { kind: "run"; label: string; onChange: (status: ProgramRunStatus) => void; value: ProgramRunStatus }
  | { kind: "registration"; label: string; onChange: (status: ProgramRegistrationStatus) => void; value: ProgramRegistrationStatus }

export function ProgramStatusSelect(props: ProgramStatusSelectProps) {
  const statuses = props.kind === "run" ? programRunStatuses : programRegistrationStatuses
  const meta = props.kind === "run" ? programRunStatusMeta[props.value] : programRegistrationStatusMeta[props.value]
  const onChange = (value: string | null) => {
    if (!value) return
    if (props.kind === "run") props.onChange(value as ProgramRunStatus)
    else props.onChange(value as ProgramRegistrationStatus)
  }

  return (
    <Select onValueChange={onChange} value={props.value}>
      <SelectTrigger aria-label={props.label} className="h-7 min-w-0 border-0 bg-transparent px-1.5 py-0 shadow-none hover:bg-muted" onClick={(event) => event.stopPropagation()}>
        <SelectValue><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></SelectValue>
      </SelectTrigger>
      <SelectContent align="end" className="min-w-44">
        {statuses.map((status) => {
          const option = props.kind === "run" ? programRunStatusMeta[status as ProgramRunStatus] : programRegistrationStatusMeta[status as ProgramRegistrationStatus]
          return <SelectItem key={status} value={status}><StatusBadge tone={option.tone}>{option.label}</StatusBadge></SelectItem>
        })}
      </SelectContent>
    </Select>
  )
}
