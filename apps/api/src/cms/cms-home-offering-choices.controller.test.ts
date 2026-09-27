import "reflect-metadata"

import { describe, expect, it, vi } from "vitest"
import { REQUIRED_CAPABILITIES } from "../common/require-capability.decorator.js"
import { CmsHomeOfferingChoicesController } from "./cms-home-offering-choices.controller.js"

const id = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000001`

describe("CMS homepage offering choices", () => {
  it("requires content view, excludes archived rows and pages without dropping choices", async () => {
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, CmsHomeOfferingChoicesController.prototype.list)).toEqual(["canViewContent"])
    const find = vi.fn()
      .mockResolvedValueOnce(Array.from({ length: 101 }, (_, index) => ({ id: id(index + 1), operationalName: `Домик ${index + 1}`, state: "active" })))
      .mockResolvedValueOnce([{ id: id(101), operationalName: "Последний домик", state: "draft" }])
    const controller = new CmsHomeOfferingChoicesController({ getRepository: () => ({ find }) } as never)
    const first = await controller.list({ kind: "house" })
    expect(first.items).toHaveLength(100)
    expect(first.nextCursor).toBe(id(100))
    const second = await controller.list({ kind: "house", cursor: first.nextCursor! })
    expect(second.items).toEqual([{ offeringId: id(101), title: "Последний домик", state: "draft" }])
    expect(second.nextCursor).toBeNull()
    expect(find.mock.calls[0]?.[0]).toMatchObject({ where: { kind: "house", archivedAt: expect.anything(), state: expect.anything() }, order: { id: "ASC" }, take: 101 })
    expect(find.mock.calls[1]?.[0]?.where.id).toBeDefined()
  })
})
