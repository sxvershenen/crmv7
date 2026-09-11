import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

import { ANALYTICS_AGGREGATE_TIMEZONE } from "./analytics-aggregate.service.js"
import { AnalyticsDailyRollupService } from "./analytics-daily-rollup.service.js"

const DAY_MS = 24 * 60 * 60 * 1000
const ROLLUP_INTERVAL_MS = 60 * 60 * 1000

@Injectable()
export class AnalyticsDailyRollupWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsDailyRollupWorker.name)
  private timer: ReturnType<typeof setInterval> | undefined
  private running = false

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(AnalyticsDailyRollupService) private readonly rollups: AnalyticsDailyRollupService,
  ) {}

  onModuleInit(): void {
    if (this.config.get<string>("APP_ENV") === "test") return
    this.timer = setInterval(() => void this.tick(), ROLLUP_INTERVAL_MS)
    this.timer.unref()
    void this.tick()
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  }

  async tick(now = new Date()): Promise<number> {
    if (this.running) return 0
    this.running = true
    try {
      return await this.rollups.rebuildDay(this.completedDay(now))
    } catch (error) {
      this.logger.warn(`Daily analytics rollup will retry: ${error instanceof Error ? error.message : "unknown error"}`)
      return 0
    } finally {
      this.running = false
    }
  }

  private completedDay(now: Date): string {
    const currentMoscowDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: ANALYTICS_AGGREGATE_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now)
    return new Date(new Date(`${currentMoscowDay}T00:00:00.000Z`).getTime() - DAY_MS).toISOString().slice(0, 10)
  }
}
