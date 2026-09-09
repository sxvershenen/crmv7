import { Module } from "@nestjs/common"

import { InternalBusinessCalendarController } from "./business-calendar.controller.js"
import { InternalOfferingConfigurationController } from "./offering-configuration.controller.js"
import { InternalOfferingsController } from "./internal-offerings.controller.js"
import { OfferingsModule } from "./offerings.module.js"
import { InternalProgramOfferingController } from "./program-offering.controller.js"

@Module({ imports: [OfferingsModule], controllers: [InternalOfferingsController, InternalBusinessCalendarController, InternalOfferingConfigurationController, InternalProgramOfferingController] })
export class OfferingsInternalModule {}
