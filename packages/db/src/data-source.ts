import "reflect-metadata"

import { DataSource } from "typeorm"

import { parseServerEnvironment } from "@crm/config"

import { databaseEntities } from "./entities.js"
import { InitialSchema1788112000000 } from "./migrations/1788112000000-initial-schema.js"
import { AlignCoreConstraints1788112400000 } from "./migrations/1788112400000-align-core-constraints.js"
import { BookingItemsPaymentTypes1788112800000 } from "./migrations/1788112800000-booking-items-payment-types.js"
import { IdempotencyKeys1788113200000 } from "./migrations/1788113200000-idempotency-keys.js"
import { CustomersLeads1788113600000 } from "./migrations/1788113600000-customers-leads.js"
import { ProgramsEvents1788114000000 } from "./migrations/1788114000000-programs-events.js"

const environment = parseServerEnvironment(process.env)

const crmDataSource = new DataSource({
  type: "postgres",
  url: environment.DATABASE_URL,
  entities: databaseEntities,
  migrations: [InitialSchema1788112000000, AlignCoreConstraints1788112400000, BookingItemsPaymentTypes1788112800000, IdempotencyKeys1788113200000, CustomersLeads1788113600000, ProgramsEvents1788114000000],
  migrationsRun: false,
  synchronize: false,
})

export default crmDataSource
