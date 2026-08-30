import { describe, expect, it, vi } from "vitest"

import { ApiClientError, createApiClient } from "./api-client"

describe("api client", () => {
  it("uses cookie credentials and sends a request id", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })))
    const client = createApiClient({ baseUrl: "/api/internal/v1", fetcher })

    await client.get("/tasks")

    expect(fetcher).toHaveBeenCalledWith("/api/internal/v1/tasks", expect.objectContaining({ credentials: "include" }))
    const headers = (fetcher.mock.calls[0]?.[1] as RequestInit).headers as Headers
    expect(headers.get("accept")).toBe("application/json")
    expect(headers.get("x-request-id")).toBeTruthy()
  })

  it("parses conflict details and response request id into a canonical error", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "VERSION_CONFLICT", message: "Устаревшая версия", details: { serverVersion: 4 } }), { status: 409, headers: { "x-request-id": "req-900" } }))
    const client = createApiClient({ fetcher })

    let caught: unknown
    try {
      await client.get("/tasks/T-900")
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(ApiClientError)
    expect(caught).toMatchObject({ code: "STALE_VERSION", rawCode: "VERSION_CONFLICT", status: 409, requestId: "req-900", details: { serverVersion: 4 }, isConflict: true })
  })
})
