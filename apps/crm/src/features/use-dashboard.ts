import { useQuery } from "@tanstack/react-query"

import { dashboardRepository, type DashboardRepository } from "@app/data/dashboard-repository"
import type { DashboardData, DashboardScope } from "@app/entities/dashboard"

type DashboardState =
  | { status: "loading" }
  | { status: "ready"; data: DashboardData }
  | { status: "error"; message: string }

export function useDashboard(scope: DashboardScope, repository: DashboardRepository = dashboardRepository) {
  const result = useQuery({ queryKey: ["dashboard", repository, scope], queryFn: () => repository.getOverview(scope) })
  const state: DashboardState = result.isPending
    ? { status: "loading" }
    : result.isError
      ? { status: "error", message: result.error instanceof Error ? result.error.message : "Не удалось загрузить обзор" }
      : { status: "ready", data: result.data }

  return {
    retry: () => { void result.refetch() },
    state,
  }
}
