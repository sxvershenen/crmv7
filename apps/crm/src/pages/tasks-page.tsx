import { useMemo, useState } from "react"
import { IconAlertTriangle, IconFilter } from "@tabler/icons-react"
import { useSearchParams } from "react-router-dom"

import { PageFrame, PageNav, PageState } from "@crm/ui"

import { TaskControls } from "@app/components/tasks/task-controls"
import { TaskCards, TaskDashboard, TaskKanban, TaskTable, TasksLoading } from "@app/components/tasks/task-views"
import { taskRepository, type TaskRepository } from "@app/data/tasks-repository"
import type { CrmTask, TaskOrder, TaskPriority, TaskQuery, TaskRelationType, TaskSortKey, TaskStatus, TaskView } from "@app/entities/tasks"
import { taskOrders, taskPriorities, taskRelationTypes, taskSortKeys, taskViewLabels, taskViews } from "@app/entities/tasks"
import { useTasks } from "@app/features/use-tasks"

function oneOf<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return value && options.includes(value as T) ? value as T : fallback
}

const navItems = taskViews.map((value) => ({ value, label: taskViewLabels[value], ...(value === "dashboard" ? { compactLabel: "Сводка" } : {}) }))

export function TasksPage({ repository = taskRepository }: { repository?: TaskRepository }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const view = oneOf(searchParams.get("view"), taskViews, "dashboard")
  const assignee = oneOf(searchParams.get("assignee"), ["all", "mine", "unassigned"] as const, "all")
  const priority = oneOf(searchParams.get("priority"), ["all", ...taskPriorities] as const, "all")
  const relation = oneOf(searchParams.get("relation"), ["all", ...taskRelationTypes] as const, "all")
  const order = oneOf(searchParams.get("orderBy"), taskOrders, "dueAsc")
  const sortKey = oneOf(searchParams.get("sort"), taskSortKeys, "due")
  const sortDirection = oneOf(searchParams.get("order"), ["asc", "desc"] as const, "asc")
  const query = useMemo<TaskQuery>(() => ({ view, assignee, priority, relation, order, sort: view === "table" ? { key: sortKey, direction: sortDirection } : null }), [assignee, order, priority, relation, sortDirection, sortKey, view])
  const { archive, assign, retry, state, updateStatus } = useTasks(query, repository)
  const [announcement, setAnnouncement] = useState("")

  const setParam = (name: "assignee" | "orderBy" | "priority" | "relation" | "view", value: string, fallback = "all") => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    if (value === fallback) next.delete(name); else next.set(name, value)
    if (name === "view" && value !== "table") { next.delete("sort"); next.delete("order") }
    return next
  })
  const resetFilters = () => setSearchParams((current) => { const next = new URLSearchParams(current); for (const key of ["assignee", "priority", "relation"]) next.delete(key); return next })
  const sort = (key: TaskSortKey) => setSearchParams((current) => { const next = new URLSearchParams(current); next.set("view", "table"); next.set("sort", key); next.set("order", sortKey === key && sortDirection === "asc" ? "desc" : "asc"); return next })
  const changeStatus = async (id: string, status: TaskStatus) => { await updateStatus(id, status); setAnnouncement(`Задача ${id} перемещена в «${status}»`) }
  const assignTask = async (id: string) => { await assign(id); setAnnouncement(`Вы назначены на задачу ${id}`) }
  const archiveTask = async (id: string) => { await archive(id); setAnnouncement(`Задача ${id} перенесена в архив`) }
  const actions = { onArchive: (id: string) => void archiveTask(id), onAssign: (id: string) => void assignTask(id), onStatusChange: (id: string, status: TaskStatus) => void changeStatus(id, status) }
  const activeFilters = Number(assignee !== "all") + Number(priority !== "all") + Number(relation !== "all")

  return <PageFrame className="space-y-3" width="full">
    <PageNav ariaLabel="Разделы задач" items={navItems} onValueChange={(value) => setParam("view", value, "dashboard")} value={view} />
    <TaskControls activeFilters={activeFilters} assignee={assignee} onChange={setParam} onReset={resetFilters} order={order as TaskOrder} priority={priority as TaskPriority | "all"} relation={relation as TaskRelationType | "all"} />
    <p aria-live="polite" className="sr-only">{announcement}</p>
    {state.status === "loading" ? <TasksLoading /> : null}
    {state.status === "error" ? <div className="rounded-xl border bg-surface-raised"><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={retry} title="Задачи не загрузились" tone="danger">{state.message}</PageState></div> : null}
    {state.status === "ready" && state.data.length === 0 ? <div className="rounded-xl border bg-surface-raised"><PageState actionLabel="Сбросить фильтры" icon={IconFilter} onAction={resetFilters} title="Задач нет">Измените исполнителя, приоритет или тип связи.</PageState></div> : null}
    {state.status === "ready" && state.data.length > 0 ? <TaskContent actions={actions} announcement={announcement} onAnnouncement={setAnnouncement} sortDirection={sortDirection} sortKey={sortKey} tasks={state.data} view={view} onSort={sort} /> : null}
  </PageFrame>
}

function TaskContent({ actions, announcement, onAnnouncement, onSort, sortDirection, sortKey, tasks, view }: { actions: { onArchive: (id: string) => void; onAssign: (id: string) => void; onStatusChange: (id: string, status: TaskStatus) => void }; announcement: string; onAnnouncement: (message: string) => void; onSort: (key: TaskSortKey) => void; sortDirection: "asc" | "desc"; sortKey: TaskSortKey; tasks: CrmTask[]; view: TaskView }) {
  if (view === "dashboard") return <TaskDashboard tasks={tasks} {...actions} />
  if (view === "kanban") return <TaskKanban announcement={announcement} onAnnouncement={onAnnouncement} tasks={tasks} {...actions} />
  if (view === "table") return <TaskTable onSort={onSort} sortDirection={sortDirection} sortKey={sortKey} tasks={tasks} {...actions} />
  return <TaskCards tasks={tasks} {...actions} />
}
