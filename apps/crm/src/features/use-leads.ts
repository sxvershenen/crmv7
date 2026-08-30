import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { leadRepository, type LeadRepository } from "@app/data/leads-repository"
import type { Lead, LeadQuery, LeadStage } from "@app/entities/leads"

type LeadsState =
  | { status: "loading" }
  | { status: "ready"; data: Lead[] }
  | { status: "error"; message: string }

export function useLeads(query: LeadQuery, repository: LeadRepository = leadRepository) {
  const queryClient = useQueryClient()
  const queryKey = ["leads", query, repository] as const
  const result = useQuery({ queryKey, queryFn: () => repository.list(query) })
  const mutation = useMutation({ mutationFn: (lead: Lead) => repository.save(lead) })
  const state: LeadsState = result.isPending ? { status: "loading" } : result.isError ? { status: "error", message: result.error instanceof Error ? result.error.message : "Не удалось загрузить заявки" } : { status: "ready", data: result.data }

  const moveLead = async (leadId: string, stage: LeadStage) => {
    if (state.status !== "ready") return
    const lead = state.data.find((item) => item.id === leadId)
    if (!lead || lead.stage === stage) return
    const previous = state.data
    queryClient.setQueryData<Lead[]>(queryKey, previous.map((item) => item.id === leadId ? { ...item, stage } : item))
    try { await mutation.mutateAsync({ ...lead, stage }); await queryClient.invalidateQueries({ queryKey: ["leads"] }) }
    catch (error) { queryClient.setQueryData(queryKey, previous); throw error }
  }

  return {
    moveLead,
    retry: () => { void result.refetch() },
    state,
  }
}
