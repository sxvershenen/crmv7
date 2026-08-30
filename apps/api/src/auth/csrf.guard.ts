import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

import type { AuthenticatedRequest } from "../common/request-context.js"

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true
    const origin = request.header("origin")
    const fetchSite = request.header("sec-fetch-site")
    const allowedOrigin = this.config.getOrThrow<string>("CORS_ORIGIN")
    if (fetchSite === "cross-site" || (origin && origin !== allowedOrigin)) {
      throw new ForbiddenException({ code: "CSRF_REJECTED", message: "Запрос с недоверенного источника отклонён" })
    }
    return true
  }
}
