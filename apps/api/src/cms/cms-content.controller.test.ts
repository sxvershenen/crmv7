import "reflect-metadata"

import { describe, expect, it, vi } from "vitest"

import { REQUIRED_CAPABILITIES } from "../common/require-capability.decorator.js"
import { CmsContentController } from "./cms-content.controller.js"

describe("CmsContentController", () => {
  it("declares granular capabilities for view, edit and review routes", () => {
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, CmsContentController.prototype.list)).toEqual(["canViewContent"])
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, CmsContentController.prototype.update)).toEqual(["canEditContent"])
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, CmsContentController.prototype.returnToDraft)).toEqual(["canReviewContent"])
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, CmsContentController.prototype.publicationPreview)).toEqual(["canViewContent"])
  })

  it("passes request identity into a mutation", async () => {
    const create = vi.fn().mockResolvedValue({ node: { id: "node" } })
    const controller = new CmsContentController({ create } as never)
    const input = { operationId: "11111111-1111-4111-8111-111111111111" }
    const user = { id: "22222222-2222-4222-8222-222222222222" }
    await controller.create(input as never, { sessionUser: user, requestId: "request-1" } as never)
    expect(create).toHaveBeenCalledWith(input, user, "request-1")
  })
})
