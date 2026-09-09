import { Global, Module } from "@nestjs/common"

import { DeliveryModule } from "../delivery/delivery.module.js"
import { LiveController } from "./live.controller.js"
import { LiveService } from "./live.service.js"
import { OutboxDispatcherService } from "./outbox-dispatcher.service.js"

@Global()
@Module({ imports: [DeliveryModule], controllers: [LiveController], providers: [LiveService, OutboxDispatcherService], exports: [LiveService] })
export class LiveModule {}
