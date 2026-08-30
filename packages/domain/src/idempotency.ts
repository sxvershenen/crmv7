import { DomainError } from "./errors.js";

export interface IdempotencyInput { readonly operationId: string; readonly idempotencyKey: string; readonly expectedVersion: number; }
export interface StoredOperation extends IdempotencyInput { readonly fingerprint: string; }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const key = /^[A-Za-z0-9._~-]{16,255}$/;

export function validateIdempotencyInput(input: IdempotencyInput): IdempotencyInput {
  if (!uuid.test(input.operationId) || !key.test(input.idempotencyKey) || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion <= 0) {
    throw new DomainError("INVALID_IDEMPOTENCY_INPUT", "operationId, idempotencyKey and expectedVersion are invalid", { fieldErrors: { operationId: ["Must be a UUID"], idempotencyKey: ["Must be 16–255 URL-safe characters"], expectedVersion: ["Must be a positive safe integer"] } });
  }
  return { ...input };
}

export function assertIdempotentReplay(stored: StoredOperation, incoming: IdempotencyInput & { fingerprint: string }): void {
  validateIdempotencyInput(incoming);
  if ((stored.idempotencyKey === incoming.idempotencyKey || stored.operationId === incoming.operationId) && stored.fingerprint !== incoming.fingerprint) {
    throw new DomainError("IDEMPOTENCY_CONFLICT", "Idempotency key or operationId was already used for another operation");
  }
}
