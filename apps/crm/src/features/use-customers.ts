import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { customerRepository, type CustomerRepository } from "@app/data/customers-repository"
import type { Customer, CustomerQuery } from "@app/entities/customers"

export type CustomersState =
  | { status: "loading" }
  | { status: "ready"; data: Customer[] }
  | { status: "error"; message: string }

const repositoryIds = new WeakMap<object, number>()
let nextRepositoryId = 1
function repositoryId(repository: CustomerRepository) {
  const existing = repositoryIds.get(repository)
  if (existing) return existing
  const id = nextRepositoryId++
  repositoryIds.set(repository, id)
  return id
}

export function useCustomers(query: CustomerQuery, repository: CustomerRepository = customerRepository) {
  const queryClient = useQueryClient()
  const queryKey = ["customers", query, repositoryId(repository)] as const
  const result = useQuery({ queryKey, queryFn: () => repository.list(query) })
  const assignment = useMutation({
    mutationFn: (id: string) => repository.assignSelf(id),
    onSuccess: (assigned) => {
      // Apply the authoritative response immediately so the control reflects the
      // completed mutation before the background refetch settles.
      queryClient.setQueryData<Customer[]>(queryKey, (previous) => previous?.map((customer) => customer.id === assigned.id ? assigned : customer))
      void queryClient.invalidateQueries({ queryKey: ["customers"] })
    },
  })
  const state: CustomersState = result.isPending ? { status: "loading" } : result.isError ? { status: "error", message: result.error instanceof Error ? result.error.message : "Не удалось загрузить клиентов" } : { status: "ready", data: result.data }
  return { assignSelf: (id: string) => assignment.mutateAsync(id), state, retry: () => { void result.refetch() } }
}
