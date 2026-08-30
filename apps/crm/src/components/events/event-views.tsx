import { IconAlertTriangle, IconDotsVertical, IconExternalLink, IconPhone, IconUser } from "@tabler/icons-react"
import { useNavigate } from "react-router-dom"

import {
  ActionableCard,
  Assignees,
  DataTableShell,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  MainSecondaryCell,
  PaymentProgress,
  RowActions,
  Skeleton,
  SortableHeader,
  StatusBadge,
} from "@crm/ui"

import type { CrmEvent, EventSortDirection, EventSortKey, EventStatus } from "@app/entities/events"
import { formatEventDateTime, formatEventTime } from "./event-format"
import { EventIcon } from "./event-presentation"
import { EventStatusSelect } from "./event-status-select"

type EventViewActions = {
  onAssign: (id: string) => void
  onStatusChange: (id: string, status: EventStatus) => void
}

export function EventsTableView({ items, onAssign, onSort, onStatusChange, sortDirection, sortKey }: { items: CrmEvent[]; onSort: (key: EventSortKey) => void; sortDirection: EventSortDirection; sortKey: EventSortKey } & EventViewActions) {
  return <><EventCards items={items} onAssign={onAssign} onStatusChange={onStatusChange} /><EventTable items={items} onAssign={onAssign} onSort={onSort} onStatusChange={onStatusChange} sortDirection={sortDirection} sortKey={sortKey} /></>
}

function EventTable({ items, onAssign, onSort, onStatusChange, sortDirection, sortKey }: { items: CrmEvent[]; onSort: (key: EventSortKey) => void; sortDirection: EventSortDirection; sortKey: EventSortKey } & EventViewActions) {
  const navigate = useNavigate()
  const header = (key: EventSortKey, label: string, className?: string) => <SortableHeader active={sortKey === key} className={className} direction={sortDirection} onSort={() => onSort(key)}>{label}</SortableHeader>
  return (
    <DataTableShell className="hidden lg:block" data-testid="desktop-events" tableClassName="min-w-[1080px] table-fixed">
      <thead className="border-b bg-muted/45"><tr>{header("name", "Мероприятие", "w-[225px]")}{header("client", "Клиент", "w-[155px]")}{header("date", "Дата и время", "w-[135px]")}{header("guests", "Гости", "w-[65px]")}{header("status", "Ответственный · статус", "w-[190px]")}{header("payment", "Оплата", "w-[165px]")}{header("risk", "Риск", "w-[100px]")}<th className="w-12"><span className="sr-only">Действия</span></th></tr></thead>
      <tbody className="divide-y">{items.map((item) => (
        <tr className="cursor-pointer outline-none hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" key={item.id} onClick={() => navigate(`/events/${item.id}`)} onKeyDown={(event) => event.key === "Enter" && navigate(`/events/${item.id}`)} tabIndex={0}>
          <td className="px-3 py-2 align-middle"><EventIdentity event={item} /></td>
          <MainSecondaryCell main={item.clientName} secondary={<a href={`tel:${item.phone.replace(/[^+\d]/g, "")}`} onClick={(event) => event.stopPropagation()}>{item.phone}</a>} />
          <MainSecondaryCell main={formatEventDateTime(item.startsAt)} secondary={`${formatEventTime(item.startsAt)}–${formatEventTime(item.endsAt)}`} />
          <MainSecondaryCell><span className="inline-flex items-center gap-1 tabular-nums"><IconUser aria-hidden="true" className="size-3.5 text-muted-foreground" />{item.guestCount}</span></MainSecondaryCell>
          <MainSecondaryCell onClick={(event) => event.stopPropagation()}><StatusAssignee event={item} onAssign={onAssign} onStatusChange={onStatusChange} /></MainSecondaryCell>
          <MainSecondaryCell><Payment event={item} /></MainSecondaryCell>
          <MainSecondaryCell>{item.hasConflict ? <StatusBadge tone="danger"><IconAlertTriangle aria-hidden="true" />Конфликт</StatusBadge> : <span className="text-muted-foreground">—</span>}</MainSecondaryCell>
          <RowActions onClick={(event) => event.stopPropagation()}><EventActions item={item} onOpen={() => navigate(`/events/${item.id}`)} /></RowActions>
        </tr>
      ))}</tbody>
    </DataTableShell>
  )
}

