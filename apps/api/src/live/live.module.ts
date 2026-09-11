import { Global, Module } from "@nestjs/common"

import { DeliveryModule } from "../delivery/delivery.module.js"
import { AnalyticsDailyRollupService } from "../analytics/analytics-daily-rollup.service.js"
import { AnalyticsDailyRollupWorker } from "../analytics/analytics-daily-rollup.worker.js"
import { LiveController } from "./live.controller.js"
import { LiveService } from "./live.service.js"
import { OutboxDispatcherService } from "./outbox-dispatcher.service.js"

@Global()
@Module({
  imports: [DeliveryModule],
  controllers: [LiveController],
  providers: [LiveService, OutboxDispatcherService, AnalyticsDailyRollupService, AnalyticsDailyRollupWorker],
  exports: [LiveService, AnalyticsDailyRollupService],
})
export class LiveModule {}
