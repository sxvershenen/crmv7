import { useQuery } from "@tanstack/react-query"

import { resourceRepository, type ResourceRepository } from "@app/data/resources-repository"
import type { ResourceDataset, ResourceQuery } from "@app/entities/resources"

export type ResourcesState =
  | { status: "loading" }
  | { status: "ready"; data: ResourceDataset }
  | { status: "error"; message: string }

const repositoryIds = new WeakMap<ResourceRepository, number>()
let repositorySequence = 0

export function useResources(query: ResourceQuery, repository: ResourceRepository = resourceRepository) {
  const existing = repositoryIds.get(repository)
  const repositoryKey = existing ?? (() => { const next = ++repositorySequence; repositoryIds.set(repository, next); return next })()
  const result = useQuery({ queryKey: ["resources", repositoryKey, query] as const, queryFn: () => repository.list(query) })
  const state: ResourcesState = result.isPending
    ? { status: "loading" }
    : result.isError
      ? { status: "error", message: result.error instanceof Error ? result.error.message : "Не удалось загрузить ресурсы" }
      : { status: "ready", data: result.data }
  return { retry: () => { void result.refetch() }, state }
}
