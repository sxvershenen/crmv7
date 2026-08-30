import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core"
import { IconAlertTriangle, IconCalendarEvent, IconClockExclamation, IconDotsVertical, IconFilter, IconLayoutKanban, IconPhone, IconTable, IconUser, IconUsers } from "@tabler/icons-react"
import { useNavigate, useSearchParams } from "react-router-dom"

import {
  Assignees, Badge, Button, ClickableCard, DataTableShell, DropdownMenu, DropdownMenuContent, DropdownMenuItem, EntityCardAssignees, EntityCardDetails, EntityCardInfoRow, EntityCardLayout, EntityCardRail,
  DropdownMenuTrigger, FilterSelect, KanbanBoard, KanbanColumn, KanbanDropPlaceholder, MainSecondaryCell, PageFrame, PageNav, PageState,
  RowActions, SettingsBar, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
  Skeleton, SortableHeader, Tooltip, TooltipContent, TooltipTrigger, ViewTabs, cn, type Assignee,
} from "@crm/ui"
import type { Lead, LeadQuery, LeadSortKey, LeadStage, SortDirection } from "@app/entities/leads"
import { leadBoardStages, leadScopeLabels, leadStageMeta, leadStages } from "@app/entities/leads"
import { useLeads } from "@app/features/use-leads"
import { leadRepository, type LeadRepository } from "@app/data/leads-repository"

const directionOptions = ["Проживание", "Баня", "Программы", "Мероприятия"]
const sourceOptions = ["Сайт", "Telegram", "VK", "Телефон"]
const promoOptions = ["Без промокода", "Лето", "Семья"]
const utmOptions = ["organic", "direct", "telegram", "vk_cpc", "yandex_cpc"]
const scopeFilterOptions = Object.entries(leadScopeLabels).map(([value, label]) => ({ value, label }))
const filterOptions = (allLabel: string, values: string[]) => [{ value: "all", label: allLabel }, ...values.map((value) => ({ value, label: value }))]
const stageNavItems = [{ value: "all", label: "Все" }, ...leadStages.map((value) => ({ value, label: leadStageMeta[value].label }))]
const viewItems = [{ value: "cards", label: "Карточки", icon: IconLayoutKanban }, { value: "table", label: "Таблица", icon: IconTable }]
const stageDotClass: Record<LeadStage, string> = {
  archive: "bg-zinc-400",
  new: "bg-sky-400",
  rejected: "bg-rose-400",
  success: "bg-emerald-400",
  waiting: "bg-amber-400",
  work: "bg-slate-400",
}
const currentAssignee: Assignee = { id: "demo-manager", initials: "МК", name: "Марина Кириллова", colorClass: "bg-sky-100 text-sky-700" }

function oneOf<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return value && options.includes(value as T) ? value as T : fallback
}

