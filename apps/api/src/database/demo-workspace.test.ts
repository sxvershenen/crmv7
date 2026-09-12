import { describe, expect, it, vi } from "vitest"
import type { DataSource } from "typeorm"
import { BusinessCalendarEntity, UserEntity } from "@crm/db"
import { assertDemoEnvironment, demoId, DEMO_NAMESPACE, seedDemoWorkspace } from "./demo-workspace.js"

const environment = { APP_ENV: "development", DATABASE_URL: "postgres://demo:secret@localhost:5433/crm_v7" }
describe("local additive demo seed", () => {
  it("accepts only explicit local development targets", () => {
    expect(assertDemoEnvironment(environment)).toEqual({ host: "localhost", database: "crm_v7" })
    for (const invalid of [
      { ...environment, APP_ENV: undefined }, { ...environment, APP_ENV: "production" }, { ...environment, NODE_ENV: "production" },
      { ...environment, DATABASE_URL: "postgres://demo:secret@db.example.com/crm_v7" },
      { ...environment, DATABASE_URL: "postgres://demo:secret@localhost/crm_prod" },
      { ...environment, DATABASE_URL: "postgres://demo:secret@localhost/crm_v7?host=remote" },
      { ...environment, DATABASE_URL: "not-a-url" },
    ]) expect(() => assertDemoEnvironment(invalid)).toThrow()
  })
  it("uses stable separate operation IDs", () => {
    expect(demoId("customer")).toBe(demoId("customer"))
    expect(demoId("customer")).not.toBe(demoId("booking"))
    expect(demoId("customer")).toMatch(/^[a-f0-9-]{36}$/)
  })
  it("replays only the completion marker and never updates user-edited demo rows", async () => {
    const report = { namespace: DEMO_NAMESPACE, anchorDate: "2026-09-12T00:00:00.000Z", counts: { customers: 4 }, ids: { customers: [demoId("customer")] } }
    const manager = { query: vi.fn().mockResolvedValue([{ acquired: true }]), findOneBy: vi.fn().mockResolvedValue({ entityType: "demo_workspace", changes: report }), insert: vi.fn(), save: vi.fn() }
    const ds = {
      options: { synchronize: false, migrationsRun: false },
      query: vi.fn().mockResolvedValue([{ database: "crm_v7", address: "172.21.0.2/32" }]), showMigrations: vi.fn().mockResolvedValue(false),
      getRepository: vi.fn((entity) => entity === UserEntity ? { findOne: async () => ({ id: demoId("actor") }) } : entity === BusinessCalendarEntity ? { find: async () => [{ id: demoId("calendar") }] } : undefined),
      transaction: vi.fn(async (_isolation, callback) => callback(manager)),
    }
    expect(await seedDemoWorkspace(ds as unknown as DataSource, environment, { now: new Date("2027-01-01") })).toEqual({ status: "unchanged", report })
    expect(manager.insert).not.toHaveBeenCalled()
    expect(manager.save).not.toHaveBeenCalled()
    expect(ds.getRepository).toHaveBeenCalledTimes(2)
  })
  it("does not even query a database for production", async () => {
    const query = vi.fn()
    await expect(seedDemoWorkspace({ query } as unknown as DataSource, { ...environment, APP_ENV: "production" })).rejects.toThrow("development")
    expect(query).not.toHaveBeenCalled()
  })
})
