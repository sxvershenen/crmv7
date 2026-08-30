import { Fragment, useEffect, useRef, useState } from "react"
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core"
import { IconAlertTriangle, IconArchive, IconCalendarEvent, IconCheck, IconClock, IconDotsVertical, IconExternalLink, IconLink, IconMessageCircle, IconProgressCheck, IconTargetArrow, IconUserQuestion, IconUsersGroup } from "@tabler/icons-react"
import { useNavigate } from "react-router-dom"

import {
  Assignees,
  Button,
  Checkbox,
  ClickableCard,
  DataTableShell,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  KanbanBoard,
  KanbanColumn,
  KanbanDropPlaceholder,
  ListRow,
  ListSection,
  MainSecondaryCell,
  RowActions,
  Skeleton,
  SortableHeader,
  StatusBadge,
  SummaryMetric,
  cn,
} from "@crm/ui"

import type { CrmTask, TaskSortDirection, TaskSortKey, TaskStatus } from "@app/entities/tasks"
import { isTaskOverdue, taskPriorityMeta, taskStatusMeta, taskStatuses } from "@app/entities/tasks"

type TaskActions = {
  onArchive: (id: string) => void
  onAssign: (id: string) => void
  onStatusChange: (id: string, status: TaskStatus) => void
}

export function TaskDashboard({ tasks, ...actions }: { tasks: CrmTask[] } & TaskActions) {
  const open = tasks.filter((task) => task.status !== "done")
  const overdue = tasks.filter(isTaskOverdue)
  const today = open.filter((task) => task.dueAt?.startsWith("2026-08-24"))
  const mine = open.filter((task) => task.assignees.some((person) => person.id === "marina"))
  const done = tasks.filter((task) => task.status === "done")
  const metrics = [
    { label: "Просрочено", value: overdue.length, icon: IconAlertTriangle, tone: "warning" as const, left: `Срочные · ${overdue.filter((task) => task.priority === "urgent").length}`, right: `Без исполнителя · ${overdue.filter((task) => task.assignees.length === 0).length}` },
    { label: "Сегодня", value: today.length, icon: IconCalendarEvent, tone: "info" as const, left: `В работе · ${today.filter((task) => task.status === "in_progress").length}`, right: `Проверка · ${today.filter((task) => task.status === "review").length}` },
    { label: "Мои открытые", value: mine.length, icon: IconProgressCheck, tone: "task" as const, left: `Сегодня · ${mine.filter((task) => task.dueAt?.startsWith("2026-08-24")).length}`, right: `Просрочено · ${mine.filter(isTaskOverdue).length}` },
    { label: "Выполнено", value: done.length, icon: IconCheck, tone: "success" as const, left: `С итогом · ${done.filter((task) => task.commentCount > 0).length}`, right: `Назначено · ${done.filter((task) => task.assignees.length > 0).length}` },
  ]
  const workload = ["Марина Кириллова", "Алексей Воронов", "Ольга Семёнова"].map((name) => ({ name, count: open.filter((task) => task.assignees.some((person) => person.name === name)).length }))
  const focus = open.slice(0, 5)

  return <div className="space-y-3" data-testid="task-dashboard">
    <section aria-label="Сводка задач" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {metrics.map((metric) => <SummaryMetric icon={metric.icon} key={metric.label} label={metric.label} tone={metric.tone} value={metric.value}><div className="flex items-center justify-between gap-2"><span>{metric.left}</span><span className="text-right">{metric.right}</span></div></SummaryMetric>)}
    </section>
    <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
      <div className="overflow-hidden rounded-xl border bg-surface-raised shadow-[0_1px_2px_rgb(0_0_0/0.02)]"><ListSection count={focus.length} icon={IconTargetArrow} title="Фокус очереди" tone="task">{focus.map((task) => <TaskCompactRow {...actions} key={task.id} task={task} />)}</ListSection></div>
      <div className="overflow-hidden rounded-xl border bg-surface-raised shadow-[0_1px_2px_rgb(0_0_0/0.02)]"><ListSection count={open.length} icon={IconUsersGroup} title="Нагрузка команды" tone="neutral">{workload.map((person) => <ListRow key={person.name}><div className="flex min-h-11 items-center justify-between gap-2 px-4 py-2 text-xs"><span>{person.name}</span><span className="tabular-nums text-muted-foreground">{person.count}</span></div></ListRow>)}<ListRow><div className="flex min-h-11 items-center justify-between gap-2 px-4 py-2 text-xs"><span className="inline-flex items-center gap-1.5 text-muted-foreground"><IconUserQuestion aria-hidden="true" className="size-4" />Без исполнителя</span><span className="tabular-nums">{open.filter((task) => task.assignees.length === 0).length}</span></div></ListRow></ListSection></div>
    </div>
  </div>
}