export function LeadsPage({ repository = leadRepository }: { repository?: LeadRepository }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const scope = oneOf(searchParams.get("scope"), ["all", "mine", "overdue"] as const, "all")
  const view = oneOf(searchParams.get("view"), ["cards", "table"] as const, "cards")
  const stage = oneOf(searchParams.get("stage"), ["all", ...leadStages] as const, "all")
  const direction = searchParams.get("direction") ?? "all"
  const source = searchParams.get("source") ?? "all"
  const promo = searchParams.get("promo") ?? "all"
  const utm = searchParams.get("utm") ?? "all"
  const sortKey = oneOf(searchParams.get("sort"), ["id", "client", "direction", "planned", "nextContact", "assignee"] as const, "id")
  const sortDirection = oneOf(searchParams.get("order"), ["asc", "desc"] as const, "desc")
  const query = useMemo<LeadQuery>(() => ({ scope, stage, direction, source, promo, utm, sort: { key: sortKey, direction: sortDirection } }), [direction, promo, scope, sortDirection, sortKey, source, stage, utm])
  const { moveLead, retry, state } = useLeads(query, repository)
  const [announcement, setAnnouncement] = useState("")
  const [moveError, setMoveError] = useState("")
  const [assignedLeads, setAssignedLeads] = useState<Record<string, Assignee[]>>({})
  const visibleLeads = useMemo(() => state.status === "ready" ? state.data.map((lead) => ({
    ...lead,
    assignees: assignedLeads[lead.id] ?? lead.assignees,
  })) : [], [assignedLeads, state])

  const updateParam = (name: string, value: string, defaultValue = "all") => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    if (value === defaultValue) next.delete(name)
    else next.set(name, value)
    return next
  })
  const resetFilters = () => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    for (const key of ["scope", "stage", "direction", "source", "promo", "utm"]) next.delete(key)
    return next
  })
  const handleMove = async (leadId: string, nextStage: LeadStage) => {
    const lead = state.status === "ready" ? state.data.find((item) => item.id === leadId) : undefined
    if (!lead || lead.stage === nextStage) return
    setMoveError("")
    setAnnouncement(`Заявка ${lead.id} переносится в «${leadStageMeta[nextStage].label}»`)
    try {
      await moveLead(leadId, nextStage)
      setAnnouncement(`Заявка ${lead.id} перенесена в «${leadStageMeta[nextStage].label}».`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Перенос не выполнен"
      setMoveError(message)
      setAnnouncement(message)
    }
  }
  const handleSort = (key: LeadSortKey) => {
    const nextDirection: SortDirection = sortKey === key && sortDirection === "asc" ? "desc" : "asc"
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set("view", "table")
      next.set("sort", key)
      next.set("order", nextDirection)
      return next
    })
  }
  const secondaryFilterCount = [direction, source, promo, utm].filter((value) => value !== "all").length
  const activeFilterCount = secondaryFilterCount + (scope === "all" ? 0 : 1) + (stage === "all" ? 0 : 1)
  const openLead = (leadId: string) => navigate(`/leads/${leadId}`)
  const assignLead = (leadId: string) => {
    setAssignedLeads((current) => ({ ...current, [leadId]: [currentAssignee] }))
    setAnnouncement(`${currentAssignee.name} назначена заявке #${leadId}.`)
  }

  return (
    <PageFrame className="space-y-3" width="full">
      <PageNav ariaLabel="Этапы заявок" items={stageNavItems} onValueChange={(value) => updateParam("stage", value)} value={stage} />
      <SettingsBar
        actions={<ViewTabs ariaLabel="Вид заявок" items={viewItems} onValueChange={(value) => updateParam("view", value, "cards")} value={view} />}
        filters={<>
          <FilterSelect label="Направление" onValueChange={(value) => updateParam("direction", value)} options={filterOptions("Все направления", directionOptions)} value={direction} />
          <FilterSelect label="Источник" onValueChange={(value) => updateParam("source", value)} options={filterOptions("Все источники", sourceOptions)} value={source} />
          <FilterSelect label="Промокод" onValueChange={(value) => updateParam("promo", value)} options={filterOptions("Все промокоды", promoOptions)} value={promo} />
          <FilterSelect label="UTM" onValueChange={(value) => updateParam("utm", value)} options={filterOptions("Все UTM", utmOptions)} value={utm} />
          {activeFilterCount > 0 ? <Button onClick={resetFilters} size="xs" variant="ghost">Сбросить · {activeFilterCount}</Button> : null}
        </>}
        mobileActions={<MobileFilters activeCount={secondaryFilterCount} direction={direction} onChange={updateParam} promo={promo} resetFilters={resetFilters} source={source} utm={utm} />}
        primary={<FilterSelect className="min-w-28" label="Область заявок" onValueChange={(value) => updateParam("scope", value)} options={scopeFilterOptions} value={scope} />}
      />
      {moveError ? <div className="flex items-start gap-2 rounded-lg border bg-surface-raised px-3 py-2 text-xs" role="alert"><IconAlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1">{moveError}</span><Button onClick={() => setMoveError("")} size="xs" variant="ghost">Скрыть</Button></div> : null}
      {state.status === "loading" ? <LeadsLoading /> : null}
      {state.status === "error" ? <div className="rounded-xl border bg-surface-raised"><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={retry} title="Заявки не загрузились" tone="danger">{state.message}</PageState></div> : null}
      {state.status === "ready" && state.data.length === 0 ? <div className="rounded-xl border bg-surface-raised"><PageState actionLabel="Сбросить фильтры" icon={IconFilter} onAction={resetFilters} title="Заявок нет">Попробуйте изменить область или фильтры.</PageState></div> : null}
      {state.status === "ready" && state.data.length > 0 ? <>
        <div className="md:hidden" data-testid="mobile-leads-list"><MobileLeadList leads={visibleLeads} onAssign={assignLead} onMove={handleMove} onOpen={openLead} /></div>
        <div className="hidden md:block" data-testid="desktop-leads-view">{view === "cards" ? <LeadBoard announcement={announcement} leads={visibleLeads} onAnnouncement={setAnnouncement} onAssign={assignLead} onMove={handleMove} onOpen={openLead} selectedStage={stage} /> : <LeadTable leads={visibleLeads} onMove={handleMove} onOpen={openLead} onSort={handleSort} sortDirection={sortDirection} sortKey={sortKey} />}</div>
      </> : null}
      <p aria-live="assertive" className="sr-only">{announcement}</p>
    </PageFrame>
  )
}

