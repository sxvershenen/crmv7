import type { Assignee } from "@crm/ui"
import type { TaskCreate, TaskDto, TaskUpdate } from "@crm/contracts/tasks"
import { TaskDtoSchema } from "@crm/contracts/tasks"
import { SessionUserSchema } from "@crm/contracts/auth"
import { z } from "zod"

import type { CrmTask, TaskEditorRecord, TaskPriority, TaskQuery, TaskSortKey, TaskStatus } from "@app/entities/tasks"
import { isTaskProblem } from "@app/entities/tasks"
import { taskAssigneesFixture, tasksFixture } from "@app/fixtures/tasks"
import { apiClient, type ApiClientError } from "@app/lib/api-client"
import { useFixtureData } from "@app/lib/data-mode"

export interface TaskRepository {
  list(query: TaskQuery): Promise<CrmTask[]>
  assign(id: string): Promise<CrmTask>
  updateStatus(id: string, status: TaskStatus): Promise<CrmTask>
  archive(id: string): Promise<CrmTask>
}

export interface TaskEditorRepository {
  get(id: string): Promise<TaskEditorRecord | null>
  save(task: TaskEditorRecord): Promise<TaskEditorRecord>
}

export type ApiTaskRepositoryOptions = {
  client?: Pick<typeof apiClient, "get" | "patch" | "post"> & Partial<Pick<typeof apiClient, "getWithMeta">>
}

const collator = new Intl.Collator("ru-RU", { numeric: true, sensitivity: "base" })
const priorityOrder: Record<TaskPriority, number> = { low: 0, normal: 1, high: 2, urgent: 3 }

const sortValue: Record<TaskSortKey, (task: CrmTask) => string | number> = {
  title: (task) => task.title,
  due: (task) => task.dueAt ?? "9999-12-31",
  relation: (task) => task.relation.label,
  priority: (task) => priorityOrder[task.priority],
  status: (task) => task.status,
  assignee: (task) => task.assignees[0]?.name ?? "",
}

function compare(left: string | number, right: string | number) {
  return typeof left === "number" && typeof right === "number" ? left - right : collator.compare(String(left), String(right))
}

export function selectTasks(data: CrmTask[], query: TaskQuery, currentUserId = "marina") {
  const items = data.filter((task) => {
    if (query.view === "archive" ? !task.archived : task.archived) return false
    if (query.view === "problems" && !isTaskProblem(task)) return false
    if (query.assignee === "mine" && !task.assignees.some((person) => person.id === currentUserId)) return false
    if (query.assignee === "unassigned" && task.assignees.length > 0) return false
    if (query.priority !== "all" && task.priority !== query.priority) return false
    if (query.relation !== "all" && task.relation.type !== query.relation) return false
    return true
  })

  if (query.sort) {
    const sign = query.sort.direction === "asc" ? 1 : -1
    return items.sort((left, right) => compare(sortValue[query.sort!.key](left), sortValue[query.sort!.key](right)) * sign)
  }

  return items.sort((left, right) => {
    if (query.order === "priorityDesc") return priorityOrder[right.priority] - priorityOrder[left.priority] || compare(left.dueAt ?? "9999", right.dueAt ?? "9999")
    if (query.order === "createdDesc") return compare(right.createdAt, left.createdAt)
    return compare(left.dueAt ?? "9999", right.dueAt ?? "9999")
  })
}

export class FixtureTaskRepository implements TaskRepository, TaskEditorRepository {
  private data = structuredClone(tasksFixture)
  private editorData = new Map<string, TaskEditorRecord>()

  async list(query: TaskQuery) {
    return Promise.resolve(selectTasks(structuredClone(this.data), query))
  }

  async assign(id: string) {
    return this.mutate(id, (task) => { task.assignees = [taskAssigneesFixture[0] as Assignee] })
  }

  async updateStatus(id: string, status: TaskStatus) {
    return this.mutate(id, (task) => { task.status = status })
  }

  async archive(id: string) {
    return this.mutate(id, (task) => { task.archived = true })
  }

  async get(id: string) {
    const cached = this.editorData.get(id)
    if (cached) return Promise.resolve(structuredClone(cached))
    const task = this.data.find((item) => item.id === id)
    if (!task) return Promise.resolve(null)
    const editor = toEditorRecord(task)
    this.editorData.set(id, editor)
    return Promise.resolve(structuredClone(editor))
  }

