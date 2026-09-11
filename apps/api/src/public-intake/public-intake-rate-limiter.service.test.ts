import { describe, expect, it, vi } from "vitest"

import { PublicIntakeRateLimiter } from "./public-intake-rate-limiter.service.js"

const config = (limit = 2) => ({
  get: vi.fn((key: string, fallback?: unknown) => ({
    PUBLIC_INTAKE_RATE_LIMIT_MAX: limit,
    PUBLIC_INTAKE_RATE_LIMIT_WINDOW_SECONDS: 60,
    PUBLIC_INTAKE_RATE_LIMIT_HMAC_SECRET: "unit-test-public-intake-hmac-secret-0001",
  } as Record<string, unknown>)[key] ?? fallback),
})

describe("PublicIntakeRateLimiter", () => {
  it("stores a one-way identifier instead of a raw address", async () => {
    const query = vi.fn().mockResolvedValue([{ request_count: 1 }])
    const limiter = new PublicIntakeRateLimiter({ query } as never, config() as never)
    await limiter.consume("::ffff:127.0.0.1")
    expect(query.mock.calls[0]?.[1]?.[0]).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(query.mock.calls)).not.toContain("127.0.0.1")
  })

  it("rejects over-limit requests and fails closed when storage is unavailable", async () => {
    const limited = new PublicIntakeRateLimiter({ query: vi.fn().mockResolvedValue([{ request_count: 3 }]) } as never, config() as never)
    await expect(limited.consume("127.0.0.1")).rejects.toMatchObject({ status: 429 })

    const unavailable = new PublicIntakeRateLimiter({ query: vi.fn().mockRejectedValue(new Error("database unavailable")) } as never, config() as never)
    await expect(unavailable.consume("127.0.0.1")).rejects.toMatchObject({ status: 503 })
    await expect(unavailable.consume("not-an-ip")).rejects.toMatchObject({ status: 503 })
  })
})
