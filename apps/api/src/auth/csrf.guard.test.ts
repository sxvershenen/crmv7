import { describe, expect, it } from "vitest"

import { CsrfGuard } from "./csrf.guard.js"

function context(method: string, headers: Record<string, string | undefined>) {
  const request = { method, header: (name: string) => headers[name] }
  return { switchToHttp: () => ({ getRequest: () => request }) } as never
}

describe("CsrfGuard", () => {
  const guard = new CsrfGuard({
    getOrThrow: () => "http://localhost:5173,http://localhost:5174",
  } as never)

  it("allows unsafe requests from every explicitly trusted application origin", () => {
    expect(guard.canActivate(context("POST", { origin: "http://localhost:5174", "sec-fetch-site": "same-site" }))).toBe(true)
    expect(guard.canActivate(context("PATCH", { origin: "http://localhost:5173", "sec-fetch-site": "same-site" }))).toBe(true)
  })

  it("rejects an origin outside the allowlist", () => {
    expect(() => guard.canActivate(context("POST", { origin: "https://attacker.example", "sec-fetch-site": "cross-site" }))).toThrowError()
  })

  it("keeps safe requests origin-independent", () => {
    expect(guard.canActivate(context("GET", { origin: "https://attacker.example", "sec-fetch-site": "cross-site" }))).toBe(true)
  })

  it("lets explicitly public signed endpoints bypass cookie-oriented CSRF checks", () => {
    const publicGuard = new CsrfGuard({ getOrThrow: () => "http://localhost:5173" } as never, { getAllAndOverride: () => true } as never)
    const request = { method: "PUT", header: (name: string) => ({ origin: "https://storage.example", "sec-fetch-site": "cross-site" })[name as "origin" | "sec-fetch-site"] }
    const execution = { switchToHttp: () => ({ getRequest: () => request }), getHandler: () => function upload() {}, getClass: () => class MediaController {} }
    expect(publicGuard.canActivate(execution as never)).toBe(true)
  })
})
