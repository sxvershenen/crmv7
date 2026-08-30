import {
  IconDoorEnter,
  IconDoorExit,
  IconDots,
  IconHome,
  IconMap,
  IconBath,
  IconLock,
  IconSparkles,
  IconTent,
  IconUser,
} from "@tabler/icons-react"
import { Link } from "react-router-dom"

import {
  Assignees,
  DataTableShell,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconBox,
  IconButton,
  MainSecondaryCell,
  PaymentSummary,
  RowActions,
  SortableHeader,
  StatusBadge,
  cn,
} from "@crm/ui"

import type { Booking, BookingDataset, BookingOperation, BookingOperationKind, BookingResource, BookingSortKey, SortDirection } from "@app/entities/bookings"
import { bookingStatusMeta, operationLabels } from "@app/entities/bookings"
import { formatDate, time } from "./booking-date"

const operationIcons: Record<BookingOperationKind, typeof IconDoorEnter> = {
  arrival: IconDoorEnter,
  block: IconLock,
  departure: IconDoorExit,
  preparation: IconSparkles,
}

export function AgendaView({ data, date }: { data: BookingDataset; date: string }) {
  return (
    <div aria-label={`Agenda на ${formatDate(date)}`} className="space-y-3" role="region">
      {data.resources.map((resource) => (
        <AgendaResource
          key={resource.id}
          operations={data.operations.filter((operation) => operation.resourceId === resource.id)}
          resource={resource}
        />
      ))}
    </div>
  )
}

function AgendaResource({ operations, resource }: { operations: BookingOperation[]; resource: BookingResource }) {
  const Icon = resource.category === "houses" ? IconHome : resource.category === "bath" ? IconBath : resource.category === "venues" ? IconMap : IconTent
  return (
    <section aria-label={resource.name} className="min-w-0 overflow-hidden rounded-xl border bg-surface-raised">
      <div className="flex min-h-12 min-w-0 items-center gap-3 border-b bg-muted/45 px-3 py-2" data-slot="agenda-resource-header">
        <IconBox icon={Icon} size="sm" variant={resource.category === "houses" ? "info" : resource.category === "camping" ? "success" : resource.category === "bath" ? "warning" : resource.category === "venues" ? "danger" : "warning"} />
        <h2 className="min-w-0 flex-1 truncate text-xs font-medium" title={resource.name}>{resource.name}</h2>
      </div>
      {operations.length ? (
        <div className="divide-y">
          {operations.map((operation) => <AgendaOperationRow key={operation.id} operation={operation} />)}
        </div>
      ) : <p className="px-3 py-5 text-center text-[11px] font-normal text-muted-foreground">Операций в этот день нет</p>}
    </section>
  )
}

function AgendaOperationRow({ operation }: { operation: BookingOperation }) {
  const Icon = operationIcons[operation.kind]
  return (
    <article className={cn("group relative min-w-0 transition-colors hover:bg-muted/55", operation.status === "cancelled" && "opacity-50")} data-slot="agenda-operation-row">
      <Link aria-label={`Открыть бронирование #${operation.bookingId}`} className="absolute inset-0 z-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" to={`/bookings/${operation.bookingId}`} />
      <div className="pointer-events-none relative z-[1] grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2">
        <IconBox icon={Icon} size="sm" variant={operation.kind === "block" ? "warning" : "neutral"} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-normal"><span className="truncate">{operationLabels[operation.kind]}</span><span className="tabular-nums">{operation.timeLabel}</span></div>
          <p className="mt-0.5 truncate text-[11px] font-normal leading-tight text-muted-foreground">{operation.clientName} · #{operation.bookingId}</p>
        </div>
        <StatusBadge tone={bookingStatusMeta[operation.status].tone}>{bookingStatusMeta[operation.status].label}</StatusBadge>
      </div>
    </article>
  )
}

export function BookingTable({ assignedIds, bookings, onAssign, onSort, sortDirection, sortKey }: { assignedIds: string[]; bookings: Booking[]; onAssign: (id: string) => void; onSort: (key: BookingSortKey) => void; sortDirection: SortDirection; sortKey: BookingSortKey }) {
  const header = (key: BookingSortKey, label: string, className?: string) => (
    <SortableHeader active={sortKey === key} className={className} direction={sortDirection} onSort={() => onSort(key)}>{label}</SortableHeader>
  )
  return (
    <DataTableShell tableClassName="min-w-[980px] table-fixed">
      <thead className="border-b bg-muted/45"><tr>
        {header("id", "#ID", "w-20")}
        {header("client", "Клиент")}
        {header("arrival", "Заезд / выезд", "w-40")}
        {header("resource", "Состав брони")}
        {header("status", "Статус", "w-32")}
        {header("total", "Оплата", "w-48")}
        {header("assignee", "Ответственный", "w-28")}
        <th className="w-12 px-2 py-2"><span className="sr-only">Действия</span></th>
      </tr></thead>
      <tbody className="divide-y">{bookings.map((booking) => <BookingTableRow assigned={assignedIds.includes(booking.id)} booking={booking} key={booking.id} onAssign={() => onAssign(booking.id)} />)}</tbody>
    </DataTableShell>
  )
}

function BookingTableRow({ assigned, booking, onAssign }: { assigned: boolean; booking: Booking; onAssign: () => void }) {
  const people = assigned && booking.assignees.length === 0 ? [{ id: "current", initials: "МК", name: "Марина Кириллова", colorClass: "bg-sky-100 text-sky-700" }] : booking.assignees
  return (
    <tr className={cn("hover:bg-muted/45", booking.status === "cancelled" && "opacity-50")}>
      <MainSecondaryCell main={<Link className="underline-offset-2 hover:underline" to={`/bookings/${booking.id}`}>#{booking.id}</Link>} />
      <MainSecondaryCell main={booking.clientName} secondary={booking.phone} />
      <MainSecondaryCell main={`${formatDate(booking.date)}, ${time(booking.startHour)}`} secondary={`выезд ${time(booking.endHour)}`} />
      <MainSecondaryCell main={booking.resourceName} secondary={<span className="inline-flex items-center gap-1"><span aria-hidden="true">·</span><IconUser aria-label="Количество человек" className="size-3.5" />{booking.guestCount}</span>} />
      <MainSecondaryCell><StatusBadge tone={bookingStatusMeta[booking.status].tone}>{bookingStatusMeta[booking.status].label}</StatusBadge></MainSecondaryCell>
      <MainSecondaryCell><PaymentSummary paid={booking.paid} total={booking.amount} /></MainSecondaryCell>
      <MainSecondaryCell><Assignees people={people} {...(people.length === 0 ? { onAssign } : {})} /></MainSecondaryCell>
      <RowActions><BookingActions booking={booking} /></RowActions>
    </tr>
  )
}

function BookingActions({ booking }: { booking: Booking }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<IconButton label={`Действия бронирования #${booking.id}`} variant="ghost"><IconDots /></IconButton>} />
      <DropdownMenuContent align="end"><DropdownMenuItem render={<Link to={`/bookings/${booking.id}`} />}>Открыть</DropdownMenuItem></DropdownMenuContent>
    </DropdownMenu>
  )
}

export function BookingsLoading() {
  return <div aria-label="Загрузка бронирований" className="space-y-3" role="status">{[0, 1, 2].map((item) => <div className="h-28 animate-pulse rounded-xl border bg-muted/35" key={item} />)}</div>
}
