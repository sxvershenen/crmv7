type Queryable = {
  query(query: string): Promise<unknown>
}

export type SafeTestDatabaseTarget = {
  databaseName: string
  url: string
}

const DISPOSABLE_DATABASE_NAME = /_test_[a-z0-9_]{6,}$/
const DEDICATED_TEST_ROLE = /_test(?:_|$)/

function parseDatabaseName(rawUrl: string): string {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL")
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("TEST_DATABASE_URL must use the postgres or postgresql protocol")
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""))
  if (!databaseName || databaseName.includes("/")) {
    throw new Error("TEST_DATABASE_URL must select exactly one database")
  }
  return databaseName
}

/**
 * Fail closed before any test process connects to a database. A fixed
 * `*_test` database is deliberately insufficient: every destructive run must
 * receive an explicitly-created disposable target such as `crm_v7_test_a1b2c3`.
 */
export function assertSafeTestDatabaseEnvironment(environment: NodeJS.ProcessEnv): SafeTestDatabaseTarget {
  if (environment.APP_ENV !== "test") throw new Error("Destructive database tests require APP_ENV=test")
  const testDatabaseUrl = environment.TEST_DATABASE_URL
  if (!testDatabaseUrl) throw new Error("Destructive database tests require an explicit TEST_DATABASE_URL")
  if (environment.DATABASE_URL && environment.DATABASE_URL !== testDatabaseUrl) {
    throw new Error("DATABASE_URL must exactly match TEST_DATABASE_URL for destructive database tests")
  }
  const databaseName = parseDatabaseName(testDatabaseUrl)
  if (!DISPOSABLE_DATABASE_NAME.test(databaseName)) {
    throw new Error("Test database name must end with _test_<unique-run-id> (at least 6 lowercase letters, digits, or underscores)")
  }
  return { databaseName, url: testDatabaseUrl }
}

type RoleSafetyRow = {
  databaseName: string
  userName: string
  isSuperuser: boolean
  canCreateDatabase: boolean
  canCreateRole: boolean
  canReplicate: boolean
  canBypassRowSecurity: boolean
}

/** Re-check the connected target and role immediately before destructive SQL. */
export async function assertSafeTestDatabaseConnection(connection: Queryable, expected: SafeTestDatabaseTarget): Promise<void> {
  const result = await connection.query(`
    SELECT current_database() AS "databaseName", current_user AS "userName",
      rol.rolsuper AS "isSuperuser", rol.rolcreatedb AS "canCreateDatabase",
      rol.rolcreaterole AS "canCreateRole", rol.rolreplication AS "canReplicate",
      rol.rolbypassrls AS "canBypassRowSecurity"
    FROM pg_roles rol
    WHERE rol.rolname = current_user
  `)
  const rows = Array.isArray(result) ? result : []
  const row = rows[0] as RoleSafetyRow | undefined
  if (!row || row.databaseName !== expected.databaseName) {
    throw new Error("Connected database does not match the validated disposable test target")
  }
  if (!DEDICATED_TEST_ROLE.test(row.userName)) {
    throw new Error(`Database test role ${row.userName} is not a dedicated *_test role`)
  }
  if (row.isSuperuser || row.canCreateDatabase || row.canCreateRole || row.canReplicate || row.canBypassRowSecurity) {
    throw new Error(`Database test role ${row.userName} has elevated cluster privileges; use a restricted disposable-test role`)
  }
}
