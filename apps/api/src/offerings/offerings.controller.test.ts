import { describe, expect, it } from "vitest"

import { REQUIRED_CAPABILITIES } from "../common/require-capability.decorator.js"
import { AdminOfferingsController } from "./admin-offerings.controller.js"
import { InternalOfferingsController } from "./internal-offerings.controller.js"

describe("offering binding target lookup controllers", () => {
  it("keeps the lookup on both private surfaces and requires CMS content view on admin", () => {
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, InternalOfferingsController)).toEqual(["canView"])
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, AdminOfferingsController)).toEqual(["canView", "canViewContent"])
    expect(typeof InternalOfferingsController.prototype.bindingTargets).toBe("function")
    expect(typeof AdminOfferingsController.prototype.bindingTargets).toBe("function")
    expect(typeof InternalOfferingsController.prototype.primaryStayOfferingForResource).toBe("function")
    expect(typeof AdminOfferingsController.prototype.primaryStayOfferingForResource).toBe("function")
    expect(typeof InternalOfferingsController.prototype.createStayOfferingFromResource).toBe("function")
    expect(typeof AdminOfferingsController.prototype.createStayOfferingFromResource).toBe("function")
    expect(typeof InternalOfferingsController.prototype.previewQuoteForResource).toBe("function")
    expect(typeof AdminOfferingsController.prototype.previewQuoteForResource).toBe("function")
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, InternalOfferingsController.prototype.createStayOfferingFromResource)).toEqual(["canCreate", "canEdit"])
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, AdminOfferingsController.prototype.createStayOfferingFromResource)).toEqual(["canCreate", "canEdit", "canEditContent"])
  })

  it("exposes the add-on registry, create and terms replacement on both private surfaces", () => {
    for (const controller of [InternalOfferingsController, AdminOfferingsController]) {
      expect(typeof controller.prototype.createAddOn).toBe("function")
      expect(typeof controller.prototype.replaceAddOnTerms).toBe("function")
    }
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, InternalOfferingsController.prototype.createAddOn)).toEqual(["canCreate", "canEdit"])
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, AdminOfferingsController.prototype.createAddOn)).toEqual(["canCreate", "canEdit", "canEditContent"])
  })
})