  async save(task: TaskEditorRecord) {
    const next = structuredClone(task)
    this.editorData.set(next.id, next)
    const flat = toListTask(next)
    const index = this.data.findIndex((item) => item.id === task.id)
    if (index >= 0) this.data[index] = flat
    else this.data.unshift(flat)
    return Promise.resolve(structuredClone(next))
  }

  private async mutate(id: string, update: (task: CrmTask) => void) {
    const task = this.data.find((item) => item.id === id)
    if (!task) throw new Error("Задача не найдена")
    update(task)
    return Promise.resolve(structuredClone(task))
  }
}

type VersionedTask = CrmTask & { version: number; entityId?: string; updatedAt?: string }

const taskStatusToApi: Record<TaskStatus, TaskDto["status"]> = {
  todo: "todo",
  in_progress: "in_progress",
  review: "review",
  done: "done",
}

function taskStatusToUi(status: TaskDto["status"]): TaskStatus {
  if (status === "open") return "todo"
  if (status === "completed" || status === "cancelled") return "done"
  return status as TaskStatus
}

function formatDueLabel(dueAt: string | null) {
  if (!dueAt) return "Без срока"
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short" }).format(new Date(dueAt))
}

function relationFromDto(relation: TaskDto["relation"]): CrmTask["relation"] {
  const value = relation as Record<string, unknown>
  const type = ["lead", "booking", "customer", "program", "event", "internal"].includes(String(value.type)) ? String(value.type) as CrmTask["relation"]["type"] : "internal"
  const label = typeof value.label === "string" && value.label.length > 0 ? value.label : "Связанная запись"
  const href = typeof value.href === "string" && value.href.length > 0 ? value.href : `/tasks/${String(value.id ?? "")}`
  return { type, label, href }
}

function mapTask(dto: TaskDto): VersionedTask {
  const task: VersionedTask = {
    id: dto.id,
    title: dto.title,
    details: dto.details,
    status: taskStatusToUi(dto.status),
    priority: dto.priority,
    dueAt: dto.dueAt,
    dueLabel: formatDueLabel(dto.dueAt),
    createdAt: dto.createdAt,
    relation: relationFromDto(dto.relation),
    assignees: dto.assignees.map((person) => ({ ...person })),
    commentCount: dto.commentCount,
    latestComment: dto.latestComment,
    blocked: dto.blocked,
    archived: dto.archived,
    version: dto.version,
    entityId: dto.entityId,
    updatedAt: dto.updatedAt,
  }
  return task
}

function assigneesForApi(assignees: Assignee[]) {
  return assignees.map(({ id, initials, name }) => ({ id, initials, name }))
}

function reminderForApi(value: string | number | null) {
  if (typeof value === "number" || value === null) return value
  return value.trim() ? Number(value) : null
}

function toTaskPayload(task: TaskEditorRecord): TaskCreate {
  return {
    title: task.title,
    details: task.details,
    status: taskStatusToApi[task.status],
    priority: task.priority,
    dueAt: task.dueAt,
    reminderMinutes: reminderForApi(task.reminderMinutes),
    relation: task.relation,
    assignees: assigneesForApi(task.assignees),
    blocked: task.blocked,
  }
}

function toTaskUpdate(input: Partial<TaskEditorRecord> & { version: number }): TaskUpdate {
  return {
    version: input.version,
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.details === undefined ? {} : { details: input.details }),
    ...(input.status === undefined ? {} : { status: taskStatusToApi[input.status] }),
    ...(input.priority === undefined ? {} : { priority: input.priority }),
    ...(input.dueAt === undefined ? {} : { dueAt: input.dueAt }),
    ...(input.reminderMinutes === undefined ? {} : { reminderMinutes: reminderForApi(input.reminderMinutes) }),
    ...(input.relation === undefined ? {} : { relation: input.relation }),
    ...(input.assignees === undefined ? {} : { assignees: assigneesForApi(input.assignees) }),
    ...(input.blocked === undefined ? {} : { blocked: input.blocked }),
  }
}

export class ApiTaskRepository implements TaskRepository, TaskEditorRepository {
  private readonly versions = new Map<string, number>()
  private readonly client: Pick<typeof apiClient, "get" | "patch" | "post"> & Partial<Pick<typeof apiClient, "getWithMeta">>

