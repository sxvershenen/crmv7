import "reflect-metadata"

import { DataSource } from "typeorm"

import { parseServerEnvironment } from "@crm/config"

import { databaseEntities } from "./entities.js"
import { databaseMigrations } from "./migrations.js"

const environment = parseServerEnvironment(process.env)

const crmDataSource = new DataSource({
  type: "postgres",
  url: environment.DATABASE_URL,
  entities: databaseEntities,
  migrations: databaseMigrations,
  migrationsRun: false,
  synchronize: false,
})

export default crmDataSource
