import { describe, expect, it } from "vitest"

import { parseCorsOrigins, parseServerEnvironment } from "./index"

describe("parseServerEnvironment", () => {
  it("normalizes defaults and booleans in one boundary", () => {
    expect(parseServerEnvironment({ DATABASE_URL: "postgres://crm:crm@localhost:5432/crm" })).toMatchObject({
      API_PORT: 3000,
      APP_ENV: "development",
      RUN_MIGRATIONS: false,
    })
  })

  it("rejects a missing database URL", () => {
    expect(() => parseServerEnvironment({})).toThrow()
  })

  it("accepts an explicit allowlist for credentialed CRM and CMS origins", () => {
    const environment = parseServerEnvironment({
      DATABASE_URL: "postgres://crm:crm@localhost:5432/crm",
      CORS_ORIGIN: "http://localhost:5173, http://localhost:5174",
    })
    expect(parseCorsOrigins(environment.CORS_ORIGIN)).toEqual([
      "http://localhost:5173",
      "http://localhost:5174",
    ])
  })

  it("rejects paths and unsupported protocols in the CORS allowlist", () => {
    expect(() => parseServerEnvironment({ DATABASE_URL: "postgres://crm:crm@localhost:5432/crm", CORS_ORIGIN: "https://example.com/path" })).toThrow()
    expect(() => parseServerEnvironment({ DATABASE_URL: "postgres://crm:crm@localhost:5432/crm", CORS_ORIGIN: "javascript:alert(1)" })).toThrow()
  })
})
