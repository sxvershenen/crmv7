import "reflect-metadata"

import { describe, expect, it, vi } from "vitest"

import { REQUIRED_CAPABILITIES } from "../common/require-capability.decorator.js"
import { CmsSiteSettingsController } from "./cms-site-settings.controller.js"

describe("CmsSiteSettingsController", () => {
  it("protects all dedicated Metrika routes with integration management capability", () => {
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, CmsSiteSettingsController.prototype.getMetrika)).toEqual(["canManageIntegrations"])
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, CmsSiteSettingsController.prototype.updateMetrika)).toEqual(["canManageIntegrations"])
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, CmsSiteSettingsController.prototype.publishMetrika)).toEqual(["canManageIntegrations"])
  })

  it("passes request identity into Metrika update and publication", async () => {
    const updateMetrika = vi.fn().mockResolvedValue({ version: 2 })
    const publishMetrika = vi.fn().mockResolvedValue({ version: 3 })
    const controller = new CmsSiteSettingsController({ updateMetrika, publishMetrika } as never)
    const user = { id: "22222222-2222-4222-8222-222222222222" }
    const request = { sessionUser: user, requestId: "request-1" }
    const update = { operationId: "11111111-1111-4111-8111-111111111111" }
    const publish = { operationId: "33333333-3333-4333-8333-333333333333" }

    await controller.updateMetrika(update as never, request as never)
    await controller.publishMetrika(publish as never, request as never)

    expect(updateMetrika).toHaveBeenCalledWith(update, user, "request-1")
    expect(publishMetrika).toHaveBeenCalledWith(publish, user, "request-1")
  })
})
