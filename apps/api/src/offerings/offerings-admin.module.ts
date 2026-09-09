import { Module } from "@nestjs/common"

import { AdminBusinessCalendarController } from "./business-calendar.controller.js"
import { AdminOfferingConfigurationController } from "./offering-configuration.controller.js"
import { AdminOfferingsController } from "./admin-offerings.controller.js"
import { OfferingsModule } from "./offerings.module.js"
import { AdminProgramOfferingController } from "./program-offering.controller.js"
import { AdminEventServiceController } from "./event-service.controller.js"

@Module({ imports: [OfferingsModule], controllers: [AdminOfferingsController, AdminBusinessCalendarController, AdminOfferingConfigurationController, AdminProgramOfferingController, AdminEventServiceController] })
export class OfferingsAdminModule {}
