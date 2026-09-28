import "reflect-metadata"

import { describe, expect, it, vi } from "vitest"
import { REQUIRED_CAPABILITIES } from "../common/require-capability.decorator.js"
import { CmsHomeOfferingChoicesController } from "./cms-home-offering-choices.controller.js"

const id = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000001`

describe("CMS homepage offering choices", () => {
  it("requires content view, excludes archived rows and pages without dropping choices", async () => {
    expect(Reflect.getMetadata(REQUIRED_CAPABILITIES, CmsHomeOfferingChoicesController.prototype.list)).toEqual(["canViewContent"])
    const getMany = vi.fn()
      .mockResolvedValueOnce(Array.from({ length: 101 }, (_, index) => ({ id: id(index + 1), operationalName: `Домик ${index + 1}`, state: "active" })))
      .mockResolvedValueOnce([{ id: id(101), operationalName: "Последний домик", state: "draft" }])
    const builder = {
      where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(), take: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(), getMany,
    }
    const controller = new CmsHomeOfferingChoicesController({ getRepository: () => ({ createQueryBuilder: () => builder }) } as never)
    const first = await controller.list({ kind: "house" })
    expect(first.items).toHaveLength(100)
    expect(first.nextCursor).toBe(id(100))
    const second = await controller.list({ kind: "house", cursor: first.nextCursor! })
    expect(second.items).toEqual([{ offeringId: id(101), title: "Последний домик", state: "draft" }])
    expect(second.nextCursor).toBeNull()
    expect(builder.where).toHaveBeenCalledWith("offering.kind = :kind", { kind: "house" })
    expect(builder.andWhere).toHaveBeenCalledWith("offering.archived_at IS NULL")
    expect(builder.andWhere).toHaveBeenCalledWith("offering.id > :cursor", { cursor: id(100) })
    expect(builder.orderBy).toHaveBeenCalledWith("offering.id", "ASC")
    expect(builder.take).toHaveBeenCalledWith(101)
    expect(builder.innerJoin).not.toHaveBeenCalled()
  })

  it("limits scheduled choices to scheduled add-ons", async () => {
    const builder = {
      where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(), take: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(), getMany: vi.fn().mockResolvedValue([]),
    }
    const controller = new CmsHomeOfferingChoicesController({ getRepository: () => ({ createQueryBuilder: () => builder }) } as never)
    await controller.list({ kind: "scheduled_resource" })
    expect(builder.where).toHaveBeenCalledWith("offering.kind = :kind", { kind: "addon" })
    expect(builder.innerJoin).toHaveBeenCalledWith("addon_offering_terms", "terms", "terms.offering_id = offering.id AND terms.service_type = 'scheduled_resource'")
  })
})