function EventCards({ items, onAssign, onStatusChange }: { items: CrmEvent[] } & EventViewActions) {
  const navigate = useNavigate()
  return (
    <section aria-label="Мероприятия" className="space-y-2 lg:hidden" data-testid="mobile-events">
      {items.map((item) => (
        <ActionableCard actions={<EventActions item={item} mobile onOpen={() => navigate(`/events/${item.id}`)} />} key={item.id} onOpen={() => navigate(`/events/${item.id}`)} openLabel={`Открыть мероприятие ${item.name}`}>
          <div className="pr-10"><EventIdentity event={item} /></div>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t pt-2"><div className="min-w-0"><p className="truncate">{item.clientName}</p><a className="pointer-events-auto mt-0.5 inline-flex text-[10px] text-muted-foreground" href={`tel:${item.phone.replace(/[^+\d]/g, "")}`}><IconPhone aria-hidden="true" className="mr-1 size-3" />{item.phone}</a></div><div className="text-right"><p className="tabular-nums">{formatEventDateTime(item.startsAt)}</p><p className="text-[10px] text-muted-foreground"><IconUser aria-hidden="true" className="mr-1 inline size-3" />{item.guestCount}</p></div></div>
          <div className="mt-2 border-t pt-2"><Payment event={item} /></div>
          <div className="pointer-events-auto mt-2 flex items-center justify-between gap-2 border-t pt-2" onClick={(event) => event.stopPropagation()}><StatusAssignee event={item} onAssign={onAssign} onStatusChange={onStatusChange} />{item.hasConflict ? <IconAlertTriangle aria-label="Есть конфликт" className="size-4 shrink-0 text-danger" /> : null}</div>
        </ActionableCard>
      ))}
    </section>
  )
}

export function EventIdentity({ event }: { event: CrmEvent }) {
  return <div className="flex min-w-0 items-start gap-2"><EventIcon className="mt-0.5 shrink-0" icon={event.categoryIcon} tone={event.categoryTone} /><div className="min-w-0"><p className="line-clamp-2 leading-4" title={event.name}>{event.name}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">#{event.id} · {event.categoryName}</p></div></div>
}

export function StatusAssignee({ event, onAssign, onStatusChange }: { event: CrmEvent } & EventViewActions) {
  return <div className="flex min-w-0 items-center gap-1.5"><Assignees assignLabel={`Назначить ответственного мероприятию ${event.name}`} emptyVariant="icon" onAssign={() => onAssign(event.id)} people={event.assignees} size="compact" /><EventStatusSelect label={`Статус мероприятия #${event.id}`} onChange={(status) => onStatusChange(event.id, status)} value={event.status} /></div>
}

function Payment({ event }: { event: CrmEvent }) {
  return <PaymentProgress className="w-full min-w-0" paid={event.paid} total={event.total} />
}

export function EventsLoading() {
  return <div aria-label="Загрузка мероприятий" role="status"><div className="hidden overflow-hidden rounded-xl border bg-surface-raised lg:block"><div className="h-9 border-b bg-muted/45" />{Array.from({ length: 5 }, (_, row) => <div className="grid grid-cols-7 gap-3 border-b px-3 py-3 last:border-0" key={row}>{Array.from({ length: 7 }, (_, cell) => <Skeleton className={cell === 0 ? "h-8" : "h-5"} key={cell} />)}</div>)}</div><div className="space-y-2 lg:hidden">{Array.from({ length: 4 }, (_, row) => <div className="space-y-3 rounded-xl border bg-surface-raised p-3" key={row}><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-32" /><Skeleton className="h-7 w-full" /></div>)}</div></div>
}

function EventActions({ item, mobile = false, onOpen }: { item: CrmEvent; mobile?: boolean; onOpen: () => void }) {
  return <DropdownMenu><DropdownMenuTrigger render={<IconButton className={mobile ? "size-10" : undefined} label={`Действия мероприятия ${item.name}`} size={mobile ? "icon-lg" : "icon-xs"} variant="ghost"><IconDotsVertical aria-hidden="true" /></IconButton>} /><DropdownMenuContent align="end"><DropdownMenuItem onClick={onOpen}><IconExternalLink aria-hidden="true" />Открыть</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
}
