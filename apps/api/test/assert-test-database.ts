import { assertSafeTestDatabaseConnection, assertSafeTestDatabaseEnvironment } from "@crm/db"

const target = assertSafeTestDatabaseEnvironment(process.env)
const { default: dataSource } = await import("@crm/db/data-source")

try {
  await dataSource.initialize()
  await assertSafeTestDatabaseConnection(dataSource, target)
  console.log(`Validated disposable test database ${target.databaseName} with restricted credentials`)
} finally {
  if (dataSource.isInitialized) await dataSource.destroy()
}
