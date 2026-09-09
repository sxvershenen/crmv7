import { z } from "zod"

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true")

const corsOrigins = z.string().default("http://localhost:5173").superRefine((value, context) => {
  const origins = value.split(",").map((origin) => origin.trim()).filter(Boolean)
  if (origins.length === 0) {
    context.addIssue({ code: "custom", message: "At least one CORS origin is required" })
    return
  }
  for (const origin of origins) {
    try {
      const url = new URL(origin)
      if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin) throw new Error("invalid origin")
    } catch {
      context.addIssue({ code: "custom", message: `Invalid CORS origin: ${origin}` })
    }
  }
})

export const serverEnvironmentSchema = z.object({
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGIN: corsOrigins,
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  RUN_MIGRATIONS: booleanFromString,
  SESSION_COOKIE_NAME: z.string().min(1).default("sv_session"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(24 * 7),
  /** Optional until the preview worker/runtime secret has been provisioned. */
  CMS_PREVIEW_SIGNING_SECRET: z.string().min(32).optional(),
  /** Local is a development adapter; production may replace it behind the same media storage port. */
  MEDIA_STORAGE_DRIVER: z.enum(["local"]).default("local"),
  MEDIA_STORAGE_ROOT: z.string().min(1).default(".data/media"),
  MEDIA_UPLOAD_SIGNING_SECRET: z.string().min(32).optional(),
  MEDIA_MAX_DECODED_PIXELS: z.coerce.number().int().min(1_000_000).max(400_000_000).default(80_000_000),
})

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>

export function parseServerEnvironment(source: NodeJS.ProcessEnv): ServerEnvironment {
  return serverEnvironmentSchema.parse(source)
}

/** Parse the validated, comma-separated trusted browser origins without changing the legacy env key. */
export function parseCorsOrigins(value: string): string[] {
  return value.split(",").map((origin) => origin.trim()).filter(Boolean)
}
