import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

import type { CustomerRepository } from "@app/data/customers-repository"
import type { CustomerQuery } from "@app/entities/customers"

import { useCustomers } from "./use-customers"

const query: CustomerQuery = {
  type: "all",
  channel: "all",
  flags: [],
  lastVisitDays: null,
  sort: { key: "client", direction: "asc" },
}

describe("useCustomers", () => {
  it("exposes loading and repository error states", async () => {
    const repository: CustomerRepository = { list: vi.fn().mockRejectedValue(new Error("fixture unavailable")) }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useCustomers(query, repository), { wrapper })

    expect(result.current.state.status).toBe("loading")
    await waitFor(() => expect(result.current.state.status).toBe("error"))
    if (result.current.state.status === "error") expect(result.current.state.message).toBe("fixture unavailable")
  })
})
