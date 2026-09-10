import { Module } from "@nestjs/common"

import { BusinessCalendarApplicationService } from "./business-calendar-application.service.js"
import { OfferingConfigurationApplicationService } from "./offering-configuration-application.service.js"
import { OfferingEditorApplicationService } from "./offering-editor-application.service.js"
import { OperationalQuoteAcceptanceService } from "./operational-quote-acceptance.service.js"
import { PriceBookActivationWorker } from "./price-book-activation.worker.js"
import { ProgramOfferingApplicationService } from "./program-offering-application.service.js"
import { EventServiceApplicationService } from "./event-service-application.service.js"
import { EventOrderQuoteApplicationService } from "./event-order-quote-application.service.js"

@Module({ providers: [OfferingEditorApplicationService, BusinessCalendarApplicationService, OfferingConfigurationApplicationService, OperationalQuoteAcceptanceService, PriceBookActivationWorker, ProgramOfferingApplicationService, EventServiceApplicationService, EventOrderQuoteApplicationService], exports: [OfferingEditorApplicationService, BusinessCalendarApplicationService, OfferingConfigurationApplicationService, OperationalQuoteAcceptanceService, ProgramOfferingApplicationService, EventServiceApplicationService, EventOrderQuoteApplicationService] })
export class OfferingsModule {}
