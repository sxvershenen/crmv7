import { randomUUID } from "node:crypto"

import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common"
import { DataSource, type EntityManager } from "typeorm"

import type { SessionUser, TaskCreate, TaskDto, TaskListQuery, TaskUpdate } from "@crm/contracts"
import { ChangeLogEntity, OutboxEventEntity, TaskEntity } from "@crm/db"
import { assertCapability, assertTaskTransition } from "@crm/domain"

import { toTaskDto } from "./task.mapper.js"

@Injectable()
export class TasksService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async list(query: TaskListQuery, actor: SessionUser): Promise<{ items: TaskDto[]; nextCursor: string | null }> {
    assertCapability(actor.capabilities, "canView")
    const repository = this.dataSource.getRepository(TaskEntity)
    const builder = repository.createQueryBuilder("task")
    if (query.archived === true) builder.andWhere("task.archived_at IS NOT NULL")
    else builder.andWhere("task.archived_at IS NULL")
    if (query.status) builder.andWhere("task.status = :status", { status: query.status })
    if (query.priority) builder.andWhere("task.priority = :priority", { priority: query.priority })
    if (query.assigneeId) {
      builder.andWhere("task.assignees @> :assignee::jsonb", { assignee: JSON.stringify([{ id: query.assigneeId }]) })
    }
    if (query.search) builder.andWhere("(task.code ILIKE :search OR task.title ILIKE :search OR task.details ILIKE :search)", { search: `%${query.search}%` })
    if (query.dueAfter) builder.andWhere("task.due_at >= :dueAfter", { dueAfter: new Date(query.dueAfter) })
    if (query.dueBefore) builder.andWhere("task.due_at < :dueBefore", { dueBefore: new Date(query.dueBefore) })

