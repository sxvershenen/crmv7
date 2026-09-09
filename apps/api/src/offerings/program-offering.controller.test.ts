import { describe, expect, it } from "vitest"
import { HTTP_CODE_METADATA } from "@nestjs/common/constants.js"

import { REQUIRED_CAPABILITIES } from "../common/require-capability.decorator.js"
import { AdminProgramOfferingController, InternalProgramOfferingController } from "./program-offering.controller.js"

describe("program offering private controllers", () => {
  it("exposes prepare and template preview on both surfaces with fail-closed admin capabilities", () => {
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, InternalProgramOfferingController)).toEqual(["canView"])
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, AdminProgramOfferingController)).toEqual(["canView", "canViewContent"])
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, InternalProgramOfferingController.prototype.prepareRoute)).toEqual(["canCreate", "canEdit"])
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, AdminProgramOfferingController.prototype.prepareRoute)).toEqual(["canCreate", "canEdit", "canEditContent"])
    for (const controller of [InternalProgramOfferingController, AdminProgramOfferingController]) {
      expect(typeof controller.prototype.lookupRoute).toBe("function")
      expect(typeof controller.prototype.prepareRoute).toBe("function")
      expect(typeof controller.prototype.previewRoute).toBe("function")
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, controller.prototype.previewRoute)).toBe(200)
    }
  })
})
