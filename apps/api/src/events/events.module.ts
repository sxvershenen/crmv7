import { Module } from "@nestjs/common"

import { EventsController } from "./events.controller.js"
import { EventsService } from "./events.service.js"
import { EventCategoriesService } from "./event-categories.service.js"

@Module({ controllers: [EventsController], providers: [EventsService, EventCategoriesService] })
export class EventsModule {}
