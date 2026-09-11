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

  it("fails closed when production media infrastructure is incomplete", () => {
    expect(() => parseServerEnvironment({ APP_ENV: "production", DATABASE_URL: "postgres://crm:crm@localhost:5432/crm" })).toThrow(/Production media storage|external scanner|CDN/i)
  })

  it("accepts blank optional media values from a copied env example outside production", () => {
    expect(parseServerEnvironment({ DATABASE_URL: "postgres://crm:crm@localhost:5432/crm", MEDIA_STORAGE_BUCKET: "", MEDIA_CDN_BASE_URL: "", MEDIA_SCANNER_URL: "" })).toMatchObject({
      MEDIA_STORAGE_BUCKET: undefined, MEDIA_CDN_BASE_URL: undefined, MEDIA_SCANNER_URL: undefined,
    })
  })
})
