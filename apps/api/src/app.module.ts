import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { APP_GUARD } from "@nestjs/core"
import { TypeOrmModule } from "@nestjs/typeorm"
import { LoggerModule } from "nestjs-pino"

import { parseServerEnvironment } from "@crm/config"
import { AlignCoreConstraints1788112400000, BookingItemsPaymentTypes1788112800000, BookingLeadLinks1788114400000, CustomersLeads1788113600000, databaseEntities, IdempotencyKeys1788113200000, InitialSchema1788112000000, ProgramsEvents1788114000000 } from "@crm/db"

import { AuthModule } from "./auth/auth.module.js"
import { CapabilityGuard } from "./auth/capability.guard.js"
import { CsrfGuard } from "./auth/csrf.guard.js"
import { SessionGuard } from "./auth/session.guard.js"
import { HealthController } from "./health/health.controller.js"
import { LiveModule } from "./live/live.module.js"
import { OpenApiController } from "./openapi/openapi.controller.js"
import { SavedViewsModule } from "./saved-views/saved-views.module.js"
import { ResourcesModule } from "./resources/resources.module.js"
import { BookingsModule } from "./bookings/bookings.module.js"
import { PaymentsModule } from "./payments/payments.module.js"
import { TasksModule } from "./tasks/tasks.module.js"
import { CustomersModule } from "./customers/customers.module.js"
import { LeadsModule } from "./leads/leads.module.js"
import { ProgramsModule } from "./programs/programs.module.js"
import { EventsModule } from "./events/events.module.js"
import { FinanceModule } from "./finance/finance.module.js"
import { SearchModule } from "./search/search.module.js"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (environment) => parseServerEnvironment(environment as NodeJS.ProcessEnv),
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      providers: [],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>("LOG_LEVEL", "info"),
          redact: ["req.headers.cookie", "req.headers.authorization", "req.body.password", "res.headers.set-cookie"],
        },
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres" as const,
        url: config.getOrThrow<string>("DATABASE_URL"),
        entities: databaseEntities,
        migrations: [InitialSchema1788112000000, AlignCoreConstraints1788112400000, BookingItemsPaymentTypes1788112800000, IdempotencyKeys1788113200000, CustomersLeads1788113600000, ProgramsEvents1788114000000, BookingLeadLinks1788114400000],
        migrationsRun: config.get<boolean>("RUN_MIGRATIONS", false),
        synchronize: false,
      }),
    }),
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
  ],
  controllers: [HealthController, OpenApiController],
  providers: [
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: CapabilityGuard },
  ],
})
export class AppModule {}
