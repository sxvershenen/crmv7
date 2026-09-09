import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { eventsRepository, type EventsRepository } from "@app/data/events-repository"
import type { EventQuery, EventsDataset, EventStatus } from "@app/entities/events"

export type EventsState = { status: "loading" } | { status: "ready"; data: EventsDataset } | { status: "error"; message: string }

export function useEvents(query: EventQuery, repository: EventsRepository = eventsRepository) {
  const result = useQuery({ queryKey: ["events", repository, query] as const, queryFn: () => repository.list(query) })
  const queryClient = useQueryClient()
  const queryKey = ["events", repository, query] as const
  const [optimisticEvents, setOptimisticEvents] = useState<Record<string, EventsDataset["events"][number]>>({})
  const mutation = useMutation({ mutationFn: (action: () => Promise<unknown>) => action() })
  const state: EventsState = result.isPending
    ? { status: "loading" }
    : result.isError
      ? { status: "error", message: result.error instanceof Error ? result.error.message : "Не удалось загрузить мероприятия" }
      : { status: "ready", data: { ...result.data, events: result.data.events.map((item) => optimisticEvents[item.id] ?? item) } }
  const mutate = async <T,>(action: () => Promise<T>) => {
    const updated = await mutation.mutateAsync(action) as T
    if (updated && typeof updated === "object") {
      const next = updated as unknown as EventsDataset["events"][number]
      setOptimisticEvents((current) => ({ ...current, [next.id]: next }))
      queryClient.setQueryData<EventsDataset>(queryKey, (current) => current ? { ...current, events: current.events.map((item) => item.id === next.id ? next : item) } : current)
    }
    return updated
  }
  const updateStatus = (id: string, status: EventStatus) => {
    const current = state.status === "ready" ? state.data.events.find((item) => item.id === id) : undefined
    if (current) setOptimisticEvents((items) => ({ ...items, [id]: { ...current, status } }))
    return mutate(() => repository.updateStatus(id, status))
  }
  const assign = async (id: string) => {
    const available = state.status === "ready" ? state.data.assignees : []
    const current = state.status === "ready" ? state.data.events.find((item) => item.id === id) : undefined
    const person = available.find((candidate) => !current?.assignees.some((item) => item.id === candidate.id))
    if (person) {
      queryClient.setQueryData<EventsDataset>(queryKey, (current) => current ? { ...current, events: current.events.map((item) => item.id === id ? { ...item, assignees: [...item.assignees, person] } : item) } : current)
      if (current) setOptimisticEvents((items) => ({ ...items, [id]: { ...current, assignees: [...current.assignees, person] } }))
      await mutate(() => repository.assign(id, person))
    }
  }

  return { assign, retry: () => { void result.refetch() }, state, updateStatus }
}
