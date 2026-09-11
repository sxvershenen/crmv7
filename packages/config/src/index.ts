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

const optionalText = (schema = z.string().min(1)) => z.preprocess((value) => value === "" ? undefined : value, schema.optional())
const optionalUrl = () => z.preprocess((value) => value === "" ? undefined : value, z.string().url().optional())

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
  /** Number of trusted reverse-proxy hops before Express resolves req.ip. Keep 0 for direct traffic. */
  PUBLIC_INTAKE_TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(4).default(0),
  PUBLIC_INTAKE_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1_000).default(10),
  PUBLIC_INTAKE_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(10).max(86_400).default(60),
  PUBLIC_INTAKE_RATE_LIMIT_HMAC_SECRET: optionalText(z.string().min(32)),
  /** Optional until the preview worker/runtime secret has been provisioned. */
  CMS_PREVIEW_SIGNING_SECRET: optionalText(z.string().min(32)),
  /** Local is a development adapter; production must use the S3-compatible adapter. */
  MEDIA_STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  MEDIA_STORAGE_ROOT: z.string().min(1).default(".data/media"),
  MEDIA_STORAGE_BUCKET: optionalText(),
  MEDIA_STORAGE_REGION: z.string().min(1).default("us-east-1"),
  MEDIA_STORAGE_ENDPOINT: optionalUrl(),
  MEDIA_STORAGE_ACCESS_KEY_ID: optionalText(),
  MEDIA_STORAGE_SECRET_ACCESS_KEY: optionalText(),
  MEDIA_CDN_BASE_URL: optionalUrl(),
  MEDIA_UPLOAD_SIGNING_SECRET: optionalText(z.string().min(32)),
  MEDIA_MAX_DECODED_PIXELS: z.coerce.number().int().min(1_000_000).max(400_000_000).default(80_000_000),
  MEDIA_SCANNER_DRIVER: z.enum(["disabled", "http"]).default("disabled"),
  MEDIA_SCANNER_URL: optionalUrl(),
  MEDIA_SCANNER_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(5_000),
  MEDIA_PROCESSING_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  MEDIA_PROCESSING_RETRY_BASE_MS: z.coerce.number().int().min(100).max(3_600_000).default(30_000),
  MEDIA_PROCESSING_LEASE_MS: z.coerce.number().int().min(1_000).max(24 * 60 * 60_000).default(5 * 60_000),
  MEDIA_CLEANUP_GRACE_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(24),
  MEDIA_CLEANUP_INTERVAL_MS: z.coerce.number().int().min(60_000).max(7 * 24 * 60 * 60_000).default(60 * 60_000),
}).superRefine((environment, context) => {
  if (environment.APP_ENV !== "production") return
  if (environment.MEDIA_STORAGE_DRIVER !== "s3") context.addIssue({ code: "custom", path: ["MEDIA_STORAGE_DRIVER"], message: "Production media storage must use the S3-compatible adapter" })
  if (!environment.MEDIA_STORAGE_BUCKET) context.addIssue({ code: "custom", path: ["MEDIA_STORAGE_BUCKET"], message: "Production media storage requires a bucket" })
  if (environment.MEDIA_SCANNER_DRIVER !== "http") context.addIssue({ code: "custom", path: ["MEDIA_SCANNER_DRIVER"], message: "Production media uploads require an external scanner" })
  if (!environment.MEDIA_SCANNER_URL) context.addIssue({ code: "custom", path: ["MEDIA_SCANNER_URL"], message: "Production media uploads require a scanner URL" })
  if (!environment.MEDIA_CDN_BASE_URL) context.addIssue({ code: "custom", path: ["MEDIA_CDN_BASE_URL"], message: "Production media delivery requires a CDN base URL" })
  if (!environment.MEDIA_UPLOAD_SIGNING_SECRET) context.addIssue({ code: "custom", path: ["MEDIA_UPLOAD_SIGNING_SECRET"], message: "Production media uploads require a signing secret" })
  if (!environment.PUBLIC_INTAKE_RATE_LIMIT_HMAC_SECRET) context.addIssue({ code: "custom", path: ["PUBLIC_INTAKE_RATE_LIMIT_HMAC_SECRET"], message: "Production public intake requires a rate-limit HMAC secret" })
})

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>

export function parseServerEnvironment(source: NodeJS.ProcessEnv): ServerEnvironment {
  return serverEnvironmentSchema.parse(source)
}

/** Parse the validated, comma-separated trusted browser origins without changing the legacy env key. */
export function parseCorsOrigins(value: string): string[] {
  return value.split(",").map((origin) => origin.trim()).filter(Boolean)
}
