import cookieParser from "cookie-parser"
import helmet from "helmet"
import type { INestApplication } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

import { parseCorsOrigins } from "@crm/config"

import { ApiExceptionFilter } from "./common/api-exception.filter.js"
import { RequestIdInterceptor } from "./common/request-id.interceptor.js"

export function configureApplication(app: INestApplication) {
  const config = app.get(ConfigService)
  app.use(helmet())
  app.use(cookieParser())
  app.enableCors({
    origin: parseCorsOrigins(config.getOrThrow<string>("CORS_ORIGIN")),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
  app.setGlobalPrefix("api")
  app.useGlobalInterceptors(new RequestIdInterceptor())
  app.useGlobalFilters(new ApiExceptionFilter())
  return app
}