const taskStatusDotClass: Record<TaskStatus, string> = { todo: "bg-zinc-400", in_progress: "bg-sky-400", review: "bg-amber-400", done: "bg-emerald-400" }

export function TaskKanban({ announcement, onAnnouncement, tasks, ...actions }: { announcement: string; onAnnouncement: (message: string) => void; tasks: CrmTask[] } & TaskActions) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor))
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const activeTask = activeTaskId ? tasks.find((task) => task.id === activeTaskId) : undefined
  const onDragStart = ({ active }: DragStartEvent) => {
    const task = tasks.find((item) => item.id === active.id)
    if (!task) return
    setActiveTaskId(task.id)
    onAnnouncement(`Перемещается задача ${task.id}. Выберите колонку или используйте меню действий.`)
  }
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTaskId(null)
    const status = over?.data.current?.status as TaskStatus | undefined
    if (status) actions.onStatusChange(String(active.id), status)
    else onAnnouncement(announcement ? `${announcement} Перенос отменён.` : "Перенос отменён.")
  }
  const cancelDrag = () => { setActiveTaskId(null); onAnnouncement("Перенос отменён.") }
  return <>
    <div className="space-y-2 md:hidden" data-testid="mobile-task-cards">{tasks.map((task) => <TaskCard {...actions} key={task.id} task={task} />)}</div>
    <DndContext onDragCancel={cancelDrag} onDragEnd={onDragEnd} onDragStart={onDragStart} sensors={sensors}>
      <KanbanBoard className="hidden md:grid" columnCount={taskStatuses.length} data-testid="task-kanban">{taskStatuses.map((status) => <TaskColumn activeTaskId={activeTaskId} allTaskOrder={tasks.map((task) => task.id)} {...actions} key={status} status={status} tasks={tasks.filter((task) => task.status === status)} />)}</KanbanBoard>
      <DragOverlay dropAnimation={null} style={{ zIndex: 1000 }}>{activeTask ? <div className="w-[280px] rounded-xl border bg-card p-3 shadow-xl" data-testid="task-drag-overlay"><TaskDragPreview task={activeTask} /></div> : null}</DragOverlay>
    </DndContext>
  </>
}

export function TaskCards({ tasks, ...actions }: { tasks: CrmTask[] } & TaskActions) {
  return <section aria-label="Список задач" className="grid gap-2 md:grid-cols-2 xl:grid-cols-3" data-testid="task-card-list">{tasks.map((task) => <TaskCard {...actions} key={task.id} task={task} />)}</section>
}

function TaskColumn({ activeTaskId, allTaskOrder, status, tasks, ...actions }: { activeTaskId: string | null; allTaskOrder: string[]; status: TaskStatus; tasks: CrmTask[] } & TaskActions) {
  const { isOver, setNodeRef } = useDroppable({ id: `task-status:${status}`, data: { status } })
  const activeColumnIndex = activeTaskId ? tasks.findIndex((task) => task.id === activeTaskId) : -1
  const activeGlobalIndex = activeTaskId ? allTaskOrder.indexOf(activeTaskId) : -1
  const nextTaskIndex = activeGlobalIndex >= 0 ? tasks.findIndex((task) => allTaskOrder.indexOf(task.id) > activeGlobalIndex) : -1
  const dropIndex = activeColumnIndex >= 0 ? activeColumnIndex : nextTaskIndex >= 0 ? nextTaskIndex : tasks.length
  const overdueCount = tasks.filter(isTaskOverdue).length
  const placeholder = isOver && activeTaskId ? <KanbanDropPlaceholder className="h-28" label="Место для переноса задачи" testId={`task-drop-placeholder:${status}`} /> : null
  return <KanbanColumn {...(overdueCount > 0 ? { attention: `${overdueCount} проср.` } : {})} count={tasks.length} empty={tasks.length === 0 && !isOver} emptyLabel="Перетащите задачу сюда" isOver={isOver} label={taskStatusMeta[status].label} markerClassName={taskStatusDotClass[status]} setNodeRef={setNodeRef}>
    {tasks.map((task, index) => <Fragment key={task.id}>{index === dropIndex ? placeholder : null}<DraggableTaskCard {...actions} task={task} /></Fragment>)}
    {dropIndex === tasks.length ? placeholder : null}
  </KanbanColumn>
}

type TaskDragHandle = Pick<ReturnType<typeof useDraggable>, "attributes" | "listeners" | "setActivatorNodeRef">

