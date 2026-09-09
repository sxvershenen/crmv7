import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { leadRepository, type LeadRepository } from "@app/data/leads-repository"
import type { Lead, LeadQuery, LeadStage } from "@app/entities/leads"

type LeadsState =
  | { status: "loading" }
  | { status: "ready"; data: Lead[] }
  | { status: "error"; message: string }

const repositoryIds = new WeakMap<object, number>()
let nextRepositoryId = 1
function repositoryId(repository: LeadRepository) {
  const existing = repositoryIds.get(repository)
  if (existing) return existing
  const id = nextRepositoryId++
  repositoryIds.set(repository, id)
  return id
}

export function useLeads(query: LeadQuery, repository: LeadRepository = leadRepository) {
  const queryClient = useQueryClient()
  const queryKey = ["leads", query, repositoryId(repository)] as const
  const result = useQuery({ queryKey, queryFn: () => repository.list(query) })
  const mutation = useMutation({ mutationFn: (lead: Lead) => repository.save(lead) })
  const assignment = useMutation({
    mutationFn: (id: string) => repository.assignSelf(id),
    onSuccess: (assigned) => {
      // Reflect the server response immediately; invalidation below still
      // reconciles every other lead query in the background.
      queryClient.setQueryData<Lead[]>(queryKey, (previous) => previous?.map((lead) => lead.id === assigned.id ? assigned : lead))
      void queryClient.invalidateQueries({ queryKey: ["leads"] })
    },
  })
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
    assignSelf: (id: string) => assignment.mutateAsync(id),
    moveLead,
    retry: () => { void result.refetch() },
    state,
  }
}
