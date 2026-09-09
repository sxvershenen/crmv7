import { describe, expect, it } from "vitest"
import { HTTP_CODE_METADATA } from "@nestjs/common/constants.js"

import { REQUIRED_CAPABILITIES } from "../common/require-capability.decorator.js"
import { AdminEventServiceController, InternalEventServiceController } from "./event-service.controller.js"

describe("event-service private controllers", () => {
  it("keeps admin content permission separate and exposes reload/preview routes", () => {
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, InternalEventServiceController)).toEqual(["canView"])
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, AdminEventServiceController)).toEqual(["canView", "canViewContent"])
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, InternalEventServiceController.prototype.prepareRoute)).toEqual(["canCreate", "canEdit"])
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, AdminEventServiceController.prototype.prepareRoute)).toEqual(["canCreate", "canEdit", "canEditContent"])
    for (const controller of [InternalEventServiceController, AdminEventServiceController]) {
      expect(typeof controller.prototype.registryRoute).toBe("function")
      expect(typeof controller.prototype.previewRoute).toBe("function")
      expect(typeof controller.prototype.reloadRoute).toBe("function")
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, controller.prototype.previewRoute)).toBe(200)
    }
  })
})
