import { IconDotsVertical, IconEdit, IconPhone, IconUser } from "@tabler/icons-react"
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
  Progress,
  RowActions,
  Skeleton,
  SortableHeader,
  StatusBadge,
  cn,
} from "@crm/ui"

import type {
  ProgramRegistration,
  ProgramRegistrationSortKey,
  ProgramRegistrationStatus,
  ProgramRun,
  ProgramRunSortKey,
  ProgramRunStatus,
  ProgramSortDirection,
  ProgramTemplate,
  ProgramTemplateSortKey,
} from "@app/entities/programs"
import { formatDuration, formatProgramDateTime, formatProgramTime } from "./program-format"
import { ProgramIdentity } from "./program-identity"
import { ProgramStatusSelect } from "./program-status-select"

const money = new Intl.NumberFormat("ru-RU", { currency: "RUB", maximumFractionDigits: 0, style: "currency" })

type SortProps<T> = { onSort: (key: T) => void; sortDirection: ProgramSortDirection; sortKey: T }

export function ProgramTemplatesView({ items, onAssign, ...sort }: { items: ProgramTemplate[]; onAssign: (id: string) => void } & SortProps<ProgramTemplateSortKey>) {
  return <><ProgramTemplateCards items={items} onAssign={onAssign} /><ProgramTemplateTable items={items} onAssign={onAssign} {...sort} /></>
}

function ProgramTemplateTable({ items, onAssign, onSort, sortDirection, sortKey }: { items: ProgramTemplate[]; onAssign: (id: string) => void } & SortProps<ProgramTemplateSortKey>) {
  const navigate = useNavigate()
  const header = (key: ProgramTemplateSortKey, label: string, className?: string) => <SortableHeader active={sortKey === key} className={className} direction={sortDirection} onSort={() => onSort(key)}>{label}</SortableHeader>
  return (
    <DataTableShell className="hidden lg:block" data-testid="desktop-program-templates" tableClassName="min-w-[1040px] table-fixed">
      <thead className="border-b bg-muted/45"><tr>
        {header("name", "Программа", "w-[270px]")}{header("category", "Категория", "w-[125px]")}{header("duration", "Длительность", "w-[105px]")}{header("limit", "Лимит", "w-[75px]")}{header("price", "Стоимость", "w-[125px]")}{header("publication", "Ответственный · статус", "w-[205px]")}{header("nextRun", "Ближайшее проведение", "w-[160px]")}<th className="w-12"><span className="sr-only">Действия</span></th>
      </tr></thead>
      <tbody className="divide-y">{items.map((item) => (
        <tr className="cursor-pointer outline-none hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" key={item.id} onClick={() => navigate(`/programs/${item.id}`)} onKeyDown={(event) => event.key === "Enter" && navigate(`/programs/${item.id}`)} tabIndex={0}>
          <MainSecondaryCell><ProgramIdentity icon={item.categoryIcon} secondary={`Версия ${item.version} · изменено ${formatProgramDateTime(item.updatedAt)}`} title={item.name} tone={item.categoryTone} /></MainSecondaryCell>
          <MainSecondaryCell>{item.categoryName}</MainSecondaryCell>
          <MainSecondaryCell className="tabular-nums">{formatDuration(item.durationMinutes)}</MainSecondaryCell>
          <MainSecondaryCell className="tabular-nums"><span className="inline-flex items-center gap-1"><IconUser aria-hidden="true" className="size-3.5 text-muted-foreground" />{item.participantLimit}</span></MainSecondaryCell>
          <MainSecondaryCell className="whitespace-nowrap tabular-nums">{money.format(item.basePrice)}</MainSecondaryCell>
          <MainSecondaryCell onClick={(event) => event.stopPropagation()}><AssigneeStatusRow assignLabel={`Назначить ответственного шаблону ${item.name}`} onAssign={() => onAssign(item.id)} people={item.assignees}><StatusBadge tone={item.published ? "success" : "neutral"}>{item.published ? "Опубликовано" : "Черновик"}</StatusBadge></AssigneeStatusRow></MainSecondaryCell>
          <MainSecondaryCell main={item.nextRun ? formatProgramDateTime(item.nextRun.startsAt) : <span className="text-muted-foreground">Не назначено</span>} secondary={item.nextRun ? `#${item.nextRun.id.replace("run-", "")}` : undefined} />
          <RowActions onClick={(event) => event.stopPropagation()}><ItemActions editLabel="Редактировать шаблон" onOpen={() => navigate(`/programs/${item.id}`)} /></RowActions>
        </tr>
      ))}</tbody>
    </DataTableShell>
  )
}

