export type DomainErrorCode =
  | "INVALID_INTERVAL" | "INVALID_MONEY" | "CURRENCY_MISMATCH" | "INVALID_STATE_TRANSITION"
  | "CAPACITY_EXCEEDED" | "PERMISSION_DENIED" | "INVALID_IDEMPOTENCY_INPUT"
  | "IDEMPOTENCY_CONFLICT" | "PAYMENT_IMMUTABLE" | "PAYMENT_INVALID";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: DomainErrorCode, message: string, options: {
    fieldErrors?: Record<string, readonly string[]>;
    details?: Record<string, unknown>;
  } = {}) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.fieldErrors = options.fieldErrors ?? {};
    this.details = options.details ?? {};
  }
}

export function assertDomain(condition: unknown, code: DomainErrorCode, message: string): asserts condition {
  if (!condition) throw new DomainError(code, message);
}
