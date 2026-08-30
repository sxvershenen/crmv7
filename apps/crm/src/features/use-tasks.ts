import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { taskRepository, type TaskRepository } from "@app/data/tasks-repository"
import type { CrmTask, TaskQuery, TaskStatus } from "@app/entities/tasks"

export type TasksState =
  | { status: "loading" }
  | { status: "ready"; data: CrmTask[] }
  | { status: "error"; message: string }

const repositoryIds = new WeakMap<TaskRepository, number>()
let repositorySequence = 0

function repositoryKey(repository: TaskRepository) {
  const existing = repositoryIds.get(repository)
  if (existing !== undefined) return existing
  repositorySequence += 1
  repositoryIds.set(repository, repositorySequence)
  return repositorySequence
}

export function useTasks(query: TaskQuery, repository: TaskRepository = taskRepository) {
  const queryClient = useQueryClient()
  const queryKey = ["tasks", repositoryKey(repository), query] as const
  const result = useQuery({ queryKey, queryFn: () => repository.list(query) })
  const mutation = useMutation({ mutationFn: (action: () => Promise<CrmTask>) => action() })

  const state: TasksState = result.isPending
    ? { status: "loading" }
    : result.isError
      ? { status: "error", message: result.error instanceof Error ? result.error.message : "Не удалось загрузить задачи" }
      : { status: "ready", data: result.data }

  const mutate = async (action: () => Promise<CrmTask>) => {
    const updated = await mutation.mutateAsync(action)
    await queryClient.invalidateQueries({ queryKey })
    return updated
  }

  return {
    archive: (id: string) => mutate(() => repository.archive(id)),
    assign: (id: string) => mutate(() => repository.assign(id)),
    retry: () => { void result.refetch() },
    state,
    updateStatus: (id: string, status: TaskStatus) => mutate(() => repository.updateStatus(id, status)),
  }
}