function MobileFilters({ activeCount, direction, onChange, promo, resetFilters, source, utm }: { activeCount: number; direction: string; onChange: (name: string, value: string, defaultValue?: string) => void; promo: string; resetFilters: () => void; source: string; utm: string }) {
  return <Sheet>
    <SheetTrigger render={<Button aria-label="Фильтры заявок" className="text-xs font-normal" size="sm" variant="outline" />}><IconFilter aria-hidden="true" />{activeCount > 0 ? <Badge className="min-w-5 justify-center" variant="secondary">{activeCount}</Badge> : null}</SheetTrigger>
    <SheetContent className="w-full" side="bottom"><SheetHeader><SheetTitle>Фильтры заявок</SheetTitle><SheetDescription>Уточните список по рабочим и маркетинговым признакам.</SheetDescription></SheetHeader>
      <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
        <FilterSelect className="max-w-none" label="Направление" onValueChange={(value) => onChange("direction", value)} options={filterOptions("Все направления", directionOptions)} value={direction} />
        <FilterSelect className="max-w-none" label="Источник" onValueChange={(value) => onChange("source", value)} options={filterOptions("Все источники", sourceOptions)} value={source} />
        <FilterSelect className="max-w-none" label="Промокод" onValueChange={(value) => onChange("promo", value)} options={filterOptions("Все промокоды", promoOptions)} value={promo} />
        <FilterSelect className="max-w-none" label="UTM" onValueChange={(value) => onChange("utm", value)} options={filterOptions("Все UTM", utmOptions)} value={utm} />
        {activeCount > 0 ? <Button className="sm:col-span-2" onClick={resetFilters} size="sm" variant="outline">Сбросить фильтры</Button> : null}
      </div>
    </SheetContent>
  </Sheet>
}

function LeadBoard({ announcement, leads, onAnnouncement, onAssign, onMove, onOpen, selectedStage }: { announcement: string; leads: Lead[]; onAnnouncement: (message: string) => void; onAssign: (id: string) => void; onMove: (id: string, stage: LeadStage) => Promise<void>; onOpen: (id: string) => void; selectedStage: LeadStage | "all" }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor))
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null)
  const columns = selectedStage === "all" ? leadBoardStages : [selectedStage]
  const activeLead = activeLeadId ? leads.find((lead) => lead.id === activeLeadId) : undefined
  const onDragStart = ({ active }: DragStartEvent) => {
    const lead = leads.find((item) => item.id === active.id)
    if (lead) {
      setActiveLeadId(lead.id)
      onAnnouncement(`Перемещается заявка ${lead.id}. Выберите колонку или используйте меню действий.`)
    }
  }
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveLeadId(null)
    const nextStage = over?.data.current?.stage as LeadStage | undefined
    if (nextStage) void onMove(String(active.id), nextStage)
    else onAnnouncement(announcement ? `${announcement} Перенос отменён.` : "Перенос отменён.")
  }
  const cancelDrag = () => {
    setActiveLeadId(null)
    onAnnouncement("Перенос отменён.")
  }
  return <DndContext onDragCancel={cancelDrag} onDragEnd={onDragEnd} onDragStart={onDragStart} sensors={sensors}>
    <KanbanBoard columnCount={columns.length}>
      {columns.map((item) => <LeadColumn activeLeadId={activeLeadId} allLeadOrder={leads.map((lead) => lead.id)} key={item} leads={leads.filter((lead) => lead.stage === item)} onAssign={onAssign} onMove={onMove} onOpen={onOpen} stage={item} />)}
    </KanbanBoard>
    <DragOverlay dropAnimation={null} style={{ zIndex: 1000 }}>
      {activeLead ? <div className="w-full rounded-xl border bg-card p-3 shadow-xl" data-testid="lead-drag-overlay"><LeadCardContent lead={activeLead} /></div> : null}
    </DragOverlay>
  </DndContext>
}

