import { Module } from "@nestjs/common"
import { OfferingsModule } from "../offerings/offerings.module.js"

import { EventsController } from "./events.controller.js"
import { EventsService } from "./events.service.js"
import { EventCategoriesService } from "./event-categories.service.js"

@Module({ imports: [OfferingsModule], controllers: [EventsController], providers: [EventsService, EventCategoriesService] })
export class EventsModule {}
