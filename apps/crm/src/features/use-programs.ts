import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { programsRepository, type ProgramsRepository } from "@app/data/programs-repository"
import type { ProgramQuery, ProgramRegistrationStatus, ProgramRunStatus, ProgramsDataset } from "@app/entities/programs"

export type ProgramsState =
  | { status: "loading" }
  | { status: "ready"; data: ProgramsDataset }
  | { status: "error"; message: string }

export function usePrograms(query: ProgramQuery, repository: ProgramsRepository = programsRepository) {
  const result = useQuery({ queryKey: ["programs", repository, query] as const, queryFn: () => repository.list(query) })
  const queryClient = useQueryClient()
  const queryKey = ["programs", repository, query] as const
  const [optimistic, setOptimistic] = useState<{ templates: Record<string, ProgramsDataset["templates"][number]>; runs: Record<string, ProgramsDataset["runs"][number]>; registrations: Record<string, ProgramsDataset["registrations"][number]> }>({ templates: {}, runs: {}, registrations: {} })
  const mutation = useMutation({ mutationFn: (action: () => Promise<unknown>) => action() })
  const state: ProgramsState = result.isPending
    ? { status: "loading" }
    : result.isError
      ? { status: "error", message: result.error instanceof Error ? result.error.message : "Не удалось загрузить программы" }
      : { status: "ready", data: { ...result.data, templates: result.data.templates.map((item) => optimistic.templates[item.id] ?? item), runs: result.data.runs.map((item) => optimistic.runs[item.id] ?? item), registrations: result.data.registrations.map((item) => optimistic.registrations[item.id] ?? item) } }
  const mutate = async <T,>(action: () => Promise<T>) => {
    const updated = await mutation.mutateAsync(action) as T
    queryClient.setQueryData<ProgramsDataset>(queryKey, (current) => {
      if (!current || !updated || typeof updated !== "object") return current
      const value = updated as unknown as Record<string, unknown>
      if ("templateId" in value) return { ...current, runs: current.runs.map((item) => item.id === value.id ? updated as unknown as ProgramsDataset["runs"][number] : item) }
      if ("runId" in value) return { ...current, registrations: current.registrations.map((item) => item.id === value.id ? updated as unknown as ProgramsDataset["registrations"][number] : item) }
      return { ...current, templates: current.templates.map((item) => item.id === value.id ? updated as unknown as ProgramsDataset["templates"][number] : item) }
    })
    if (updated && typeof updated === "object") {
      const value = updated as unknown as Record<string, unknown>
      if ("templateId" in value) setOptimistic((items) => ({ ...items, runs: { ...items.runs, [String(value.id)]: updated as unknown as ProgramsDataset["runs"][number] } }))
      else if ("runId" in value) setOptimistic((items) => ({ ...items, registrations: { ...items.registrations, [String(value.id)]: updated as unknown as ProgramsDataset["registrations"][number] } }))
      else setOptimistic((items) => ({ ...items, templates: { ...items.templates, [String(value.id)]: updated as unknown as ProgramsDataset["templates"][number] } }))
    }
    return updated
  }
  return {
    assignRegistration: (id: string) => mutate(() => repository.assignRegistration(id)),
    assignRun: (id: string) => mutate(() => repository.assignRun(id)),
    assignTemplate: (id: string) => mutate(() => repository.assignTemplate(id)),
    retry: () => { void result.refetch() },
    state,
    updateRegistrationStatus: (id: string, status: ProgramRegistrationStatus) => {
      const current = state.status === "ready" ? state.data.registrations.find((item) => item.id === id) : undefined
      if (current) setOptimistic((items) => ({ ...items, registrations: { ...items.registrations, [id]: { ...current, status } } }))
      return mutate(() => repository.updateRegistrationStatus(id, status))
    },
    updateRunStatus: (id: string, status: ProgramRunStatus) => {
      const current = state.status === "ready" ? state.data.runs.find((item) => item.id === id) : undefined
      if (current) setOptimistic((items) => ({ ...items, runs: { ...items.runs, [id]: { ...current, status } } }))
      return mutate(() => repository.updateRunStatus(id, status))
    },
  }
}
