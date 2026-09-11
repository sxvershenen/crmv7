import "reflect-metadata"

import { describe, expect, it } from "vitest"

import { REQUIRED_CAPABILITIES } from "../common/require-capability.decorator.js"
import { CmsPublicationController } from "./cms-publication.controller.js"
import { CmsDashboardController } from "./cms-dashboard.controller.js"

describe("CmsPublicationController", () => {
  it("keeps release reads separate from the granular publication mutation capability", () => {
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, CmsPublicationController.prototype.list)).toEqual(["canViewContent"])
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, CmsPublicationController.prototype.get)).toEqual(["canViewContent"])
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, CmsPublicationController.prototype.build)).toEqual(["canPublishContent"])
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, CmsPublicationController.prototype.activate)).toEqual(["canPublishContent"])
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, CmsPublicationController.prototype.rollback)).toEqual(["canPublishContent"])
  })

  it("protects the dashboard with the content read capability", () => {
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, CmsDashboardController)).toEqual(["canViewContent"])
  })
})
