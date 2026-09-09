import { AdminApiError, ADMIN_AUTH_REQUIRED_EVENT, createAdminApiClient, parseAdminApiError } from "@admin/lib/api-client"

describe("admin API client", () => {
  it("sends the session cookie and a stable request id while safely retrying GET", async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
    const client = createAdminApiClient({ baseUrl: "/api/admin/v1", fetcher })

    await expect(client.get("/content/nodes")).resolves.toEqual({ ok: true })
    expect(fetcher).toHaveBeenCalledTimes(2)
    const first = fetcher.mock.calls[0] as [string, RequestInit]
    const second = fetcher.mock.calls[1] as [string, RequestInit]
    expect(first[0]).toBe("/api/admin/v1/content/nodes")
    expect(first[1].credentials).toBe("include")
    expect(new Headers(first[1].headers).get("x-request-id")).toBeTruthy()
    expect(new Headers(second[1].headers).get("x-request-id")).toBe(new Headers(first[1].headers).get("x-request-id"))
  })

  it("reuses the idempotent body when a mutation is retried after a transient gateway error", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ code: "INTERNAL_ERROR", message: "upstream" }, 503))
      .mockResolvedValueOnce(jsonResponse({ node: "saved" }))
    const client = createAdminApiClient({ fetcher })
    const body = { operationId: "11111111-1111-4111-8111-111111111111", idempotencyKey: "cms-save-1", expectedVersion: 3 }

    await expect(client.patch("/content/nodes/1", body)).resolves.toEqual({ node: "saved" })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect((fetcher.mock.calls[0] as [string, RequestInit])[1].body).toBe(JSON.stringify(body))
    expect((fetcher.mock.calls[1] as [string, RequestInit])[1].body).toBe(JSON.stringify(body))
  })

  it("retries an idempotent PUT with the exact command body", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ code: "INTERNAL_ERROR", message: "upstream" }, 503))
      .mockResolvedValueOnce(jsonResponse({ priceBook: "saved" }))
    const client = createAdminApiClient({ fetcher })
    const body = { operationId: "11111111-1111-4111-8111-111111111111", idempotencyKey: "cms-price-book-0001", expectedPricingVersion: 3 }

    await expect(client.put("/offerings/1/price-books/drafts/2", body)).resolves.toEqual({ priceBook: "saved" })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect((fetcher.mock.calls[0] as [string, RequestInit])[1].method).toBe("PUT")
    expect((fetcher.mock.calls[1] as [string, RequestInit])[1].body).toBe(JSON.stringify(body))
  })

  it("does not retry login and does not turn invalid credentials into a session-expiry event", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ code: "INVALID_CREDENTIALS", message: "invalid" }, 401))
    const listener = vi.fn()
    window.addEventListener(ADMIN_AUTH_REQUIRED_EVENT, listener)
    const client = createAdminApiClient({ baseUrl: "/api/internal/v1", fetcher })

    await expect(client.authPost("/auth/login", { email: "admin@example.com", password: "wrong" })).rejects.toMatchObject({ rawCode: "INVALID_CREDENTIALS" })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(listener).not.toHaveBeenCalled()
    window.removeEventListener(ADMIN_AUTH_REQUIRED_EVENT, listener)
  })

  it("signals an expired session only for protected requests", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ code: "UNAUTHENTICATED", message: "expired" }, 401))
    const listener = vi.fn()
    window.addEventListener(ADMIN_AUTH_REQUIRED_EVENT, listener)
    const client = createAdminApiClient({ fetcher })

    await expect(client.get("/content/nodes")).rejects.toMatchObject({ code: "AUTHENTICATION_REQUIRED" })
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener(ADMIN_AUTH_REQUIRED_EVENT, listener)
  })

  it("does not retry a mutation without an idempotency key", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ code: "INTERNAL_ERROR", message: "upstream" }, 503))
    const client = createAdminApiClient({ fetcher })

    await expect(client.post("/unsafe", { value: 1 })).rejects.toBeInstanceOf(AdminApiError)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("maps permission and request metadata without leaking an untyped backend error", () => {
    const error = parseAdminApiError({ code: "PERMISSION_DENIED", message: "Недостаточно прав", details: { capability: "canEditContent" }, requestId: "req-403" }, 403)

    expect(error).toBeInstanceOf(AdminApiError)
    expect(error.isPermissionDenied).toBe(true)
    expect(error.code).toBe("AUTHORIZATION_DENIED")
    expect(error.requestId).toBe("req-403")
    expect(error.details).toEqual({ capability: "canEditContent" })
    expect(parseAdminApiError({ code: "CMS_ROUTE_INVALID", message: "Маршрут некорректен" }, 409).code).toBe("CMS_ROUTE_INVALID")
  })
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "x-request-id": "req-server" } })
}