    const cursor = query.cursor ? this.decodeCursor(query.cursor, query.order) : null
    if (cursor) {
      if (query.order === "createdDesc") {
        builder.andWhere("(task.created_at < :cursorAt OR (task.created_at = :cursorAt AND task.id < :cursorId))", {
          cursorAt: new Date(cursor.value!), cursorId: cursor.id,
        })
      } else if (cursor.value === null) {
        builder.andWhere("task.due_at IS NULL AND task.id > :cursorId", { cursorId: cursor.id })
      } else {
        builder.andWhere("(task.due_at > :cursorAt OR (task.due_at = :cursorAt AND task.id > :cursorId) OR task.due_at IS NULL)", {
          cursorAt: new Date(cursor.value), cursorId: cursor.id,
        })
      }
    }
    if (query.order === "createdDesc") builder.orderBy("task.created_at", "DESC").addOrderBy("task.id", "DESC")
    else builder.orderBy("task.due_at", "ASC", "NULLS LAST").addOrderBy("task.id", "ASC")
    builder.take(query.limit + 1)
    const rows = await builder.getMany()
    const hasNext = rows.length > query.limit
    const pageRows = hasNext ? rows.slice(0, query.limit) : rows
    const last = pageRows.at(-1)
    return {
      items: pageRows.map((task) => toTaskDto(task, actor.capabilities)),
      nextCursor: hasNext && last ? this.encodeCursor(query.order, query.order === "createdDesc" ? last.createdAt.toISOString() : last.dueAt?.toISOString() ?? null, last.id) : null,
    }
  }

  async get(code: string, actor: SessionUser): Promise<TaskDto> {
    assertCapability(actor.capabilities, "canView")
    return toTaskDto(await this.findByCode(code), actor.capabilities)
  }

  async create(input: TaskCreate, actor: SessionUser, requestId: string): Promise<TaskDto> {
    assertCapability(actor.capabilities, "canCreate")
    return this.dataSource.transaction(async (manager) => {
      const [{ nextval }] = await manager.query(`SELECT nextval('task_code_seq')::text AS nextval`) as [{ nextval: string }]
      const task = manager.create(TaskEntity, {
        id: randomUUID(),
        code: `T-${nextval}`,
        title: input.title.trim(),
        details: input.details,
        status: input.status,
        priority: input.priority,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        reminderMinutes: input.reminderMinutes,
        relation: input.relation,
        assignees: input.assignees,
        commentCount: 0,
        latestComment: null,
        blocked: false,
        createdBy: actor.id,
        updatedBy: actor.id,
        archivedAt: null,
      })
      const saved = await manager.save(task)
      await this.recordMutation(manager, saved, "created", actor.id, requestId, { after: toTaskDto(saved, actor.capabilities) })
      return toTaskDto(saved, actor.capabilities)
    })
  }

  async update(code: string, input: TaskUpdate, actor: SessionUser, requestId: string): Promise<TaskDto> {
    assertCapability(actor.capabilities, "canEdit")
    return this.dataSource.transaction(async (manager) => {
      const current = await manager.getRepository(TaskEntity).findOneBy({ code })
      if (!current) throw new NotFoundException({ code: "TASK_NOT_FOUND", message: "Задача не найдена" })
      if (current.version !== input.version) throw this.versionConflict(current, actor)
      if (input.status && input.status !== current.status) {
        assertCapability(actor.capabilities, "canChangeStatus")
        assertTaskTransition(current.status as TaskDto["status"], input.status)
      }

      const patch: Partial<TaskEntity> = {
        ...(input.title === undefined ? {} : { title: input.title.trim() }),
        ...(input.details === undefined ? {} : { details: input.details }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.priority === undefined ? {} : { priority: input.priority }),
        ...(input.dueAt === undefined ? {} : { dueAt: input.dueAt ? new Date(input.dueAt) : null }),
        ...(input.reminderMinutes === undefined ? {} : { reminderMinutes: input.reminderMinutes }),
        ...(input.relation === undefined ? {} : { relation: input.relation }),
        ...(input.assignees === undefined ? {} : { assignees: input.assignees }),
        ...(input.blocked === undefined ? {} : { blocked: input.blocked }),
        updatedBy: actor.id,
      }
      const result = await manager
        .createQueryBuilder()
        .update(TaskEntity)
        .set({ ...patch, version: () => '"version" + 1', updatedAt: () => "now()" })
        .where("id = :id AND version = :version", { id: current.id, version: input.version })
        .execute()
      if (result.affected !== 1) throw this.versionConflict(await manager.findOneByOrFail(TaskEntity, { id: current.id }), actor)
      const saved = await manager.findOneByOrFail(TaskEntity, { id: current.id })
      await this.recordMutation(manager, saved, "updated", actor.id, requestId, {
        before: toTaskDto(current, actor.capabilities),
        after: toTaskDto(saved, actor.capabilities),
      })
      return toTaskDto(saved, actor.capabilities)
    })
  }

  async archive(code: string, version: number, actor: SessionUser, requestId: string): Promise<TaskDto> {
    assertCapability(actor.capabilities, "canArchive")
    return this.dataSource.transaction(async (manager) => {
      const current = await manager.findOneBy(TaskEntity, { code })
      if (!current) throw new NotFoundException({ code: "TASK_NOT_FOUND", message: "Задача не найдена" })
      if (current.version !== version) throw this.versionConflict(current, actor)
      const archivedAt = new Date()
      const result = await manager
        .createQueryBuilder()
        .update(TaskEntity)
        .set({ archivedAt, updatedBy: actor.id, version: () => '"version" + 1', updatedAt: () => "now()" })
        .where("id = :id AND version = :version", { id: current.id, version })
        .execute()
      if (result.affected !== 1) throw this.versionConflict(await manager.findOneByOrFail(TaskEntity, { id: current.id }), actor)
      const saved = await manager.findOneByOrFail(TaskEntity, { id: current.id })
      await this.recordMutation(manager, saved, "archived", actor.id, requestId, { archivedAt: archivedAt.toISOString() })
      return toTaskDto(saved, actor.capabilities)
    })
  }

  async assignSelf(code: string, version: number, actor: SessionUser, requestId: string): Promise<TaskDto> {
    assertCapability(actor.capabilities, "canAssign")
    return this.dataSource.transaction(async (manager) => {
      const current = await manager.findOneBy(TaskEntity, { code })
      if (!current) throw new NotFoundException({ code: "TASK_NOT_FOUND", message: "Задача не найдена" })
      if (current.version !== version) throw this.versionConflict(current, actor)
      const initials = actor.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("ru-RU") ?? "").join("") || "?"
      const assignees = current.assignees.some((person) => person.id === actor.id)
        ? current.assignees
        : [...current.assignees, { id: actor.id, name: actor.name, initials }]
      const result = await manager.createQueryBuilder().update(TaskEntity).set({
        assignees,
        updatedBy: actor.id,
        version: () => '"version" + 1',
        updatedAt: () => "now()",
      }).where("id = :id AND version = :version", { id: current.id, version }).execute()
      if (result.affected !== 1) throw this.versionConflict(await manager.findOneByOrFail(TaskEntity, { id: current.id }), actor)
      const saved = await manager.findOneByOrFail(TaskEntity, { id: current.id })
      await this.recordMutation(manager, saved, "assigned", actor.id, requestId, { before: current.assignees, after: saved.assignees })
      return toTaskDto(saved, actor.capabilities)
    })
  }

  private async findByCode(code: string) {
    const task = await this.dataSource.getRepository(TaskEntity).findOneBy({ code })
    if (!task) throw new NotFoundException({ code: "TASK_NOT_FOUND", message: "Задача не найдена" })
    return task
  }

  private encodeCursor(order: TaskListQuery["order"], value: string | null, id: string) {
    return Buffer.from(JSON.stringify({ order, value, id }), "utf8").toString("base64url")
  }

  private decodeCursor(cursor: string, order: TaskListQuery["order"]): { value: string | null; id: string } {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<string, unknown>
      if (decoded.order !== order || (typeof decoded.value !== "string" && decoded.value !== null) || typeof decoded.id !== "string") throw new Error("invalid")
      if (order === "createdDesc" && decoded.value === null) throw new Error("invalid")
      if (decoded.value !== null && Number.isNaN(new Date(decoded.value).getTime())) throw new Error("invalid")
      return { value: decoded.value, id: decoded.id }
    } catch {
      throw new BadRequestException({ code: "INVALID_CURSOR", message: "Некорректный cursor", fieldErrors: { cursor: ["Cursor устарел или повреждён"] } })
    }
  }

  private versionConflict(server: TaskEntity, actor: SessionUser) {
    return new ConflictException({
      code: "VERSION_CONFLICT",
      message: "Задача была изменена другим сотрудником",
      details: { entityId: server.code, serverVersion: server.version, server: toTaskDto(server, actor.capabilities) },
    })
  }

  private async recordMutation(
    manager: EntityManager,
    task: TaskEntity,
    action: string,
    actorId: string,
    requestId: string,
    changes: Record<string, unknown>,
  ) {
    const now = new Date()
    await manager.getRepository(ChangeLogEntity).save(manager.create(ChangeLogEntity, {
      id: randomUUID(), entityType: "task", entityId: task.id, action, actorId, requestId, changes, createdAt: now,
    }))
    await manager.getRepository(OutboxEventEntity).save(manager.create(OutboxEventEntity, {
      id: randomUUID(), topic: `task.${action}`, aggregateType: "task", aggregateId: task.id,
      payload: { taskId: task.code, version: task.version }, availableAt: now, processedAt: null, attempts: 0, createdAt: now,
    }))
  }
}
