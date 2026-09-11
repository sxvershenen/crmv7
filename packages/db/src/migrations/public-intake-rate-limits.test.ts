import { describe, expect, it } from "vitest"

import { PublicIntakeRateLimits1788204800000 } from "./1788204800000-public-intake-rate-limits.js"

describe("PublicIntakeRateLimits migration", () => {
  it("stores only an HMAC identifier and bounded counter state", async () => {
    const statements: string[] = []
    await new PublicIntakeRateLimits1788204800000().up({ query: async (sql: string) => { statements.push(sql); return [] } } as never)
    const sql = statements.join("\n")
    expect(sql).toContain("identifier_hash text NOT NULL")
    expect(sql).toContain("PRIMARY KEY(identifier_hash, window_started_at)")
    expect(sql).toContain("public_intake_rate_limits_expiry_idx")
    expect(sql).not.toContain("ip_address")
    expect(sql).not.toContain("raw_ip")
  })
})
