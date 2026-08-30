import { z } from "zod";

export const ErrorCodeSchema = z.enum([
  "VALIDATION_ERROR", "AUTHENTICATION_REQUIRED", "AUTHORIZATION_DENIED", "NOT_FOUND",
  "CONFLICT", "RESOURCE_CONFLICT", "STALE_VERSION", "IDEMPOTENCY_CONFLICT",
  "INVALID_STATE_TRANSITION", "CAPACITY_EXCEEDED", "PAYMENT_INVALID", "PAYMENT_IMMUTABLE",
  "RATE_LIMITED", "INTERNAL_ERROR",
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const FieldErrorsSchema = z.record(z.string().min(1), z.array(z.string().min(1)));
export type FieldErrors = z.infer<typeof FieldErrorsSchema>;

export const ApiErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string().min(1),
  fieldErrors: FieldErrorsSchema.optional(),
  details: z.record(z.string(), z.unknown()).default({}),
  requestId: z.string().min(1).optional(),
}).strict();
export type ApiError = z.infer<typeof ApiErrorSchema>;

export function toApiError(error: unknown, fallback: Pick<ApiError, "code" | "message"> = {
  code: "INTERNAL_ERROR", message: "Внутренняя ошибка",
}): ApiError {
  const parsed = ApiErrorSchema.safeParse(error);
  if (parsed.success) return parsed.data;
  return { ...fallback, details: {} };
}
