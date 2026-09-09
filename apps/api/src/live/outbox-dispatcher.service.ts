import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common"

import { OutboxDeliveryEngine } from "../delivery/outbox-delivery.engine.js"
import { PublicOfferingProjectionConsumer } from "../delivery/public-offering-projection.consumer.js"
import { LiveService } from "./live.service.js"

@Injectable()
export class OutboxDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcherService.name)
  private timer: ReturnType<typeof setInterval> | undefined
  private running = false

  constructor(
    @Inject(LiveService) private readonly live: LiveService,
    @Inject(OutboxDeliveryEngine) private readonly delivery: OutboxDeliveryEngine,
    @Inject(PublicOfferingProjectionConsumer) private readonly publicProjection: PublicOfferingProjectionConsumer,
  ) {}

  onModuleInit() {
    // Integration tests drive batches explicitly. A background tick can race
    // assertions or TRUNCATE between sequential cases and make the suite flaky.
    if (process.env.APP_ENV === "test") return
    this.timer = setInterval(() => void this.dispatchBatch(), 1_000)
    this.timer.unref()
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  async dispatchBatch() {
    if (this.running) return 0
    this.running = true
    try {
      const sse = await this.delivery.dispatch("sse", async (claim) => {
        const payload = claim.payload
        this.live.publish({
          entityType: claim.aggregateType,
          entityId: String(payload.taskId ?? payload.code ?? claim.aggregateId),
          event: claim.topic,
          version: typeof payload.version === "number" ? payload.version
            : typeof payload.pricingVersion === "number" ? payload.pricingVersion
              : 1,
        })
      })
      const projection = await this.delivery.dispatch(
        "public_projection",
        (claim) => this.publicProjection.consume(claim),
      )
      return sse + projection
    } catch (error) {
      this.logger.error(error, "Outbox dispatch batch failed")
      return 0
    } finally {
      this.running = false
    }
  }
}
