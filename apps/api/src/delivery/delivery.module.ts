import { Module } from "@nestjs/common"

import { CacheInvalidationPort } from "./cache-invalidation.port.js"
import { DatabaseEpochCacheInvalidationAdapter } from "./database-epoch-cache-invalidation.adapter.js"
import { OutboxDeliveryEngine } from "./outbox-delivery.engine.js"
import { OutboxDeliveryStore } from "./outbox-delivery.store.js"
import { PublicOfferingProjectionConsumer } from "./public-offering-projection.consumer.js"

@Module({
  providers: [
    OutboxDeliveryStore,
    OutboxDeliveryEngine,
    PublicOfferingProjectionConsumer,
    DatabaseEpochCacheInvalidationAdapter,
    { provide: CacheInvalidationPort, useExisting: DatabaseEpochCacheInvalidationAdapter },
  ],
  exports: [OutboxDeliveryEngine, PublicOfferingProjectionConsumer],
})
export class DeliveryModule {}
