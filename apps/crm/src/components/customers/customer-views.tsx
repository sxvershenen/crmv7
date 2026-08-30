import { IconAlertTriangle, IconCopy, IconDotsVertical, IconPhone, IconUser } from "@tabler/icons-react"
import { useNavigate } from "react-router-dom"

import {
  Assignees,
  ClickableCard,
  DataTableShell,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  MainSecondaryCell,
  RowActions,
  Skeleton,
  SortableHeader,
} from "@crm/ui"

import type { Customer, CustomerDuplicateRisk, CustomerSortDirection, CustomerSortKey } from "@app/entities/customers"
import { duplicateRiskLabels } from "@app/entities/customers"

const moneyFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0, style: "currency", currency: "RUB" })

type CustomerViewsProps = {
  customers: Customer[]
  onAssign: (customerId: string) => void
}

export function CustomerTable({ customers, onAssign, onSort, sortDirection, sortKey }: CustomerViewsProps & { onSort: (key: CustomerSortKey) => void; sortDirection: CustomerSortDirection; sortKey: CustomerSortKey }) {
  const navigate = useNavigate()

  return (
    <DataTableShell className="hidden lg:block" data-testid="desktop-customers-table" tableClassName="min-w-[1080px] table-fixed">
      <thead className="border-b bg-muted/45"><tr>
        <SortableHeader active={sortKey === "client"} className="w-[250px]" direction={sortDirection} onSort={() => onSort("client")}>Клиент</SortableHeader>
        <SortableHeader active={sortKey === "leads"} className="w-[92px]" direction={sortDirection} onSort={() => onSort("leads")}>Заявки</SortableHeader>
        <SortableHeader active={sortKey === "bookings"} className="w-[92px]" direction={sortDirection} onSort={() => onSort("bookings")}>Брони</SortableHeader>
        <SortableHeader active={sortKey === "tasks"} className="w-[70px]" direction={sortDirection} onSort={() => onSort("tasks")}>Задачи</SortableHeader>
        <SortableHeader active={sortKey === "turnover"} className="w-[95px]" direction={sortDirection} onSort={() => onSort("turnover")}>Оборот</SortableHeader>
        <SortableHeader active={sortKey === "debt"} className="w-[80px]" direction={sortDirection} onSort={() => onSort("debt")}>Долг</SortableHeader>
        <SortableHeader active={sortKey === "duplicateRisk"} className="w-[130px]" direction={sortDirection} onSort={() => onSort("duplicateRisk")}>Риск дубля</SortableHeader>
        <SortableHeader active={sortKey === "nextContact"} className="w-[125px]" direction={sortDirection} onSort={() => onSort("nextContact")}>След. контакт</SortableHeader>
        <SortableHeader active={sortKey === "assignee"} className="w-[130px]" direction={sortDirection} onSort={() => onSort("assignee")}>Ответственные</SortableHeader>
        <th className="w-12 px-2 py-2"><span className="sr-only">Действия</span></th>
      </tr></thead>
      <tbody className="divide-y">
        {customers.map((customer) => (
          <tr
            aria-label={`Открыть клиента ${customer.name}`}
            className="cursor-pointer outline-none hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            key={customer.id}
            onClick={() => navigate(`/customers/${customer.id}`)}
            onKeyDown={(event) => { if (event.key === "Enter") navigate(`/customers/${customer.id}`) }}
            tabIndex={0}
          >
            <MainSecondaryCell
              className="max-w-72"
              main={<span className="block truncate" title={customer.name}>{customer.name}</span>}
              secondary={<a className="hover:underline" href={phoneHref(customer)} onClick={(event) => event.stopPropagation()}>{customer.phone}</a>}
            />
            <MainSecondaryCell main={customer.leadCount} secondary={customer.activeLeadCount > 0 ? `${customer.activeLeadCount} активн.` : "Нет активных"} />
            <MainSecondaryCell main={customer.bookingCount} secondary={customer.futureBookingCount > 0 ? `${customer.futureBookingCount} будущ.` : "Нет будущих"} />
            <MainSecondaryCell className="tabular-nums">{customer.taskCount}</MainSecondaryCell>
            <MoneyCell value={customer.turnover} />
            <MoneyCell debt value={customer.debt} />
            <MainSecondaryCell><DuplicateRisk risk={customer.duplicateRisk} /></MainSecondaryCell>
            <MainSecondaryCell className="whitespace-nowrap tabular-nums">{customer.nextContactLabel ?? <span className="text-muted-foreground">Не назначен</span>}</MainSecondaryCell>
            <MainSecondaryCell onClick={(event) => event.stopPropagation()}>
              {customer.assignees.length === 0
                ? <Assignees onAssign={() => onAssign(customer.id)} people={[]} size="compact" />
                : <Assignees people={customer.assignees} size="compact" />}
            </MainSecondaryCell>
            <RowActions onClick={(event) => event.stopPropagation()}><CustomerActions customer={customer} /></RowActions>
          </tr>
        ))}
      </tbody>
    </DataTableShell>
  )
}

