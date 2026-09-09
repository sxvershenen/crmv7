import { Injectable } from "@nestjs/common"

import {
  type CacheInvalidationEffect,
  type CacheInvalidationRequest,
  CacheInvalidationPort,
} from "./cache-invalidation.port.js"

/**
 * The durable receipt + monotonic generation in PostgreSQL is the cache epoch.
 * This adapter deliberately has no network side effect: a CDN/provider can be
 * added later without becoming an authority or weakening exactly-once receipts.
 */
@Injectable()
export class DatabaseEpochCacheInvalidationAdapter extends CacheInvalidationPort {
  async invalidate(input: CacheInvalidationRequest): Promise<CacheInvalidationEffect> {
    if (!input.idempotencyKey || (input.tags.length !== 2 && input.tags.length !== 3)
      || !input.tags[0]?.startsWith("public-offering:")
      || (input.tags.length === 3 && (!input.tags[1]?.startsWith("public-offering-kind:") || input.tags[2] !== "public-offering-collection"))
      || (input.tags.length === 2 && input.tags[1] !== "public-offering-collection")) {
      throw new Error("DATABASE_EPOCH_INVALIDATION_INPUT")
    }
    return { mode: "database_epoch", providerCode: "DATABASE_EPOCH", providerRequestId: null }
  }
}