function DraggableTaskCard({ task, ...actions }: { task: CrmTask } & TaskActions) {
  const dragged = useRef(false)
  const wasDragging = useRef(false)
  const drag = useDraggable({ id: task.id, data: { status: task.status } })
  useEffect(() => {
    if (drag.isDragging) { dragged.current = true; wasDragging.current = true; return }
    if (!wasDragging.current) return
    wasDragging.current = false
    const timeout = window.setTimeout(() => { dragged.current = false }, 0)
    return () => window.clearTimeout(timeout)
  }, [drag.isDragging])
  const navigate = useNavigate()
  const open = () => {
    if (dragged.current) { dragged.current = false; return }
    navigate(`/tasks/${task.id}`)
  }
  return <div className={cn("relative z-0", drag.isDragging && "opacity-30")} ref={drag.setNodeRef}><TaskCard {...actions} drag={drag} onOpen={open} task={task} /></div>
}

function TaskDragPreview({ task }: { task: CrmTask }) {
  return <div className="min-w-0 text-xs"><p className="line-clamp-2 leading-4">{task.title}</p><p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">{task.relation.label}</p><div className="mt-2"><Due task={task} /></div></div>
}

export function TaskTable({ tasks, onSort, sortDirection, sortKey, ...actions }: { tasks: CrmTask[]; onSort: (key: TaskSortKey) => void; sortDirection: TaskSortDirection; sortKey: TaskSortKey } & TaskActions) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState<string[]>([])
  const header = (key: TaskSortKey, label: string, className?: string) => <SortableHeader active={sortKey === key} className={className} direction={sortDirection} onSort={() => onSort(key)}>{label}</SortableHeader>
  const toggleComments = (id: string) => setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  return <>
    <div className="space-y-2 lg:hidden" data-testid="mobile-task-cards">{tasks.map((task) => <TaskCard {...actions} key={task.id} task={task} />)}</div>
    <DataTableShell className="hidden lg:block" data-testid="task-table" tableClassName="min-w-[1020px] table-fixed">
      <thead className="border-b bg-muted/45"><tr><th className="w-11 px-3 py-2"><span className="sr-only">Завершить</span></th>{header("title", "Название", "w-[270px]")}{header("due", "Дедлайн", "w-[135px]")}{header("relation", "Связь", "w-[205px]")}{header("priority", "Приоритет", "w-[105px]")}{header("assignee", "Исполнители", "w-[120px]")}<th className="w-12"><span className="sr-only">Комментарии</span></th><th className="w-12"><span className="sr-only">Действия</span></th></tr></thead>
      <tbody className="divide-y">{tasks.map((task) => <Fragment key={task.id}><tr className="cursor-pointer hover:bg-muted/35" onClick={() => navigate(`/tasks/${task.id}`)}>
        <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}><Checkbox aria-label={`Завершить задачу ${task.id}`} checked={task.status === "done"} onCheckedChange={(checked) => actions.onStatusChange(task.id, checked ? "done" : "todo")} /></td>
        <MainSecondaryCell main={task.title} secondary={`#${task.id}`} />
        <MainSecondaryCell><Due task={task} /></MainSecondaryCell>
        <MainSecondaryCell main={task.relation.label} secondary={task.relation.type === "internal" ? undefined : task.relation.href.split("/").at(-1)} />
        <MainSecondaryCell><StatusBadge tone={taskPriorityMeta[task.priority].tone}>{taskPriorityMeta[task.priority].label}</StatusBadge></MainSecondaryCell>
        <MainSecondaryCell onClick={(event) => event.stopPropagation()}><Assignees assignLabel={`Назначить исполнителя задаче ${task.id}`} emptyVariant="icon" onAssign={() => actions.onAssign(task.id)} people={task.assignees} size="compact" /></MainSecondaryCell>
        <td className="px-2 py-2" onClick={(event) => event.stopPropagation()}><Button aria-label={`Комментарии задачи ${task.id}`} onClick={() => toggleComments(task.id)} size="icon-xs" variant="ghost"><IconMessageCircle aria-hidden="true" /><span className="sr-only">{task.commentCount}</span></Button></td>
        <RowActions onClick={(event) => event.stopPropagation()}><TaskMenu {...actions} task={task} /></RowActions>
      </tr>{expanded.includes(task.id) ? <tr><td className="bg-muted/25 px-3 py-2.5 text-[11px] text-muted-foreground" colSpan={8}>{task.latestComment ?? "Комментариев пока нет"}</td></tr> : null}</Fragment>)}</tbody>
    </DataTableShell>
  </>
}

export function TasksLoading() {
  return <div aria-label="Загрузка задач" role="status"><div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton className="h-20 rounded-xl" key={index} />)}</div><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton className="h-40 rounded-xl" key={index} />)}</div></div>
}

