import { describe, expect, it } from "vitest"

import type { SessionUser } from "@crm/contracts"

import { EventsService } from "./events.service.js"

const readonlyActor: SessionUser = {
  id: "11111111-1111-4111-8111-111111111111", name: "Readonly", role: "readonly",
  capabilities: { canView: true, canCreate: false, canEdit: false, canDelete: false, canArchive: false, canAssign: false, canChangeStatus: false, canAddPayment: false, canRefund: false, canOverrideConflict: false, canViewFinance: false, canViewAudit: false, canManageUsers: false, canManageSettings: false },
}

describe("EventsService capability boundary", () => {
  it("rejects event creation before touching persistence for readonly users", async () => {
    const service = new EventsService(undefined as never)
    await expect(service.create({} as never, readonlyActor, "request-1")).rejects.toMatchObject({ response: { code: "PERMISSION_DENIED" } })
  })
})
