import { Module } from "@nestjs/common"

import { AdminBusinessCalendarController } from "./business-calendar.controller.js"
import { AdminOfferingConfigurationController } from "./offering-configuration.controller.js"
import { AdminOfferingsController } from "./admin-offerings.controller.js"
import { OfferingsModule } from "./offerings.module.js"

@Module({ imports: [OfferingsModule], controllers: [AdminOfferingsController, AdminBusinessCalendarController, AdminOfferingConfigurationController] })
export class OfferingsAdminModule {}
