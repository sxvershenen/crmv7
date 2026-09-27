import "reflect-metadata"

import { describe, expect, it, vi } from "vitest"

import { REQUIRED_CAPABILITIES } from "../common/require-capability.decorator.js"
import { CmsPromotionChoicesController } from "./cms-promotion-choices.controller.js"

describe("CmsPromotionChoicesController", () => {
  it("requires CMS viewing rights and reads the CRM promotion registry", async () => {
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, CmsPromotionChoicesController.prototype.list)).toEqual(["canViewContent"])
    const listPromotions = vi.fn().mockResolvedValue({ items: [], canManage: false })
    const user = { id: "11111111-1111-4111-8111-111111111111" }
    const result = await new CmsPromotionChoicesController({ listPromotions } as never).list({ sessionUser: user } as never)
    expect(listPromotions).toHaveBeenCalledWith(user)
    expect(result).toEqual({ items: [], canManage: false })
  })
})
