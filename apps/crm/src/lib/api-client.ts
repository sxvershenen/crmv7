import { ApiErrorSchema, type ApiError } from "@crm/contracts/errors"
import type { z } from "zod"

const defaultBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api/internal/v1"

export type ApiClientOptions = {
  baseUrl?: string
  fetcher?: typeof fetch
}

export type ApiRequestInit = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown
  headers?: HeadersInit
}

export type ApiResponse<T> = {
  data: T
  headers: Headers
  status: number
}

export class ApiClientError extends Error {
  readonly apiError: ApiError
  readonly rawCode: string | undefined
  readonly status: number

  constructor(apiError: ApiError, status: number, rawCode?: string) {
    super(apiError.message)
    this.name = "ApiClientError"
    this.apiError = apiError
    this.rawCode = rawCode
    this.status = status
  }

  get code() {
    return this.apiError.code
  }

  get details() {
    return this.apiError.details
  }

  get requestId() {
    return this.apiError.requestId
  }

  get fieldErrors() {
    return this.apiError.fieldErrors
  }

  get isConflict() {
    return this.status === 409 || ["CONFLICT", "RESOURCE_CONFLICT", "STALE_VERSION"].includes(this.code)
  }
}

const canonicalCode: Record<string, ApiError["code"]> = {
  UNAUTHENTICATED: "AUTHENTICATION_REQUIRED",
  AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED",
  PERMISSION_DENIED: "AUTHORIZATION_DENIED",
  AUTHORIZATION_DENIED: "AUTHORIZATION_DENIED",
  NOT_FOUND: "NOT_FOUND",
  TASK_NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  RESOURCE_CONFLICT: "RESOURCE_CONFLICT",
  VERSION_CONFLICT: "STALE_VERSION",
  STALE_VERSION: "STALE_VERSION",
  DUPLICATE: "CONFLICT",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  INVALID_STATE_TRANSITION: "INVALID_STATE_TRANSITION",
  CAPACITY_EXCEEDED: "CAPACITY_EXCEEDED",
  PAYMENT_INVALID: "PAYMENT_INVALID",
  PAYMENT_IMMUTABLE: "PAYMENT_IMMUTABLE",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
}

function requestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return `crm-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function parseApiError(payload: unknown, status: number, responseRequestId?: string | null) {
  const candidate = payload && typeof payload === "object" ? payload as Record<string, unknown> : {}
  const rawCode = typeof candidate.code === "string" ? candidate.code : undefined
  const normalized = {
    code: canonicalCode[rawCode ?? ""] ?? "INTERNAL_ERROR",
    message: typeof candidate.message === "string" && candidate.message.length > 0 ? candidate.message : `Запрос завершился ошибкой (${status}).`,
    fieldErrors: candidate.fieldErrors,
    details: candidate.details,
    requestId: typeof candidate.requestId === "string" ? candidate.requestId : responseRequestId ?? undefined,
  }
  const parsed = ApiErrorSchema.safeParse(normalized)
  const apiError = parsed.success ? parsed.data : {
    code: "INTERNAL_ERROR" as const,
    message: normalized.message,
    details: {},
    ...(normalized.requestId ? { requestId: normalized.requestId } : {}),
  }
  return new ApiClientError(apiError, status, rawCode)
}

export function createApiClient({ baseUrl = defaultBaseUrl, fetcher = fetch }: ApiClientOptions = {}) {
  async function requestWithMeta<T>(path: string, init: ApiRequestInit = {}, schema?: z.ZodType<T>): Promise<ApiResponse<T>> {
    const headers = new Headers(init.headers)
    const { body, ...requestOptions } = init
    headers.set("accept", "application/json")
    headers.set("x-request-id", headers.get("x-request-id") ?? requestId())
    if (body !== undefined) headers.set("content-type", "application/json")

    const requestInit: RequestInit = {
      ...requestOptions,
      credentials: "include",
      headers,
    }
    if (body !== undefined) requestInit.body = JSON.stringify(body)
    const response = await fetcher(`${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`, requestInit)
    const responseRequestId = response.headers.get("x-request-id")
    let payload: unknown = null
    if (response.status !== 204) {
      try {
        payload = await response.json()
      } catch {
        payload = null
      }
    }
    if (!response.ok) throw parseApiError(payload, response.status, responseRequestId)
    if (!schema) return { data: payload as T, headers: response.headers, status: response.status }
    const parsed = schema.safeParse(payload)
    if (!parsed.success) {
      throw parseApiError({ code: "INTERNAL_ERROR", message: "Ответ API не соответствует контракту.", details: { issues: parsed.error.issues } }, response.status, responseRequestId)
    }
    return { data: parsed.data, headers: response.headers, status: response.status }
  }

  async function request<T>(path: string, init: ApiRequestInit = {}, schema?: z.ZodType<T>): Promise<T> {
    return (await requestWithMeta(path, init, schema)).data
  }

  return {
    delete: <T>(path: string, init?: ApiRequestInit, schema?: z.ZodType<T>) => request<T>(path, { ...init, method: "DELETE" }, schema),
    get: <T>(path: string, schema?: z.ZodType<T>, init?: ApiRequestInit) => request<T>(path, { ...init, method: "GET" }, schema),
    getWithMeta: <T>(path: string, schema?: z.ZodType<T>, init?: ApiRequestInit) => requestWithMeta<T>(path, { ...init, method: "GET" }, schema),
    patch: <T>(path: string, body: unknown, schema?: z.ZodType<T>, init?: ApiRequestInit) => request<T>(path, { ...init, body, method: "PATCH" }, schema),
    post: <T>(path: string, body?: unknown, schema?: z.ZodType<T>, init?: ApiRequestInit) => request<T>(path, { ...init, body, method: "POST" }, schema),
    request,
    requestWithMeta,
  }
}

export const apiClient = createApiClient()
