import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { APP_GUARD, RouterModule } from "@nestjs/core"
import { TypeOrmModule } from "@nestjs/typeorm"
import { LoggerModule } from "nestjs-pino"

import { parseServerEnvironment } from "@crm/config"
import { databaseEntities, databaseMigrations } from "@crm/db"

import { CapabilityGuard } from "./auth/capability.guard.js"
import { AuthModule } from "./auth/auth.module.js"
import { BookingsModule } from "./bookings/bookings.module.js"
import { CsrfGuard } from "./auth/csrf.guard.js"
import { SessionGuard } from "./auth/session.guard.js"
import { AdminApiModule } from "./cms/admin-api.module.js"
import { PublicApiModule } from "./cms/public-api.module.js"
import { CustomersModule } from "./customers/customers.module.js"
import { EventsModule } from "./events/events.module.js"
import { FinanceModule } from "./finance/finance.module.js"
import { InternalApiModule } from "./internal-api.module.js"
import { LeadsModule } from "./leads/leads.module.js"
import { LiveModule } from "./live/live.module.js"
import { NotificationsModule } from "./notifications/notifications.module.js"
import { OfferingsAdminModule } from "./offerings/offerings-admin.module.js"
import { OfferingsInternalModule } from "./offerings/offerings-internal.module.js"
import { AdminOpenApiController } from "./openapi/admin-openapi.controller.js"
import { PublicOpenApiController } from "./openapi/public-openapi.controller.js"
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
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
      validate: (environment) => parseServerEnvironment(environment as NodeJS.ProcessEnv),
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      providers: [],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>("LOG_LEVEL", "info"),
          redact: ["req.headers.cookie", "req.headers.authorization", "req.query.token", "req.body.password", "res.headers.set-cookie"],
        },
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres" as const,
        url: config.getOrThrow<string>("DATABASE_URL"),
        entities: databaseEntities,
        migrations: databaseMigrations,
        migrationsRun: config.get<boolean>("RUN_MIGRATIONS", false),
        synchronize: false,
      }),
    }),
    InternalApiModule,
    AdminApiModule,
    PublicApiModule,
    RouterModule.register([
      {
        path: "internal/v1",
        module: InternalApiModule,
        children: [
          AuthModule, TasksModule, CustomersModule, LeadsModule, SavedViewsModule, ResourcesModule,
          BookingsModule, PaymentsModule, LiveModule, ProgramsModule, EventsModule, FinanceModule,
          SearchModule, NotificationsModule, OfferingsInternalModule, WorkspaceModule, MarketingModule,
        ].map((module) => ({ path: "", module })),
      },
      {
        path: "admin/v1",
        module: AdminApiModule,
        children: [{ path: "", module: OfferingsAdminModule }],
      },
      { path: "public/v1", module: PublicApiModule },
    ]),
  ],
  controllers: [AdminOpenApiController, PublicOpenApiController],
  providers: [
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: CapabilityGuard },
  ],
})
export class AppModule {}
