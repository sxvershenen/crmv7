import { assertSafeTestDatabaseEnvironment } from "@crm/db"

process.env.APP_ENV = "test"
const target = assertSafeTestDatabaseEnvironment(process.env)
process.env.DATABASE_URL = target.url
process.env.CORS_ORIGIN = "http://localhost:5173"
process.env.LOG_LEVEL = "silent"
process.env.RUN_MIGRATIONS = "false"
