import { describe, expect, it, vi } from "vitest"

import { assertSafeTestDatabaseConnection, assertSafeTestDatabaseEnvironment } from "./test-database-safety.js"

const safeUrl = "postgresql://crm_test:secret@127.0.0.1:5432/crm_v7_test_a1b2c3"
const safeRole = {
  databaseName: "crm_v7_test_a1b2c3",
  userName: "crm_test",
  isSuperuser: false,
  canCreateDatabase: false,
  canCreateRole: false,
  canReplicate: false,
  canBypassRowSecurity: false,
}

describe("test database safety", () => {
  it("accepts an explicit disposable target", () => {
    expect(assertSafeTestDatabaseEnvironment({ APP_ENV: "test", TEST_DATABASE_URL: safeUrl, DATABASE_URL: safeUrl })).toEqual({
      databaseName: "crm_v7_test_a1b2c3",
      url: safeUrl,
    })
  })

  it.each([
    [{ APP_ENV: "development", TEST_DATABASE_URL: safeUrl }, "APP_ENV=test"],
    [{ APP_ENV: "test" }, "explicit TEST_DATABASE_URL"],
    [{ APP_ENV: "test", TEST_DATABASE_URL: "postgresql:///crm_v7_test" }, "unique-run-id"],
    [{ APP_ENV: "test", TEST_DATABASE_URL: safeUrl, DATABASE_URL: "postgresql:///crm_v7_dev" }, "exactly match"],
  ])("rejects an unsafe environment", (environment, message) => {
    expect(() => assertSafeTestDatabaseEnvironment(environment)).toThrow(message)
  })

  it("accepts the expected database and a restricted dedicated role", async () => {
    const query = vi.fn().mockResolvedValue([safeRole])
    await expect(assertSafeTestDatabaseConnection({ query }, { databaseName: safeRole.databaseName, url: safeUrl })).resolves.toBeUndefined()
    expect(query).toHaveBeenCalledOnce()
  })

  it("rejects a connection to a different database", async () => {
    const query = vi.fn().mockResolvedValue([{ ...safeRole, databaseName: "crm_v7_test_other1" }])
    await expect(assertSafeTestDatabaseConnection({ query }, { databaseName: safeRole.databaseName, url: safeUrl })).rejects.toThrow("does not match")
  })

  it("rejects a shared non-test role", async () => {
    const query = vi.fn().mockResolvedValue([{ ...safeRole, userName: "crm" }])
    await expect(assertSafeTestDatabaseConnection({ query }, { databaseName: safeRole.databaseName, url: safeUrl })).rejects.toThrow("dedicated *_test role")
  })

  it("rejects an elevated role", async () => {
    const query = vi.fn().mockResolvedValue([{ ...safeRole, userName: "postgres_test", isSuperuser: true }])
    await expect(assertSafeTestDatabaseConnection({ query }, { databaseName: safeRole.databaseName, url: safeUrl })).rejects.toThrow("elevated cluster privileges")
  })
})
