import type { Request } from "express"

import type { SessionUser } from "@crm/contracts"

export type AuthenticatedRequest = Request & {
  requestId: string
  sessionUser?: SessionUser
}