function ProgramTemplateCards({ items, onAssign }: { items: ProgramTemplate[]; onAssign: (id: string) => void }) {
  const navigate = useNavigate()
  return (
    <section aria-label="Шаблоны программ" className="space-y-2 lg:hidden" data-testid="mobile-program-templates">
      {items.map((item) => (
        <ActionableCard actions={<ItemActions editLabel="Редактировать шаблон" mobile onOpen={() => navigate(`/programs/${item.id}`)} />} key={item.id} onOpen={() => navigate(`/programs/${item.id}`)} openLabel={`Открыть шаблон ${item.name}`}>
          <ProgramIdentity className="pr-11 [&_p]:line-clamp-2 [&_p]:whitespace-normal" icon={item.categoryIcon} secondary={`Версия ${item.version} · ${item.categoryName}`} title={item.name} tone={item.categoryTone} />
          <div className="mt-3 grid grid-cols-3 divide-x border-t pt-2 text-[11px]"><Metric label="Длительность">{formatDuration(item.durationMinutes)}</Metric><Metric className="pl-2" label="Лимит"><IconUser aria-hidden="true" className="size-3" />{item.participantLimit}</Metric><Metric className="pl-2" label="Стоимость">{money.format(item.basePrice)}</Metric></div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2 text-[10px] text-muted-foreground"><span className="truncate">{item.nextRun ? formatProgramDateTime(item.nextRun.startsAt) : "Проведение не назначено"}</span></div>
          <AssigneeStatusRow assignLabel={`Назначить ответственного шаблону ${item.name}`} className="mt-2 border-t pt-2" onAssign={() => onAssign(item.id)} people={item.assignees}><StatusBadge tone={item.published ? "success" : "neutral"}>{item.published ? "Опубликовано" : "Черновик"}</StatusBadge></AssigneeStatusRow>
        </ActionableCard>
      ))}
    </section>
  )
}

export function ProgramRunsView({ items, onAssign, onStatusChange, ...sort }: { items: ProgramRun[]; onAssign: (id: string) => void; onStatusChange: (id: string, status: ProgramRunStatus) => void } & SortProps<ProgramRunSortKey>) {
  return <><ProgramRunCards items={items} onAssign={onAssign} onStatusChange={onStatusChange} /><ProgramRunTable items={items} onAssign={onAssign} onStatusChange={onStatusChange} {...sort} /></>
}

