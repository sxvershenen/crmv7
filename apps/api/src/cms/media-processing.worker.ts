import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

import { MediaService } from "./media.service.js"

/** Lightweight DB-claim worker; safe to run in every API instance. */
@Injectable()
export class MediaProcessingWorker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null
  private lastCleanupAt = 0

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(MediaService) private readonly media: MediaService,
  ) {}

  onModuleInit() {
    if (this.config.get<string>("APP_ENV") === "test") return
    this.timer = setInterval(() => void this.tick(), 5_000)
    void this.tick()
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private async tick() {
    try {
      await this.media.processDueJobs()
      const interval = this.config.get<number>("MEDIA_CLEANUP_INTERVAL_MS", 60 * 60_000)
      if (Date.now() - this.lastCleanupAt < interval) return
      this.lastCleanupAt = Date.now()
      await this.media.cleanupUnreferencedObjects()
    } catch {
      // A later tick retries after a transient DB/storage outage; no payload or
      // object contents are written to logs from this background path.
    }
  }
}
