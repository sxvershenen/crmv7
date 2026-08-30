import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { financeRepository, type FinanceRepository } from "@app/data/finance-repository"
import type { FinanceDataset, FinanceQuery } from "@app/entities/finance"

export type FinanceState = { status: "loading" } | { status: "ready"; data: FinanceDataset } | { status: "error"; message: string }
export function useFinance(query: FinanceQuery, repository: FinanceRepository = financeRepository) {
  const queryClient = useQueryClient()
  const result = useQuery({ queryKey: ["finance", query], queryFn: () => repository.get(query) })
  const mutation = useMutation({ mutationFn: (operationId: string) => repository.refund(operationId), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finance"] }) })
  const state: FinanceState = result.isPending ? { status: "loading" } : result.isError ? { status: "error", message: result.error instanceof Error ? result.error.message : "Не удалось загрузить финансы" } : { status: "ready", data: result.data }
  const refund = async (operationId: string) => {
    await mutation.mutateAsync(operationId)
  }
  return { mutationError: mutation.error instanceof Error ? mutation.error.message : null, refund, state, retry: () => { void result.refetch() } }
}
