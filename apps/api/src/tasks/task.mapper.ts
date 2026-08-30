import type { Capabilities, TaskDto } from "@crm/contracts"
import type { TaskEntity } from "@crm/db"

export function toTaskDto(
  task: TaskEntity,
  capabilities: Pick<Capabilities, "canEdit" | "canChangeStatus" | "canArchive">,
): TaskDto {
  return {
    id: task.code,
    entityId: task.id,
    version: task.version,
    title: task.title,
    details: task.details,
    status: task.status as TaskDto["status"],
    priority: task.priority as TaskDto["priority"],
    dueAt: task.dueAt?.toISOString() ?? null,
    reminderMinutes: task.reminderMinutes,
    relation: task.relation as TaskDto["relation"],
    assignees: task.assignees,
    commentCount: task.commentCount,
    latestComment: task.latestComment,
    blocked: task.blocked,
    archived: task.archivedAt !== null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    capabilities: {
      canEdit: capabilities.canEdit,
      canChangeStatus: capabilities.canChangeStatus,
      canArchive: capabilities.canArchive,
    },
  }
}