  constructor(options: ApiTaskRepositoryOptions = {}) {
    this.client = options.client ?? apiClient
  }

  async list(query: TaskQuery) {
    let currentUserId = "marina"
    if (query.assignee === "mine") {
      const response = await this.client.get("/auth/session", z.object({ user: SessionUserSchema }).strict())
      currentUserId = response.user.id
    }
    const params = new URLSearchParams({ archived: String(query.view === "archive"), limit: "100", order: query.order === "createdDesc" ? "createdDesc" : "dueAsc" })
    if (query.priority !== "all") params.set("priority", query.priority)
    if (query.assignee === "mine") params.set("assigneeId", currentUserId)
    const data: TaskDto[] = []
    let cursor: string | null = null
    for (let page = 0; page < 100; page += 1) {
      if (cursor) params.set("cursor", cursor); else params.delete("cursor")
      if (!this.client.getWithMeta) {
        data.push(...await this.client.get("/tasks?" + params.toString(), TaskDtoSchema.array()))
        break
      }
      const response = await this.client.getWithMeta("/tasks?" + params.toString(), TaskDtoSchema.array())
      data.push(...response.data)
      cursor = response.headers.get("x-next-cursor")
      if (!cursor) break
      if (page === 99) throw new Error("Не удалось загрузить все страницы задач")
    }
    return selectTasks(data.map((dto) => this.remember(mapTask(dto))), query, currentUserId)
  }

  async get(id: string) {
    try {
      const dto = await this.client.get(`/tasks/${encodeURIComponent(id)}`, TaskDtoSchema)
      const task = this.remember(mapTask(dto))
      return { ...task, reminderMinutes: dto.reminderMinutes === null ? "" : String(dto.reminderMinutes) }
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as ApiClientError).code === "NOT_FOUND") return null
      throw error
    }
  }

  async create(input: TaskCreate | TaskEditorRecord) {
    const payload: TaskCreate = "id" in input ? toTaskPayload(input) : input
    const dto = await this.client.post("/tasks", payload, TaskDtoSchema)
    return this.remember(mapTask(dto))
  }

  async update(id: string, input: Partial<TaskEditorRecord> & { version?: number }) {
    const version = await this.versionFor(id, input.version)
    const dto = await this.client.patch(`/tasks/${encodeURIComponent(id)}`, toTaskUpdate({ ...input, version }), TaskDtoSchema)
    return this.remember(mapTask(dto))
  }

  async save(task: TaskEditorRecord) {
    if (task.id === "new") {
      const created = await this.create(task)
      return { ...created, reminderMinutes: task.reminderMinutes }
    }
    const updated = await this.update(task.id, task)
    return { ...updated, reminderMinutes: task.reminderMinutes }
  }

  async updateStatus(id: string, status: TaskStatus) {
    return this.update(id, { status })
  }

  async archive(id: string) {
    const version = await this.versionFor(id)
    const dto = await this.client.post(`/tasks/${encodeURIComponent(id)}/archive`, { version }, TaskDtoSchema)
    return this.remember(mapTask(dto))
  }

  async assign(id: string) {
    const version = await this.versionFor(id)
    const dto = await this.client.post(`/tasks/${encodeURIComponent(id)}/assign-self`, { version }, TaskDtoSchema)
    return this.remember(mapTask(dto))
  }

  private remember(task: VersionedTask) {
    this.versions.set(task.id, task.version)
    return task
  }

  private async versionFor(id: string, version?: number) {
    if (version !== undefined) return version
    const known = this.versions.get(id)
    if (known !== undefined) return known
    const task = await this.get(id)
    if (!task) throw new Error("Задача не найдена")
    return (task as VersionedTask).version
  }
}

function toEditorRecord(task: CrmTask): TaskEditorRecord {
  return { ...structuredClone(task), reminderMinutes: "" }
}

function toListTask(record: TaskEditorRecord): CrmTask {
  const task: Partial<TaskEditorRecord> = structuredClone(record)
  delete task.reminderMinutes
  return task as CrmTask
}

export const fixtureTaskRepository: TaskRepository & TaskEditorRepository = new FixtureTaskRepository()
export const apiTaskRepository: TaskRepository & TaskEditorRepository = new ApiTaskRepository()
export const taskRepository: TaskRepository & TaskEditorRepository = useFixtureData ? fixtureTaskRepository : apiTaskRepository
