import { ApiErrorSchema, type ApiError } from "@crm/contracts/errors"

type Parser<T> = { safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: unknown[] } } }
type RequestOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown
  headers?: HeadersInit
  retry?: "safe" | "idempotent"
  suppressAuthEvent?: boolean
}

export class AdminApiError extends Error {
  constructor(readonly apiError: ApiError, readonly status: number, readonly rawCode?: string) { super(apiError.message); this.name = "AdminApiError" }
  get code() { return this.apiError.code }
  get details() { return this.apiError.details }
  get fieldErrors() { return this.apiError.fieldErrors }
  get requestId() { return this.apiError.requestId }
  get isConflict() { return this.status === 409 || this.rawCode === "VERSION_CONFLICT" }
  get isPermissionDenied() { return this.status === 403 || this.rawCode === "PERMISSION_DENIED" }
}

export const ADMIN_AUTH_REQUIRED_EVENT = "admin:authentication-required"

export type AdminApiClient = ReturnType<typeof createAdminApiClient>

export function createAdminApiClient({ baseUrl = import.meta.env.VITE_ADMIN_API_BASE_URL ?? "/api/admin/v1", fetcher }: { baseUrl?: string; fetcher?: typeof fetch } = {}) {
  async function request<T>(path: string, options: RequestOptions = {}, parser?: Parser<T>): Promise<T> {
    const headers = new Headers(options.headers)
    const requestId = headers.get("x-request-id") ?? createRequestId()
    headers.set("accept", "application/json")
    headers.set("x-request-id", requestId)
    if (options.body !== undefined) headers.set("content-type", "application/json")
    const { body, retry, suppressAuthEvent, ...init } = options
    const requestInit: RequestInit = { ...init, credentials: "include", headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }
    const attempts = retry ? 2 : 1
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await (fetcher ?? globalThis.fetch)(`${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`, requestInit)
        const payload = response.status === 204 ? null : await readJson(response)
        if (!response.ok) {
          const error = parseAdminApiError(payload, response.status, response.headers.get("x-request-id"))
          if (attempt + 1 < attempts && [502, 503, 504].includes(response.status)) continue
          if (response.status === 401 && !suppressAuthEvent && typeof window !== "undefined") window.dispatchEvent(new Event(ADMIN_AUTH_REQUIRED_EVENT))
          throw error
        }
        if (!parser) return payload as T
        const parsed = parser.safeParse(payload)
        if (!parsed.success) throw parseAdminApiError({ code: "INTERNAL_ERROR", message: "Ответ CMS API не соответствует контракту", details: { issues: parsed.error.issues } }, 502, response.headers.get("x-request-id"))
        return parsed.data
      } catch (error) {
        if (error instanceof AdminApiError) throw error
        if (attempt + 1 >= attempts) break
      }
    }
    throw new AdminApiError({ code: "INTERNAL_ERROR", message: "CMS API недоступен. Проверьте соединение и повторите запрос.", details: {}, requestId }, 0)
  }
  return {
    get: <T>(path: string, parser?: Parser<T>) => request(path, { method: "GET", retry: "safe" }, parser),
    patch: <T>(path: string, body: unknown, parser?: Parser<T>) => request(path, { body, method: "PATCH", ...(hasIdempotencyKey(body) ? { retry: "idempotent" as const } : {}) }, parser),
    post: <T>(path: string, body: unknown, parser?: Parser<T>) => request(path, { body, method: "POST", ...(hasIdempotencyKey(body) ? { retry: "idempotent" as const } : {}) }, parser),
    put: <T>(path: string, body: unknown, parser?: Parser<T>) => request(path, { body, method: "PUT", ...(hasIdempotencyKey(body) ? { retry: "idempotent" as const } : {}) }, parser),
    authGet: <T>(path: string, parser?: Parser<T>) => request(path, { method: "GET", retry: "safe", suppressAuthEvent: true }, parser),
    authPost: <T>(path: string, body: unknown, parser?: Parser<T>) => request(path, { body, method: "POST", suppressAuthEvent: true }, parser),
  }
}

function hasIdempotencyKey(body: unknown) {
  return Boolean(body && typeof body === "object" && "idempotencyKey" in body && typeof (body as { idempotencyKey?: unknown }).idempotencyKey === "string")
}

export function parseAdminApiError(payload: unknown, status: number, responseRequestId?: string | null) {
  const candidate = payload && typeof payload === "object" ? payload as Record<string, unknown> : {}
  const rawCode = typeof candidate.code === "string" ? candidate.code : undefined
  const parsed = ApiErrorSchema.safeParse({
    code: canonicalCode(rawCode),
    message: typeof candidate.message === "string" && candidate.message ? candidate.message : `CMS API вернул ошибку ${status}`,
    fieldErrors: candidate.fieldErrors,
    details: candidate.details,
    requestId: typeof candidate.requestId === "string" ? candidate.requestId : responseRequestId ?? undefined,
  })
  const apiError: ApiError = parsed.success ? parsed.data : { code: "INTERNAL_ERROR", message: `CMS API вернул ошибку ${status}`, details: {}, ...(responseRequestId ? { requestId: responseRequestId } : {}) }
  return new AdminApiError(apiError, status, rawCode)
}

function canonicalCode(code?: string): ApiError["code"] {
  if (code === "UNAUTHENTICATED") return "AUTHENTICATION_REQUIRED"
  if (code === "PERMISSION_DENIED") return "AUTHORIZATION_DENIED"
  if (code === "VERSION_CONFLICT") return "STALE_VERSION"
  if (code === "CMS_NODE_NOT_FOUND") return "NOT_FOUND"
  const parsed = ApiErrorSchema.shape.code.safeParse(code)
  if (parsed.success) return parsed.data
  return "INTERNAL_ERROR"
}

function createRequestId() { return globalThis.crypto?.randomUUID?.() ?? `cms-${Date.now()}-${Math.random().toString(36).slice(2)}` }
async function readJson(response: Response) { try { return await response.json() as unknown } catch { return null } }
