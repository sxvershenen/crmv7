import { describe, expect, it, vi } from "vitest"

import { AnalyticsIdentityService, ANALYTICS_SESSION_COOKIE, ANALYTICS_VISITOR_COOKIE } from "./analytics-identity.service.js"

function config() {
  return { get: vi.fn((key: string, fallback?: unknown) => key === "ANALYTICS_COOKIE_SIGNING_SECRET" ? "analytics-cookie-secret-0000000000000001" : fallback) }
}

function response() {
  return { cookie: vi.fn(), clearCookie: vi.fn() }
}

describe("AnalyticsIdentityService", () => {
  it("issues opaque signed visitor and session cookies and refreshes the session", () => {
    const service = new AnalyticsIdentityService(config() as never)
    const firstResponse = response()
    const first = service.issue({ cookies: {} } as never, firstResponse as never, 1_000)
    expect(first.visitorId).toMatch(/^[0-9a-f-]{36}$/)
    expect(first.sessionId).toMatch(/^[0-9a-f-]{36}$/)
    expect(firstResponse.cookie).toHaveBeenCalledWith(ANALYTICS_VISITOR_COOKIE, expect.stringContaining("."), expect.objectContaining({ httpOnly: true, sameSite: "lax" }))
    expect(firstResponse.cookie).toHaveBeenCalledWith(ANALYTICS_SESSION_COOKIE, expect.stringContaining("."), expect.objectContaining({ httpOnly: true, sameSite: "lax" }))

    const cookies = Object.fromEntries(firstResponse.cookie.mock.calls.map(([name, value]) => [name, value]))
    const second = service.issue({ cookies } as never, response() as never, 2_000)
    expect(second.visitorId).toBe(first.visitorId)
    expect(second.sessionId).toBe(first.sessionId)
  })

  it("replaces a tampered cookie instead of trusting client identity", () => {
    const service = new AnalyticsIdentityService(config() as never)
    const result = service.issue({ cookies: { [ANALYTICS_VISITOR_COOKIE]: "tampered", [ANALYTICS_SESSION_COOKIE]: "tampered" } } as never, response() as never, 1_000)
    expect(result.visitorId).toMatch(/^[0-9a-f-]{36}$/)
    expect(result.sessionId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it("expires both identity cookies when analytics consent is revoked", () => {
    const service = new AnalyticsIdentityService(config() as never)
    const result = response()
    service.clear(result as never)
    expect(result.clearCookie).toHaveBeenNthCalledWith(1, ANALYTICS_VISITOR_COOKIE, expect.objectContaining({ path: "/", httpOnly: true }))
    expect(result.clearCookie).toHaveBeenNthCalledWith(2, ANALYTICS_SESSION_COOKIE, expect.objectContaining({ path: "/", httpOnly: true }))
  })
})
