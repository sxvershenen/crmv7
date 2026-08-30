import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common"
import { DataSource } from "typeorm"

import { OutboxEventEntity } from "@crm/db"

import { LiveService } from "./live.service.js"

@Injectable()
export class OutboxDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcherService.name)
  private timer: ReturnType<typeof setInterval> | undefined
  private running = false

  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(LiveService) private readonly live: LiveService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.dispatchBatch(), 1_000)
    this.timer.unref()
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  async dispatchBatch() {
    if (this.running || !this.dataSource.isInitialized) return 0
    this.running = true
    try {
      const claimed = await this.dataSource.transaction(async (manager) => {
        const rows = await manager.query(`
          SELECT * FROM outbox_events
          WHERE processed_at IS NULL AND available_at <= now()
          ORDER BY available_at, created_at
          FOR UPDATE SKIP LOCKED
          LIMIT 100
        `) as Array<Record<string, unknown>>
        if (rows.length === 0) return rows
        await manager.query(`
          UPDATE outbox_events
          SET attempts = attempts + 1, available_at = now() + interval '30 seconds'
          WHERE id = ANY($1::uuid[])
        `, [rows.map((row) => row.id)])
        return rows
      })

      for (const row of claimed) {
        try {
          const payload = row.payload as Record<string, unknown>
          this.live.publish({
            entityType: String(row.aggregate_type),
            entityId: String(payload.taskId ?? payload.code ?? row.aggregate_id),
            event: String(row.topic),
            version: typeof payload.version === "number" ? payload.version : 1,
          })
          await this.dataSource.getRepository(OutboxEventEntity).update({ id: String(row.id) }, { processedAt: new Date() })
        } catch (error) {
          this.logger.warn(`Outbox event ${String(row.id)} will be retried: ${error instanceof Error ? error.message : "unknown error"}`)
        }
      }
      return claimed.length
    } finally {
      this.running = false
    }
  }
}
