import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common"
import { Reflector } from "@nestjs/core"

import type { CapabilityName } from "@crm/contracts"

import { REQUIRED_CAPABILITIES } from "../common/require-capability.decorator.js"
import type { AuthenticatedRequest } from "../common/request-context.js"

@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<CapabilityName[]>(REQUIRED_CAPABILITIES, [
      context.getHandler(),
      context.getClass(),
    ]) ?? []
    if (required.length === 0) return true

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().sessionUser
    const missing = required.find((capability) => user?.capabilities[capability] !== true)
    if (missing) {
      throw new ForbiddenException({
        code: "PERMISSION_DENIED",
        message: "Недостаточно прав для этого действия",
        details: { capability: missing },
      })
    }
    return true
  }
}