function LeadColumn({ activeLeadId, allLeadOrder, leads, onAssign, onMove, onOpen, stage }: { activeLeadId: string | null; allLeadOrder: string[]; leads: Lead[]; onAssign: (id: string) => void; onMove: (id: string, stage: LeadStage) => Promise<void>; onOpen: (id: string) => void; stage: LeadStage }) {
  const { isOver, setNodeRef } = useDroppable({ id: `stage:${stage}`, data: { stage } })
  const overdueCount = leads.filter((lead) => lead.overdue).length
  const meta = leadStageMeta[stage]
  const activeColumnIndex = activeLeadId ? leads.findIndex((lead) => lead.id === activeLeadId) : -1
  const activeGlobalIndex = activeLeadId ? allLeadOrder.indexOf(activeLeadId) : -1
  const nextLeadIndex = activeGlobalIndex >= 0
    ? leads.findIndex((lead) => allLeadOrder.indexOf(lead.id) > activeGlobalIndex)
    : -1
  const dropIndex = activeColumnIndex >= 0 ? activeColumnIndex : nextLeadIndex >= 0 ? nextLeadIndex : leads.length
  const placeholder = isOver && activeLeadId
    ? <KanbanDropPlaceholder label="Место для переноса заявки" testId={`lead-drop-placeholder:${stage}`} />
    : null
  return <KanbanColumn {...(overdueCount > 0 ? { attention: `${overdueCount} проср.` } : {})} count={leads.length} empty={leads.length === 0 && !isOver} emptyLabel="Перетащите заявку сюда" isOver={isOver} label={meta.label} markerClassName={stageDotClass[stage]} setNodeRef={setNodeRef}>
      {leads.length ? leads.map((lead, index) => <Fragment key={lead.id}>{index === dropIndex ? placeholder : null}<DraggableLeadCard lead={lead} onAssign={onAssign} onMove={onMove} onOpen={onOpen} /></Fragment>) : !isOver ? <p className="px-2 py-8 text-center text-[11px] text-muted-foreground">Перетащите заявку сюда</p> : null}
      {dropIndex === leads.length ? placeholder : null}
  </KanbanColumn>
}

function DraggableLeadCard({ lead, onAssign, onMove, onOpen }: { lead: Lead; onAssign: (id: string) => void; onMove: (id: string, stage: LeadStage) => Promise<void>; onOpen: (id: string) => void }) {
  const dragged = useRef(false)
  const wasDragging = useRef(false)
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef } = useDraggable({ id: lead.id, data: { stage: lead.stage } })
  useEffect(() => {
    if (isDragging) {
      dragged.current = true
      wasDragging.current = true
      return
    }
    if (!wasDragging.current) return
    wasDragging.current = false
    const timeout = window.setTimeout(() => { dragged.current = false }, 0)
    return () => window.clearTimeout(timeout)
  }, [isDragging])
  const handleOpen = () => {
    if (dragged.current) { dragged.current = false; return }
    onOpen(lead.id)
  }
  return <div className={cn("relative z-0", isDragging && "opacity-30")} ref={setNodeRef}>
    <ClickableCard {...attributes} {...listeners} aria-label={`Открыть заявку ${lead.id}: ${lead.clientName}`} className="absolute inset-0 h-full min-h-0 touch-none cursor-grab p-0 active:cursor-grabbing" onClick={handleOpen} ref={setActivatorNodeRef} />
    <div className="pointer-events-none relative p-3"><LeadCardContent lead={lead} rail={<LeadCardRail lead={lead} onAssign={() => onAssign(lead.id)} action={<MoveMenu currentStage={lead.stage} leadId={lead.id} onMove={onMove} />} />} /></div>
  </div>
}

