import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

import type { LeadRepository } from "@app/data/leads-repository"
import type { LeadQuery } from "@app/entities/leads"
import { leadsFixture } from "@app/fixtures/leads"

import { useLeads } from "./use-leads"

const query: LeadQuery = {
  scope: "all",
  stage: "all",
  direction: "all",
  source: "all",
  promo: "all",
  utm: "all",
  sort: { key: "id", direction: "desc" },
}

describe("useLeads local movement", () => {
  it("rolls an optimistic server failure back to its original stage", async () => {
    const lead = structuredClone(leadsFixture[0]!)
    const repository: LeadRepository = { get: vi.fn(), list: vi.fn().mockResolvedValue([lead]), save: vi.fn().mockRejectedValue(new Error("Конфликт версии")) }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useLeads(query, repository), { wrapper })
    await waitFor(() => expect(result.current.state.status).toBe("ready"))

    let message = ""
    const targetStage = lead.stage === "work" ? "waiting" : "work"
    await act(async () => {
      try {
        await result.current.moveLead(lead.id, targetStage)
      } catch (error) {
        message = error instanceof Error ? error.message : String(error)
      }
    })

    expect(message).toMatch(/конфликт версии/iu)

    expect(result.current.state.status).toBe("ready")
    if (result.current.state.status === "ready") {
      expect(result.current.state.data.find((item) => item.id === lead.id)?.stage).toBe(lead.stage)
    }
  })
})
