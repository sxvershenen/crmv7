import "reflect-metadata"

import { NestFactory } from "@nestjs/core"
import { ConfigService } from "@nestjs/config"
import { Logger } from "nestjs-pino"

import { AppModule } from "./app.module.js"
import { configureApplication } from "./configure-application.js"

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  const config = app.get(ConfigService)
  app.useLogger(app.get(Logger))
  configureApplication(app)
  app.enableShutdownHooks()
  await app.listen(config.get<number>("API_PORT", 3000), "0.0.0.0")
}

void bootstrap()