function MobileLeadCard({ lead, onAssign, onMove, onOpen }: { lead: Lead; onAssign: (id: string) => void; onMove: (id: string, stage: LeadStage) => Promise<void>; onOpen: (id: string) => void }) {
  return <div className="relative"><ClickableCard aria-label={`Открыть заявку ${lead.id}: ${lead.clientName}`} className="absolute inset-0 h-full min-h-0 p-0" onClick={() => onOpen(lead.id)} /><div className="pointer-events-none relative p-3"><LeadCardContent lead={lead} mobile rail={<LeadCardRail lead={lead} onAssign={() => onAssign(lead.id)} action={<MoveMenu currentStage={lead.stage} leadId={lead.id} onMove={onMove} />} />} /></div></div>
}

function LeadCardContent({ lead, mobile = false, rail }: { lead: Lead; mobile?: boolean; rail?: ReactNode }) {
  return <EntityCardLayout dataSlot="lead-card-layout" rail={rail}><div className="min-w-0"><p className="truncate leading-4" title={lead.clientName}>{lead.clientName}</p><div className="mt-0.5 flex items-center gap-2 text-[11px] leading-4 text-muted-foreground"><span className="tabular-nums">#{lead.id}</span>{mobile ? <Badge className="font-normal" variant="secondary">{leadStageMeta[lead.stage].label}</Badge> : null}</div></div>
    <EntityCardDetails>
      <EntityCardInfoRow icon={IconPhone}><span className="truncate">{lead.phone}</span></EntityCardInfoRow>
      <EntityCardInfoRow icon={IconUsers}><span className="inline-flex min-w-0 items-center gap-1"><span className="line-clamp-2">{lead.requestedItem}</span><span aria-hidden="true" className="shrink-0 text-muted-foreground">·</span><span aria-label={`${lead.guestCount} человек`} className="inline-flex shrink-0 items-center gap-1 text-muted-foreground"><IconUser aria-hidden="true" className="size-3.5" /><span className="tabular-nums">{lead.guestCount}</span></span></span></EntityCardInfoRow>
      <EntityCardInfoRow icon={IconCalendarEvent}><span className="truncate tabular-nums">{lead.plannedLabel}</span></EntityCardInfoRow>
    </EntityCardDetails>
  </EntityCardLayout>
}

function LeadCardRail({ action, lead, onAssign }: { action: ReactNode; lead: Lead; onAssign: () => void }) {
  return <EntityCardRail dataSlot="lead-card-rail">
    <div className="pointer-events-auto">{action}</div>
    <EntityCardAssignees assignLabel={`Назначить ответственного заявке ${lead.id}`} dataSlot="lead-card-assignees" onAssign={onAssign} people={lead.assignees} />
    {lead.overdue ? <Tooltip><TooltipTrigger render={<span aria-label="Просрочен следующий контакт" className="pointer-events-auto inline-flex size-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-amber-950 dark:text-amber-300" role="img" tabIndex={0} />}><IconClockExclamation aria-hidden="true" className="size-3.5" /></TooltipTrigger><TooltipContent side="left">Просрочен следующий контакт</TooltipContent></Tooltip> : null}
  </EntityCardRail>
}

function MoveMenu({ currentStage, leadId, onMove }: { currentStage: LeadStage; leadId: string; onMove: (id: string, stage: LeadStage) => Promise<void> }) {
  return <DropdownMenu><DropdownMenuTrigger render={<Button aria-label={`Действия заявки ${leadId}`} size="icon-sm" variant="ghost" />}><IconDotsVertical aria-hidden="true" className="size-[18px]" /></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-40"><div className="px-2 py-1 text-[11px] text-muted-foreground">Статус</div>{leadStages.filter((stage) => stage !== currentStage).map((stage) => <DropdownMenuItem key={stage} onClick={() => void onMove(leadId, stage)}>{leadStageMeta[stage].label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
}

