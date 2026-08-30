import type { Assignee } from "@crm/ui"
import { z } from "zod"

import { taskPriorities, taskRelationTypes, taskStatuses, type TaskEditorRecord } from "@app/entities/tasks"

export type TaskFormValues = {
  archived: boolean
  assignees: Assignee[]
  details: string
  dueAt: string
  priority: TaskEditorRecord["priority"]
  relationHref: string
  relationLabel: string
  relationType: TaskEditorRecord["relation"]["type"]
  reminderMinutes: string
  status: TaskEditorRecord["status"]
  title: string
}

export const taskFormSchema = z.object({
  archived: z.boolean(),
  assignees: z.custom<Assignee[]>((value) => Array.isArray(value), "Некорректный список исполнителей"),
  details: z.string(),
  dueAt: z.string().refine((value) => value === "" || Number.isFinite(new Date(value).getTime()), "Укажите корректные дату и время"),
  priority: z.enum(taskPriorities),
  relationHref: z.string(),
  relationLabel: z.string(),
  relationType: z.enum(taskRelationTypes),
  reminderMinutes: z.string().refine((value) => value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0), "Укажите число не меньше нуля"),
  status: z.enum(taskStatuses),
  title: z.string().refine((value) => value.trim().length > 0, "Укажите название задачи"),
})

function pad(value: number) {
  return String(value).padStart(2, "0")
}

export function toLocalDateTimeInput(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ""
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatTaskDue(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(value))
    .replace(" г.", "")
}

export function toTaskFormValues(record: TaskEditorRecord): TaskFormValues {
  return {
    archived: record.archived,
    assignees: structuredClone(record.assignees),
    details: record.details,
    dueAt: toLocalDateTimeInput(record.dueAt),
    priority: record.priority,
    relationHref: record.relation.href,
    relationLabel: record.relation.label,
    relationType: record.relation.type,
    reminderMinutes: record.reminderMinutes,
    status: record.status,
    title: record.title,
  }
}

export function applyTaskFormValues(record: TaskEditorRecord, values: TaskFormValues): TaskEditorRecord {
  const dueAt = values.dueAt ? new Date(values.dueAt).toISOString() : null
  return {
    ...record,
    archived: values.archived,
    assignees: structuredClone(values.assignees),
    details: values.details,
    dueAt,
    dueLabel: dueAt ? formatTaskDue(dueAt) : "Без срока",
    priority: values.priority,
    relation: {
      href: values.relationHref,
      label: values.relationLabel,
      type: values.relationType,
    },
    reminderMinutes: values.reminderMinutes,
    status: values.status,
    title: values.title,
  }
}
