import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { Reflector } from "@nestjs/core"

import { parseCorsOrigins } from "@crm/config"

import type { AuthenticatedRequest } from "../common/request-context.js"
import { PUBLIC_ROUTE } from "../common/public.decorator.js"

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly config: ConfigService, @Inject(Reflector) private readonly reflector: Reflector = new Reflector()) {}

  canActivate(context: ExecutionContext) {
    const handler = typeof context.getHandler === "function" ? context.getHandler() : undefined
    const controller = typeof context.getClass === "function" ? context.getClass() : undefined
    if (handler && controller && this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [handler, controller])) return true
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true
    const origin = request.header("origin")
    const fetchSite = request.header("sec-fetch-site")
    const allowedOrigins = parseCorsOrigins(this.config.getOrThrow<string>("CORS_ORIGIN"))
    if (fetchSite === "cross-site" || (origin && !allowedOrigins.includes(origin))) {
      throw new ForbiddenException({ code: "CSRF_REJECTED", message: "Запрос с недоверенного источника отклонён" })
    }
    return true
  }
}
