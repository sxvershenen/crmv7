import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { bookingRepository, type BookingRepository } from "@app/data/bookings-repository"
import type { Booking, BookingDataset, BookingQuery } from "@app/entities/bookings"

export type BookingsState =
  | { status: "loading" }
  | { status: "ready"; data: BookingDataset }
  | { status: "error"; message: string }

const repositoryIds = new WeakMap<BookingRepository, number>()
let repositorySequence = 0
function repositoryKey(repository: BookingRepository) {
  const existing = repositoryIds.get(repository)
  if (existing !== undefined) return existing
  repositorySequence += 1
  repositoryIds.set(repository, repositorySequence)
  return repositorySequence
}

export function useBookings(query: BookingQuery, repository: BookingRepository = bookingRepository) {
  const queryClient = useQueryClient()
  const key = repositoryKey(repository)
  const queryKey = ["bookings", key, query] as const
  const result = useQuery({ queryKey, queryFn: () => repository.list(query), placeholderData: (previous) => previous })
  const mutation = useMutation({ mutationFn: (input: { id: string; startHour: number; endHour: number; resourceId?: string | null }) => {
    if (!repository.updateInterval) throw new Error("Изменение интервала бронирования недоступно")
    return repository.updateInterval(input.id, input.startHour, input.endHour, input.resourceId)
  } })
  const state: BookingsState = result.isPending ? { status: "loading" } : result.isError ? { status: "error", message: result.error instanceof Error ? result.error.message : "Не удалось загрузить бронирования" } : { status: "ready", data: result.data }
  const updateInterval = async (id: string, startHour: number, endHour: number, resourceId?: string | null) => {
    const updated = await mutation.mutateAsync({ id, startHour, endHour, ...(resourceId === undefined ? {} : { resourceId }) })
    await queryClient.invalidateQueries({ queryKey: ["bookings", key] })
    return updated
  }
  return { state, retry: () => { void result.refetch() }, updateInterval }
}
