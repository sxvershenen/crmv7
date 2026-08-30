import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatusBadge } from "@crm/ui"
import { eventStatuses, eventStatusMeta, type EventStatus } from "@app/entities/events"

export function EventStatusSelect({ label, onChange, value }: { label: string; onChange: (value: EventStatus) => void; value: EventStatus }) {
  const meta = eventStatusMeta[value]
  return (
    <Select onValueChange={(next) => next && onChange(next as EventStatus)} value={value}>
      <SelectTrigger aria-label={label} className="h-7 min-w-0 border-0 bg-transparent px-1.5 py-0 shadow-none hover:bg-muted" onClick={(event) => event.stopPropagation()}>
        <SelectValue><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></SelectValue>
      </SelectTrigger>
      <SelectContent align="end" className="min-w-40">{eventStatuses.map((status) => <SelectItem key={status} value={status}><StatusBadge tone={eventStatusMeta[status].tone}>{eventStatusMeta[status].label}</StatusBadge></SelectItem>)}</SelectContent>
    </Select>
  )
}
