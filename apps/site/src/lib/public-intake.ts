import { PublicLeadIntakeResponseSchema, type PublicLeadIntake } from "@crm/contracts"

const defaultBaseUrl = "/api/public/v1"

export class PublicIntakeError extends Error {
  constructor(
    readonly code: string,
    readonly fieldErrors: Record<string, string[]> = {},
    readonly status = 0,
  ) {
    super("Public intake request failed")
    this.name = "PublicIntakeError"
  }
}

function baseUrl() {
  return (import.meta.env.PUBLIC_INTAKE_API_BASE_URL || defaultBaseUrl).replace(/\/$/u, "")
}

export async function submitPublicLead(input: PublicLeadIntake, request: typeof fetch = fetch) {
  let response: Response
  try {
    response = await request(`${baseUrl()}/intake/leads`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(input),
      credentials: "omit",
    })
  } catch {
    throw new PublicIntakeError("PUBLIC_INTAKE_UNAVAILABLE")
  }

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = body && typeof body === "object" ? body as { code?: unknown; fieldErrors?: unknown } : {}
    throw new PublicIntakeError(
      typeof error.code === "string" ? error.code : "PUBLIC_INTAKE_FAILED",
      error.fieldErrors && typeof error.fieldErrors === "object" ? error.fieldErrors as Record<string, string[]> : {},
      response.status,
    )
  }

  return PublicLeadIntakeResponseSchema.parse(body)
}

export function publicIntakeErrorMessage(error: unknown) {
  if (!(error instanceof PublicIntakeError)) return "Не удалось отправить заявку. Попробуйте ещё раз через минуту."
  if (error.code === "PUBLIC_INTAKE_RATE_LIMITED" || error.code === "RATE_LIMITED" || error.status === 429) return "Слишком много попыток. Попробуйте ещё раз через минуту."
  if (error.code === "PUBLIC_INTAKE_SPAM") return "Не удалось принять заявку. Проверьте форму и попробуйте ещё раз."
  if (error.code === "PUBLIC_INTAKE_UNAVAILABLE" || error.code === "INTAKE_PROTECTION_UNAVAILABLE" || error.status === 503) return "Сервис заявок временно недоступен. Попробуйте ещё раз через минуту."
  if (error.code === "IDEMPOTENCY_CONFLICT") return "Эта заявка уже отправляется. Обновите форму и попробуйте ещё раз."
  return "Не удалось отправить заявку. Проверьте данные и попробуйте ещё раз."
}
