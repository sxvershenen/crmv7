import { useQuery } from "@tanstack/react-query"

import { customerRepository, type CustomerRepository } from "@app/data/customers-repository"
import type { Customer, CustomerQuery } from "@app/entities/customers"

export type CustomersState =
  | { status: "loading" }
  | { status: "ready"; data: Customer[] }
  | { status: "error"; message: string }

export function useCustomers(query: CustomerQuery, repository: CustomerRepository = customerRepository) {
  const result = useQuery({ queryKey: ["customers", query, repository], queryFn: () => repository.list(query) })
  const state: CustomersState = result.isPending ? { status: "loading" } : result.isError ? { status: "error", message: result.error instanceof Error ? result.error.message : "Не удалось загрузить клиентов" } : { status: "ready", data: result.data }
  return { state, retry: () => { void result.refetch() } }
}
