import { describe, expect, it, vi } from "vitest"

import { TaskDtoSchema, type TaskDto } from "@crm/contracts/tasks"
import type { TaskQuery } from "@app/entities/tasks"
import { tasksFixture } from "@app/fixtures/tasks"
import { ApiTaskRepository, FixtureTaskRepository, selectTasks } from "./tasks-repository"

const baseQuery: TaskQuery = { view: "kanban", assignee: "all", priority: "all", relation: "all", order: "dueAsc", sort: null }

describe("TaskRepository fixture adapter", () => {
  it("derives problems from overdue, blocked and unassigned tasks", () => {
    const result = selectTasks(structuredClone(tasksFixture), { ...baseQuery, view: "problems" })
    expect(result.map((task) => task.id)).toEqual(expect.arrayContaining(["T-182", "T-183", "T-180"]))
    expect(result.some((task) => task.id === "T-177")).toBe(false)
  })

  it("keeps archive separate and combines filters", () => {
    const archived = selectTasks(structuredClone(tasksFixture), { ...baseQuery, view: "archive" })
    expect(archived.map((task) => task.id)).toEqual(["T-176", "T-175"])
    const filtered = selectTasks(structuredClone(tasksFixture), { ...baseQuery, assignee: "mine", priority: "high", relation: "booking" })
    expect(filtered.map((task) => task.id)).toEqual(["T-184"])
  })

  it("supports table sorting and repository-backed mutations", async () => {
    const sorted = selectTasks(structuredClone(tasksFixture), { ...baseQuery, view: "table", sort: { key: "priority", direction: "desc" } })
    expect(sorted[0]?.priority).toBe("urgent")

    const repository = new FixtureTaskRepository()
    await repository.assign("T-180")
    await repository.updateStatus("T-180", "in_progress")
    await repository.archive("T-180")
    const archived = await repository.list({ ...baseQuery, view: "archive" })
    const task = archived.find((item) => item.id === "T-180")
    expect(task?.assignees[0]?.name).toBe("Марина Кириллова")
    expect(task?.status).toBe("in_progress")
  })

  it("loads and saves an individual task behind the editor boundary", async () => {
    const repository = new FixtureTaskRepository()
    const task = await repository.get("T-184")
    expect(task?.title).toBe("Уточнить финальный состав гостей")
    await repository.save({
      ...task!,
      reminderMinutes: "30",
      title: "Уточнить состав гостей — обновлено",
    })
    expect(await repository.get("T-184")).toMatchObject({
      reminderMinutes: "30",
      title: "Уточнить состав гостей — обновлено",
    })

    const listTask = (await repository.list(baseQuery)).find((item) => item.id === "T-184")
    expect(listTask).not.toHaveProperty("reminderMinutes")
  })
})

describe("TaskRepository API adapter", () => {
  const dto: TaskDto = {
    id: "T-900",
    entityId: "11111111-1111-4111-8111-111111111111",
    version: 3,
    title: "API task",
    details: "Details",
    status: "todo",
    priority: "high",
    dueAt: "2026-08-24T11:00:00+03:00",
    reminderMinutes: 30,
    relation: { type: "booking", label: "Бронь #900", href: "/bookings/900" },
    assignees: [],
    commentCount: 0,
    latestComment: null,
    blocked: false,
    archived: false,
    createdAt: "2026-08-20T11:00:00+03:00",
    updatedAt: "2026-08-20T11:00:00+03:00",
    capabilities: { canEdit: true, canChangeStatus: true, canArchive: true },
  }

  it("maps DTOs and carries optimistic versions across mutations", async () => {
    const client = { get: vi.fn().mockResolvedValue([dto]), patch: vi.fn().mockResolvedValue({ ...dto, version: 4, status: "in_progress" }), post: vi.fn().mockResolvedValue({ ...dto, version: 5, archived: true }) }
    const repository = new ApiTaskRepository({ client: client as never })

    const listed = await repository.list(baseQuery)
    expect(listed[0]).toMatchObject({ id: "T-900", title: "API task", status: "todo", version: 3 })
    await repository.updateStatus("T-900", "in_progress")
    expect(client.patch).toHaveBeenCalledWith("/tasks/T-900", expect.objectContaining({ version: 3, status: "in_progress" }), TaskDtoSchema)
    await repository.archive("T-900")
    expect(client.post).toHaveBeenCalledWith("/tasks/T-900/archive", { version: 4 }, TaskDtoSchema)
  })

  it("uses the session assignee and follows every server cursor before local projections", async () => {
    const userId = "22222222-2222-4222-8222-222222222222"
    const nextHeaders = new Headers({ "x-next-cursor": "next-page" })
    const finalHeaders = new Headers()
    const first = { ...dto, assignees: [{ id: userId, initials: "АР", name: "Администратор CRM" }] }
    const second = { ...dto, id: "T-901", entityId: "33333333-3333-4333-8333-333333333333", version: 1, assignees: [{ id: userId, initials: "АР", name: "Администратор CRM" }] }
    const client = {
      get: vi.fn().mockResolvedValue({ user: { id: userId, name: "Администратор CRM", role: "admin", capabilities: { canView: true } } }),
      getWithMeta: vi.fn()
        .mockResolvedValueOnce({ data: [first], headers: nextHeaders, status: 200 })
        .mockResolvedValueOnce({ data: [second], headers: finalHeaders, status: 200 }),
      patch: vi.fn(),
      post: vi.fn(),
    }
    const repository = new ApiTaskRepository({ client: client as never })
    const listed = await repository.list({ ...baseQuery, assignee: "mine" })

    expect(listed.map((task) => task.id)).toEqual(["T-900", "T-901"])
    expect(client.getWithMeta).toHaveBeenNthCalledWith(1, expect.stringContaining("assigneeId=" + userId), TaskDtoSchema.array())
    expect(client.getWithMeta).toHaveBeenNthCalledWith(2, expect.stringContaining("cursor=next-page"), TaskDtoSchema.array())
  })
})