function MobileLeadList({ leads, onAssign, onMove, onOpen }: { leads: Lead[]; onAssign: (id: string) => void; onMove: (id: string, stage: LeadStage) => Promise<void>; onOpen: (id: string) => void }) {
  return <section aria-label="Список заявок" className="space-y-2">{leads.map((lead) => <MobileLeadCard key={lead.id} lead={lead} onAssign={onAssign} onMove={onMove} onOpen={onOpen} />)}</section>
}

function LeadTable({ leads, onMove, onOpen, onSort, sortDirection, sortKey }: { leads: Lead[]; onMove: (id: string, stage: LeadStage) => Promise<void>; onOpen: (id: string) => void; onSort: (key: LeadSortKey) => void; sortDirection: SortDirection; sortKey: LeadSortKey }) {
  return <DataTableShell tableClassName="min-w-[980px]">
    <thead className="border-b bg-muted/45"><tr>
      <SortableHeader active={sortKey === "id"} direction={sortDirection} onSort={() => onSort("id")}>#ID</SortableHeader><SortableHeader active={sortKey === "client"} direction={sortDirection} onSort={() => onSort("client")}>Клиент</SortableHeader><SortableHeader active={sortKey === "direction"} direction={sortDirection} onSort={() => onSort("direction")}>Направление</SortableHeader><SortableHeader active={sortKey === "planned"} direction={sortDirection} onSort={() => onSort("planned")}>Планируется</SortableHeader><SortableHeader active={sortKey === "nextContact"} direction={sortDirection} onSort={() => onSort("nextContact")}>След. контакт</SortableHeader><SortableHeader active={sortKey === "assignee"} direction={sortDirection} onSort={() => onSort("assignee")}>Ответственный</SortableHeader><th className="w-12 px-2 py-2"><span className="sr-only">Действия</span></th>
    </tr></thead>
    <tbody className="divide-y">{leads.map((lead) => <tr className="hover:bg-muted/35" key={lead.id}>
      <MainSecondaryCell><Button aria-label={`Открыть заявку ${lead.id}`} className="h-auto p-0 text-xs font-normal" onClick={() => onOpen(lead.id)} variant="link">#{lead.id}</Button></MainSecondaryCell>
      <MainSecondaryCell main={lead.clientName} secondary={lead.phone} />
      <MainSecondaryCell main={lead.requestedItem} secondary={<span aria-label={`${lead.direction}, ${lead.guestCount} человек`} className="inline-flex items-center gap-1">{lead.direction}<span aria-hidden="true">·</span><IconUser aria-hidden="true" className="size-3" /><span>{lead.guestCount}</span></span>} />
      <MainSecondaryCell className="whitespace-nowrap tabular-nums">{lead.plannedLabel}</MainSecondaryCell>
      <MainSecondaryCell className="whitespace-nowrap tabular-nums"><span className="inline-flex items-center gap-1.5">{lead.overdue ? <IconClockExclamation aria-label="Просрочено" className="size-3.5 text-muted-foreground" /> : null}{lead.nextContactLabel}</span></MainSecondaryCell>
      <MainSecondaryCell><Assignees people={lead.assignees} size="compact" /></MainSecondaryCell>
      <RowActions><MoveMenu currentStage={lead.stage} leadId={lead.id} onMove={onMove} /></RowActions>
    </tr>)}</tbody>
  </DataTableShell>
}

function LeadsLoading() {
  return <div aria-label="Загрузка заявок" className="grid gap-3 md:grid-cols-3 xl:grid-cols-5" role="status">{Array.from({ length: 5 }, (_, index) => <div className="space-y-2 rounded-xl border bg-surface-raised p-3" key={index}><Skeleton className="h-5 w-24" /><Skeleton className="h-28 w-full" /><Skeleton className="h-7 w-full" /></div>)}</div>
}
