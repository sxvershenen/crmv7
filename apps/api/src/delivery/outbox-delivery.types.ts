export const OUTBOX_CONSUMERS = {
  sse: "sse",
  publicProjection: "public_projection",
} as const

export type OutboxConsumerName = (typeof OUTBOX_CONSUMERS)[keyof typeof OUTBOX_CONSUMERS]

/** A fenced lease. A late worker can never finalize a subsequent lease. */
export type ClaimedOutboxDelivery = Readonly<{
  eventId: string
  consumer: OutboxConsumerName
  topic: string
  aggregateType: string
  aggregateId: string
  payload: Record<string, unknown>
  deliveryEpoch: number
  attempt: number
  maxAttempts: number
  leaseToken: string
}>

export class PermanentDeliveryError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = "PermanentDeliveryError"
  }
}

export function deliveryErrorCode(error: unknown): string {
  if (error instanceof PermanentDeliveryError) return error.code
  return "DELIVERY_HANDLER_FAILED"
}

export function isRetryableDeliveryError(error: unknown): boolean {
  return !(error instanceof PermanentDeliveryError)
}
