import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common"
import { Reflector } from "@nestjs/core"

import { PUBLIC_ROUTE } from "../common/public.decorator.js"
import type { AuthenticatedRequest } from "../common/request-context.js"
import { AuthService } from "./auth.service.js"

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()])) return true
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const user = await this.authService.resolveSession(request.cookies as Record<string, string> | undefined)
    if (!user) throw new UnauthorizedException({ code: "UNAUTHENTICATED", message: "Сессия истекла" })
    request.sessionUser = user
    return true
  }
}