function ProgramRunTable({ items, onAssign, onSort, onStatusChange, sortDirection, sortKey }: { items: ProgramRun[]; onAssign: (id: string) => void; onStatusChange: (id: string, status: ProgramRunStatus) => void } & SortProps<ProgramRunSortKey>) {
  const navigate = useNavigate()
  const header = (key: ProgramRunSortKey, label: string, className?: string) => <SortableHeader active={sortKey === key || (key === "revenue" && sortKey === "paid")} className={className} direction={sortDirection} onSort={() => onSort(key)} title={key === "revenue" && sortKey === "paid" ? "Сортировка по оплаченной сумме" : undefined}>{label}</SortableHeader>
  return (
    <DataTableShell className="hidden lg:block" data-testid="desktop-program-runs" tableClassName="min-w-[1120px] table-fixed">
      <thead className="border-b bg-muted/45"><tr>{header("name", "Проведение", "w-[250px]")}{header("date", "День и время", "w-[150px]")}{header("participants", "Участники", "w-[130px]")}{header("registrations", "Регистрации", "w-[130px]")}{header("status", "Ответственный / статус", "w-[205px]")}{header("revenue", "Выручка", "w-[135px]")}<th className="w-12"><span className="sr-only">Действия</span></th></tr></thead>
      <tbody className="divide-y">{items.map((item) => (
        <tr className="cursor-pointer outline-none hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" key={item.id} onClick={() => navigate(`/programs/runs/${item.id}`)} onKeyDown={(event) => event.key === "Enter" && navigate(`/programs/runs/${item.id}`)} tabIndex={0}>
          <MainSecondaryCell><ProgramIdentity icon={item.categoryIcon} secondary={`#${item.id}`} title={item.name} tone={item.categoryTone} /></MainSecondaryCell>
          <MainSecondaryCell main={formatProgramDateTime(item.startsAt)} secondary={`${formatProgramTime(item.startsAt)}–${formatProgramTime(item.endsAt)}`} />
          <MainSecondaryCell><Capacity value={item.participantCount} limit={item.participantLimit} label="Участников" /></MainSecondaryCell>
          <MainSecondaryCell><Capacity value={item.registrationCount} limit={item.registrationLimit} label="Регистраций" /></MainSecondaryCell>
          <MainSecondaryCell onClick={(event) => event.stopPropagation()}><AssigneeStatusRow assignLabel={`Назначить ответственного проведению ${item.name}`} onAssign={() => onAssign(item.id)} people={item.assignees}><ProgramStatusSelect kind="run" label={`Статус проведения #${item.id}`} onChange={(status) => onStatusChange(item.id, status)} value={item.status} /></AssigneeStatusRow></MainSecondaryCell>
          <MainSecondaryCell><PaymentProgress className="w-full min-w-0" paid={item.paid} total={item.revenue} /></MainSecondaryCell>
          <RowActions onClick={(event) => event.stopPropagation()}><ItemActions editLabel="Открыть проведение" onOpen={() => navigate(`/programs/runs/${item.id}`)} /></RowActions>
        </tr>
      ))}</tbody>
    </DataTableShell>
  )
}

function ProgramRunCards({ items, onAssign, onStatusChange }: { items: ProgramRun[]; onAssign: (id: string) => void; onStatusChange: (id: string, status: ProgramRunStatus) => void }) {
  const navigate = useNavigate()
  return (
    <section aria-label="Проведения программ" className="space-y-2 lg:hidden" data-testid="mobile-program-runs">
      {items.map((item) => (
        <ActionableCard key={item.id} onOpen={() => navigate(`/programs/runs/${item.id}`)} openLabel={`Открыть проведение ${item.name}`}>
          <ProgramIdentity className="[&_p]:line-clamp-2 [&_p]:whitespace-normal" icon={item.categoryIcon} secondary={`#${item.id}`} title={item.name} tone={item.categoryTone} />
          <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3 border-t pt-2"><Capacity value={item.registrationCount} limit={item.registrationLimit} label="Регистраций" /><div className="text-right"><p className="text-[10px] text-muted-foreground">Начало</p><p className="tabular-nums">{formatProgramTime(item.startsAt)}</p></div></div>
          <AssigneeStatusRow assignLabel={`Назначить ответственного проведению ${item.name}`} className="mt-2 border-t pt-2" onAssign={() => onAssign(item.id)} people={item.assignees}><ProgramStatusSelect kind="run" label={`Статус проведения #${item.id}`} onChange={(status) => onStatusChange(item.id, status)} value={item.status} /></AssigneeStatusRow>
        </ActionableCard>
      ))}
    </section>
  )
}

