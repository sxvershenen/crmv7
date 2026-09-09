import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  notificationsRepository,
  type NotificationsRepository,
} from "@app/data/notifications-repository"

export const notificationsQueryKey = ["notifications"] as const

export function useNotifications(repository: NotificationsRepository = notificationsRepository) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: [...notificationsQueryKey, repository],
    queryFn: () => repository.list(),
  })
  const markRead = useMutation({
    mutationFn: (id: string) => repository.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsQueryKey }),
  })
  const markAllRead = useMutation({
    mutationFn: () => repository.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsQueryKey }),
  })

  return { query, markRead, markAllRead }
}