export function CustomerCards({ customers, onAssign }: CustomerViewsProps) {
  const navigate = useNavigate()
  return (
    <section aria-label="Список клиентов" className="space-y-2 lg:hidden" data-testid="mobile-customers-list">
      {customers.map((customer) => (
        <article className="relative min-h-28" key={customer.id}>
          <ClickableCard aria-label={`Открыть клиента ${customer.name}`} className="absolute inset-0 h-full min-h-0 p-0" onClick={() => navigate(`/customers/${customer.id}`)} />
          <div className="pointer-events-none relative p-3 pr-24 text-xs font-normal">
            <p className="line-clamp-2 leading-4" title={customer.name}>{customer.name}</p>
            <p className="mt-1 truncate text-[11px] tabular-nums text-muted-foreground">{customer.phone}</p>
            <div className="mt-4">
              <p className="text-[10px] font-normal text-muted-foreground">Долг</p>
              <p className="mt-0.5 tabular-nums">{customer.debt > 0 ? moneyFormatter.format(customer.debt) : <span className="text-muted-foreground">Нет</span>}</p>
            </div>
          </div>
          <div className="absolute right-1.5 top-1.5 z-10 flex items-center">
            <IconButton className="size-11" label={`Позвонить ${customer.name}`} nativeButton={false} render={<a href={phoneHref(customer)} />} size="icon-lg" variant="ghost"><IconPhone aria-hidden="true" /></IconButton>
            <CustomerActions customer={customer} mobile />
          </div>
          <div className="absolute bottom-2 right-3 z-10">
            {customer.assignees.length === 0
              ? <Assignees onAssign={() => onAssign(customer.id)} people={[]} size="compact" />
              : <Assignees people={customer.assignees} size="compact" />}
          </div>
        </article>
      ))}
    </section>
  )
}

export function CustomersLoading() {
  return (
    <div aria-label="Загрузка клиентов" role="status">
      <div className="hidden overflow-hidden rounded-xl border bg-surface-raised lg:block">
        <div className="h-9 border-b bg-muted/45" />
        {Array.from({ length: 6 }, (_, index) => <div className="grid grid-cols-[2fr_repeat(8,1fr)_48px] gap-3 border-b px-3 py-2.5 last:border-0" key={index}><Skeleton className="h-8" />{Array.from({ length: 9 }, (_, item) => <Skeleton className="h-5" key={item} />)}</div>)}
      </div>
      <div className="space-y-2 lg:hidden">{Array.from({ length: 4 }, (_, index) => <div className="space-y-3 rounded-xl border bg-surface-raised p-3" key={index}><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-32" /><Skeleton className="h-8 w-full" /></div>)}</div>
    </div>
  )
}

function MoneyCell({ debt = false, value }: { debt?: boolean; value: number }) {
  return <MainSecondaryCell className="whitespace-nowrap tabular-nums">{value > 0 ? moneyFormatter.format(value) : debt ? <span className="text-muted-foreground">Нет</span> : moneyFormatter.format(0)}</MainSecondaryCell>
}

function DuplicateRisk({ risk }: { risk: CustomerDuplicateRisk }) {
  const Icon = risk === "none" ? IconCopy : IconAlertTriangle
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-normal text-muted-foreground"><Icon aria-hidden="true" className="size-3.5" />{duplicateRiskLabels[risk]}</span>
}

function CustomerActions({ customer, mobile = false }: { customer: Customer; mobile?: boolean }) {
  const navigate = useNavigate()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<IconButton className={mobile ? "size-11" : undefined} label={`Действия клиента ${customer.name}`} size={mobile ? "icon-lg" : "icon-xs"} variant="ghost"><IconDotsVertical aria-hidden="true" /></IconButton>} />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem className="text-xs" onClick={() => navigate(`/customers/${customer.id}`)}><IconUser aria-hidden="true" />Открыть клиента</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs" onClick={() => { window.location.href = phoneHref(customer) }}><IconPhone aria-hidden="true" />Позвонить</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function phoneHref(customer: Customer) {
  return `tel:${customer.phone.replace(/[^+\d]/g, "")}`
}