export function ProgramRegistrationsView({ items, onAssign, onStatusChange, ...sort }: { items: ProgramRegistration[]; onAssign: (id: string) => void; onStatusChange: (id: string, status: ProgramRegistrationStatus) => void } & SortProps<ProgramRegistrationSortKey>) {
  return <><ProgramRegistrationCards items={items} onAssign={onAssign} onStatusChange={onStatusChange} /><ProgramRegistrationTable items={items} onAssign={onAssign} onStatusChange={onStatusChange} {...sort} /></>
}

function ProgramRegistrationTable({ items, onAssign, onSort, onStatusChange, sortDirection, sortKey }: { items: ProgramRegistration[]; onAssign: (id: string) => void; onStatusChange: (id: string, status: ProgramRegistrationStatus) => void } & SortProps<ProgramRegistrationSortKey>) {
  const navigate = useNavigate()
  const header = (key: ProgramRegistrationSortKey, label: string, className?: string) => <SortableHeader active={sortKey === key} className={className} direction={sortDirection} onSort={() => onSort(key)}>{label}</SortableHeader>
  return (
    <DataTableShell className="hidden lg:block" data-testid="desktop-program-registrations" tableClassName="min-w-[1080px] table-fixed">
      <thead className="border-b bg-muted/45"><tr>{header("program", "Программа", "w-[245px]")}{header("client", "Клиент", "w-[195px]")}{header("price", "Стоимость", "w-[125px]")}{header("status", "Ответственный / статус", "w-[205px]")}{header("comment", "Комментарий", "w-[210px]")}<th className="w-12"><span className="sr-only">Действия</span></th></tr></thead>
      <tbody className="divide-y">{items.map((item) => (
        <tr className="cursor-pointer outline-none hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" key={item.id} onClick={() => navigate(`/programs/registrations/${item.id}`)} onKeyDown={(event) => event.key === "Enter" && navigate(`/programs/registrations/${item.id}`)} tabIndex={0}>
          <MainSecondaryCell><ProgramIdentity icon={item.categoryIcon} secondary={formatProgramDateTime(item.programStartsAt)} title={item.programName} tone={item.categoryTone} /></MainSecondaryCell>
          <MainSecondaryCell main={<span className="inline-flex max-w-full items-center gap-1.5"><IconUser aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{item.clientName}</span></span>} secondary={<a href={`tel:${item.phone.replace(/[^+\d]/g, "")}`} onClick={(event) => event.stopPropagation()}>{item.phone}</a>} />
          <MainSecondaryCell main={money.format(item.total)} secondary={item.debt > 0 ? `Долг ${money.format(item.debt)}` : "Оплачено"} />
          <MainSecondaryCell onClick={(event) => event.stopPropagation()}><AssigneeStatusRow assignLabel={`Назначить ответственного регистрации #${item.id}`} onAssign={() => onAssign(item.id)} people={item.assignees}><ProgramStatusSelect kind="registration" label={`Статус регистрации #${item.id}`} onChange={(status) => onStatusChange(item.id, status)} value={item.status} /></AssigneeStatusRow></MainSecondaryCell>
          <MainSecondaryCell><span className="block truncate" title={item.comment}>{item.comment}</span></MainSecondaryCell>
          <RowActions onClick={(event) => event.stopPropagation()}><ItemActions editLabel="Открыть регистрацию" onOpen={() => navigate(`/programs/registrations/${item.id}`)} /></RowActions>
        </tr>
      ))}</tbody>
    </DataTableShell>
  )
}

