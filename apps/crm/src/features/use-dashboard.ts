import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { dashboardRepository, type DashboardRepository } from "@app/data/dashboard-repository"
import type { DashboardData, DashboardItem, DashboardScope } from "@app/entities/dashboard"

type DashboardState =
  | { status: "loading" }
  | { status: "ready"; data: DashboardData }
  | { status: "error"; message: string }

export function useDashboard(scope: DashboardScope, repository: DashboardRepository = dashboardRepository) {
  const queryClient = useQueryClient()
  const result = useQuery({ queryKey: ["dashboard", repository, scope], queryFn: () => repository.getOverview(scope) })
  const assignment = useMutation({
    mutationFn: (item: DashboardItem) => repository.assign(item),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["dashboard", repository] }) },
  })
  const state: DashboardState = result.isPending
    ? { status: "loading" }
    : result.isError
      ? { status: "error", message: result.error instanceof Error ? result.error.message : "Не удалось загрузить обзор" }
      : { status: "ready", data: result.data }

  return {
    assign: (item: DashboardItem) => assignment.mutateAsync(item),
    assignmentError: assignment.error instanceof Error ? assignment.error.message : null,
    assignmentPending: assignment.isPending,
    retry: () => { void result.refetch() },
    state,
  }
}