function TaskCard({ drag, onOpen, task, ...actions }: { drag?: TaskDragHandle; onOpen?: () => void; task: CrmTask } & TaskActions) {
  const navigate = useNavigate()
  const [commentsOpen, setCommentsOpen] = useState(false)
  return <article className={cn("relative overflow-hidden rounded-xl border bg-card text-xs shadow-xs", task.status === "done" && "opacity-70")}>
    <ClickableCard {...drag?.attributes} {...drag?.listeners} aria-label={`Открыть задачу ${task.id}: ${task.title}`} className={cn("absolute inset-0 h-full min-h-0 p-0", drag && "touch-none cursor-grab active:cursor-grabbing")} onClick={onOpen ?? (() => navigate(`/tasks/${task.id}`))} ref={drag?.setActivatorNodeRef} />
    <div className="pointer-events-none relative p-3"><div className="pr-10"><div className="flex min-w-0 items-start gap-2"><span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-700"><IconTargetArrow aria-hidden="true" className="size-3.5" /></span><p className="line-clamp-2 leading-4" title={task.title}>{task.title}</p></div></div><div className="mt-2 space-y-1.5 text-[11px] text-muted-foreground"><p className="flex min-w-0 items-center gap-1.5"><IconLink aria-hidden="true" className="size-3.5 shrink-0" /><span className="line-clamp-2">{task.relation.label}</span></p><Due task={task} /></div><div className="mt-3 flex items-center justify-between gap-2 border-t pt-2"><div className="pointer-events-auto"><Assignees assignLabel={`Назначить исполнителя задаче ${task.id}`} emptyVariant="icon" onAssign={() => actions.onAssign(task.id)} people={task.assignees} size="compact" /></div><div className="pointer-events-auto flex items-center gap-1"><StatusBadge tone={taskPriorityMeta[task.priority].tone}>{taskPriorityMeta[task.priority].label}</StatusBadge><Button aria-label={`Комментарии задачи ${task.id}: ${task.commentCount}`} onClick={() => setCommentsOpen((current) => !current)} size="icon-xs" variant="ghost"><IconMessageCircle aria-hidden="true" /></Button></div></div>{commentsOpen ? <p className="mt-2 border-t pt-2 text-[11px] leading-4 text-muted-foreground">{task.latestComment ?? "Комментариев пока нет"}</p> : null}</div>
    <div className="absolute right-2 top-2 z-10"><TaskMenu {...actions} task={task} /></div>
  </article>
}

function TaskCompactRow({ task, ...actions }: { task: CrmTask } & TaskActions) {
  const navigate = useNavigate()
  return <ListRow className="group relative min-h-14 transition-colors hover:bg-muted/55 focus-within:bg-muted/55"><ClickableCard aria-label={`Открыть задачу ${task.id}`} className="absolute inset-0 z-0 h-full min-h-0 rounded-none border-0 bg-transparent p-0 shadow-none" onClick={() => navigate(`/tasks/${task.id}`)} /><div className="pointer-events-none relative z-[1] grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-2.5"><div className="min-w-0"><p className="truncate text-xs">{task.title}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{task.relation.label}</p></div><Due task={task} /><div className="pointer-events-auto"><Assignees assignLabel={`Назначить исполнителя задаче ${task.id}`} emptyVariant="icon" onAssign={() => actions.onAssign(task.id)} people={task.assignees} size="compact" /></div></div></ListRow>
}

function Due({ task }: { task: CrmTask }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground", isTaskOverdue(task) && "text-amber-700")}><IconClock aria-hidden="true" className="size-3.5 shrink-0" />{task.dueLabel}{task.blocked ? <IconAlertTriangle aria-label="Задача заблокирована" className="size-3.5" /> : null}</span>
}

function TaskMenu({ onArchive, onStatusChange, task }: { task: CrmTask } & Pick<TaskActions, "onArchive" | "onStatusChange">) {
  const navigate = useNavigate()
  return <DropdownMenu><DropdownMenuTrigger render={<Button aria-label={`Действия задачи ${task.id}`} size="icon-sm" variant="ghost" />}><IconDotsVertical aria-hidden="true" className="size-[18px]" /></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-44"><div className="px-2 py-1 text-[11px] text-muted-foreground">Статус</div>{taskStatuses.filter((status) => status !== task.status).map((status) => <DropdownMenuItem key={status} onClick={() => onStatusChange(task.id, status)}>{taskStatusMeta[status].label}</DropdownMenuItem>)}<DropdownMenuItem onClick={() => navigate(`/tasks/${task.id}`)}><IconExternalLink aria-hidden="true" />Открыть</DropdownMenuItem>{!task.archived ? <DropdownMenuItem onClick={() => onArchive(task.id)}><IconArchive aria-hidden="true" />В архив</DropdownMenuItem> : null}</DropdownMenuContent></DropdownMenu>
}
