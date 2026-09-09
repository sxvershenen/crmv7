import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common"

import { OfferingEditorApplicationService } from "./offering-editor-application.service.js"

@Injectable()
export class PriceBookActivationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PriceBookActivationWorker.name)
  private timer: ReturnType<typeof setInterval> | undefined
  private running = false

  constructor(@Inject(OfferingEditorApplicationService) private readonly offerings: OfferingEditorApplicationService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), 15_000)
    this.timer.unref()
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  async tick() {
    if (this.running) return 0
    this.running = true
    try {
      return await this.offerings.activateDueScheduled(25)
    } catch (error) {
      this.logger.warn(`Scheduled price-book activation will retry: ${error instanceof Error ? error.message : "unknown error"}`)
      return 0
    } finally {
      this.running = false
    }
  }
}
