export type CacheInvalidationEffect = Readonly<{
  mode: "database_epoch" | "external_tag_purge"
  providerCode: string
  providerRequestId: string | null
}>

export type CacheInvalidationRequest = Readonly<{
  idempotencyKey: string
  tags: readonly string[]
}>

/** Provider-neutral boundary. A cache/CDN provider is never an authority. */
export abstract class CacheInvalidationPort {
  abstract invalidate(input: CacheInvalidationRequest): Promise<CacheInvalidationEffect>
}
