export type OutboxDeliveryFailureClass = "retryable" | "permanent";

export type OutboxDeliveryFailureInput = Readonly<{
  code?: string | null;
  retryable?: boolean | null;
  httpStatus?: number | null;
}>;

export type OutboxRetryPolicy = Readonly<{
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}>;

export type OutboxRetryDecision = Readonly<{
  outcome: "retry" | "dead_letter";
  failureClass: OutboxDeliveryFailureClass;
  delayMs: number | null;
}>;

export const DEFAULT_OUTBOX_RETRY_POLICY: OutboxRetryPolicy = Object.freeze({
  maxAttempts: 8,
  baseDelayMs: 5_000,
  maxDelayMs: 900_000,
  jitterRatio: 0.2,
});

const PERMANENT_CODES = new Set([
  "DELIVERY_PAYLOAD_INVALID",
  "DELIVERY_MALFORMED",
  "DELIVERY_CONSUMER_UNSUPPORTED",
  "DELIVERY_UNSUPPORTED",
  "DELIVERY_PERMISSION_DENIED",
  "DELIVERY_PROJECTION_MISMATCH",
  "DELIVERY_EVENT_MISMATCH",
  "DELIVERY_TAGS_MISMATCH",
]);

/** Classifies only safe machine codes/statuses; never accepts an error message. */
export function classifyOutboxDeliveryFailure(input: OutboxDeliveryFailureInput): OutboxDeliveryFailureClass {
  if (input.code && PERMANENT_CODES.has(input.code)) return "permanent";
  if (input.retryable === false) return "permanent";
  if (input.retryable === true) return "retryable";
  const status = input.httpStatus;
  if (status !== null && status !== undefined && Number.isInteger(status) && status >= 400 && status < 500 && status !== 408 && status !== 409 && status !== 425 && status !== 429) {
    return "permanent";
  }
  return "retryable";
}

/**
 * Pure, deterministic retry decision. `jitterSeed` makes tests and persisted
 * schedules reproducible while avoiding retry herds across deliveries.
 */
export function decideOutboxRetry(input: Readonly<{
  attempts: number;
  policy?: OutboxRetryPolicy;
  failure: OutboxDeliveryFailureInput;
  jitterSeed: string;
}>): OutboxRetryDecision {
  const policy = input.policy ?? DEFAULT_OUTBOX_RETRY_POLICY;
  validatePolicy(policy);
  if (!Number.isInteger(input.attempts) || input.attempts <= 0) throw new RangeError("attempts must be a positive integer");
  const failureClass = classifyOutboxDeliveryFailure(input.failure);
  if (failureClass === "permanent" || input.attempts >= policy.maxAttempts) {
    return { outcome: "dead_letter", failureClass, delayMs: null };
  }
  const exponential = Math.min(policy.maxDelayMs, policy.baseDelayMs * (2 ** (input.attempts - 1)));
  const jitter = stableUnit(input.jitterSeed) * policy.jitterRatio;
  const delayMs = Math.max(0, Math.min(policy.maxDelayMs, Math.round(exponential * (1 + jitter))));
  return { outcome: "retry", failureClass, delayMs };
}

function validatePolicy(policy: OutboxRetryPolicy): void {
  if (!Number.isInteger(policy.maxAttempts) || policy.maxAttempts <= 0 || policy.maxAttempts > 100) throw new RangeError("maxAttempts must be between 1 and 100");
  if (!Number.isFinite(policy.baseDelayMs) || policy.baseDelayMs < 0) throw new RangeError("baseDelayMs must be non-negative");
  if (!Number.isFinite(policy.maxDelayMs) || policy.maxDelayMs < policy.baseDelayMs) throw new RangeError("maxDelayMs must be at least baseDelayMs");
  if (!Number.isFinite(policy.jitterRatio) || policy.jitterRatio < 0 || policy.jitterRatio > 0.2) throw new RangeError("jitterRatio must be between 0 and 0.2");
}

function stableUnit(seed: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) / 4_294_967_296;
}