function ProgramRegistrationCards({ items, onAssign, onStatusChange }: { items: ProgramRegistration[]; onAssign: (id: string) => void; onStatusChange: (id: string, status: ProgramRegistrationStatus) => void }) {
  const navigate = useNavigate()
  return (
    <section aria-label="Регистрации на программы" className="space-y-2 lg:hidden" data-testid="mobile-program-registrations">
      {items.map((item) => (
        <ActionableCard key={item.id} onOpen={() => navigate(`/programs/registrations/${item.id}`)} openLabel={`Открыть регистрацию ${item.clientName}`}>
          <ProgramIdentity className="[&_p]:line-clamp-2 [&_p]:whitespace-normal" icon={item.categoryIcon} secondary={formatProgramDateTime(item.programStartsAt)} title={item.programName} tone={item.categoryTone} />
          <div className="mt-3 flex items-center justify-between gap-3 border-t pt-2"><div className="min-w-0"><p className="truncate"><IconUser aria-hidden="true" className="mr-1 inline size-3.5 text-muted-foreground" />{item.clientName}</p><a className="pointer-events-auto mt-0.5 inline-flex text-[10px] text-muted-foreground" href={`tel:${item.phone.replace(/[^+\d]/g, "")}`}><IconPhone aria-hidden="true" className="mr-1 size-3" />{item.phone}</a></div><div className="shrink-0 text-right"><p>{money.format(item.total)}</p><p className="text-[10px] text-muted-foreground">{item.debt ? `Долг ${money.format(item.debt)}` : "Оплачено"}</p></div></div>
          <AssigneeStatusRow assignLabel={`Назначить ответственного регистрации #${item.id}`} className="mt-2 border-t pt-2" onAssign={() => onAssign(item.id)} people={item.assignees}><ProgramStatusSelect kind="registration" label={`Статус регистрации #${item.id}`} onChange={(status) => onStatusChange(item.id, status)} value={item.status} /></AssigneeStatusRow>
        </ActionableCard>
      ))}
    </section>
  )
}

export function ProgramsLoading() {
  return <div aria-label="Загрузка программ" role="status"><div className="hidden overflow-hidden rounded-xl border bg-surface-raised lg:block"><div className="h-9 border-b bg-muted/45" />{Array.from({ length: 5 }, (_, index) => <div className="grid grid-cols-7 gap-3 border-b px-3 py-3 last:border-0" key={index}>{Array.from({ length: 7 }, (_, cell) => <Skeleton className={cell === 0 ? "h-8" : "h-5"} key={cell} />)}</div>)}</div><div className="space-y-2 lg:hidden">{Array.from({ length: 4 }, (_, index) => <div className="space-y-3 rounded-xl border bg-surface-raised p-3" key={index}><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-32" /><Skeleton className="h-7 w-full" /></div>)}</div></div>
}

function Capacity({ label, limit, value }: { label: string; limit: number; value: number }) {
  return <div className="min-w-20"><div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground"><span>{label}</span><span className="tabular-nums text-foreground">{value}/{limit}</span></div><Progress aria-label={`${label}: ${value} из ${limit}`} value={limit > 0 ? value / limit * 100 : 0} /></div>
}

function Metric({ children, className, label }: { children: React.ReactNode; className?: string; label: string }) {
  return <div className={className}><p className="text-[9px] text-muted-foreground">{label}</p><div className="mt-1 flex items-center gap-1 whitespace-nowrap tabular-nums">{children}</div></div>
}

function AssigneeStatusRow({ assignLabel, children, className, onAssign, people }: { assignLabel: string; children: React.ReactNode; className?: string; onAssign: () => void; people: ProgramRun["assignees"] }) {
  return (
    <div className={cn("pointer-events-auto relative z-10 flex min-w-0 items-center justify-between gap-2", className)} onClick={(event) => event.stopPropagation()}>
      <Assignees assignLabel={assignLabel} emptyVariant="icon" onAssign={onAssign} people={people} size="compact" />
      <div className="min-w-0 shrink">{children}</div>
    </div>
  )
}

function ItemActions({ editLabel, mobile = false, onOpen }: { editLabel: string; mobile?: boolean; onOpen: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<IconButton className={mobile ? "size-10" : undefined} label={editLabel} size={mobile ? "icon-lg" : "icon-xs"} variant="ghost"><IconDotsVertical aria-hidden="true" /></IconButton>} />
      <DropdownMenuContent align="end"><DropdownMenuItem onClick={onOpen}><IconEdit aria-hidden="true" />Редактировать</DropdownMenuItem></DropdownMenuContent>
    </DropdownMenu>
  )
}
