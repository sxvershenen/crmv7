import { z } from "zod"

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true")

export const serverEnvironmentSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGIN: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  RUN_MIGRATIONS: booleanFromString,
  SESSION_COOKIE_NAME: z.string().min(1).default("sv_session"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(24 * 7),
})

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>

export function parseServerEnvironment(source: NodeJS.ProcessEnv): ServerEnvironment {
  return serverEnvironmentSchema.parse(source)
}
