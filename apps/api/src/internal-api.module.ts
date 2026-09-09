import { Module } from "@nestjs/common"

import { AuthModule } from "./auth/auth.module.js"
import { BookingsModule } from "./bookings/bookings.module.js"
import { CustomersModule } from "./customers/customers.module.js"
import { EventsModule } from "./events/events.module.js"
import { FinanceModule } from "./finance/finance.module.js"
import { HealthController } from "./health/health.controller.js"
import { LeadsModule } from "./leads/leads.module.js"
import { LiveModule } from "./live/live.module.js"
import { NotificationsModule } from "./notifications/notifications.module.js"
import { OfferingsInternalModule } from "./offerings/offerings-internal.module.js"
import { OpenApiController } from "./openapi/openapi.controller.js"
import { PaymentsModule } from "./payments/payments.module.js"
import { ProgramsModule } from "./programs/programs.module.js"
import { ResourcesModule } from "./resources/resources.module.js"
import { SavedViewsModule } from "./saved-views/saved-views.module.js"
import { SearchModule } from "./search/search.module.js"
import { TasksModule } from "./tasks/tasks.module.js"
import { WorkspaceModule } from "./workspace/workspace.module.js"
import { MarketingModule } from "./marketing/marketing.module.js"

@Module({
  imports: [
    AuthModule,
    TasksModule,
    CustomersModule,
    LeadsModule,
    SavedViewsModule,
    ResourcesModule,
    BookingsModule,
    PaymentsModule,
    LiveModule,
    ProgramsModule,
    EventsModule,
    FinanceModule,
    SearchModule,
    NotificationsModule,
    OfferingsInternalModule,
    WorkspaceModule,
    MarketingModule,
  ],
  controllers: [HealthController, OpenApiController],
  exports: [AuthModule],
})
export class InternalApiModule {}
