import { describe, expect, it } from "vitest"

import { parseServerEnvironment } from "./index"

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
})
