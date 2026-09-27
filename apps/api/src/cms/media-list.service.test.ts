import { describe, expect, it, vi } from "vitest"

import { MediaAssetEntity, MediaUsageEntity } from "@crm/db"
import { roleCapabilities } from "@crm/domain"

import { decodeMediaCursor, MediaService } from "./media.service.js"

const actor = { id: "11111111-1111-4111-8111-111111111111", name: "Администратор", role: "admin" as const, capabilities: roleCapabilities("admin") }
const first = asset("22222222-2222-4222-8222-222222222222", "2026-09-27T12:00:00.000Z")
const second = asset("33333333-3333-4333-8333-333333333333", "2026-09-27T11:00:00.000Z")
const third = asset("44444444-4444-4444-8444-444444444444", "2026-09-27T10:00:00.000Z")

describe("MediaService list", () => {
  it("returns a stable cursor page and applies the same search and state to the next page", async () => {
    const builder = { andWhere: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), addOrderBy: vi.fn().mockReturnThis(), take: vi.fn().mockReturnThis(), getMany: vi.fn().mockResolvedValueOnce([first, second, third]).mockResolvedValueOnce([third]) }
    const dataSource = { getRepository: vi.fn((entity) => entity === MediaAssetEntity ? { createQueryBuilder: () => builder } : entity === MediaUsageEntity ? { findBy: vi.fn().mockResolvedValue([]) } : null) }
    const service = new MediaService(dataSource as never, { get: () => undefined } as never, {} as never, {} as never, {} as never)

    const initial = await service.list({ q: "лес", state: "ready", limit: 2 }, actor)
    expect(initial.items.map((item) => item.id)).toEqual([first.id, second.id])
    expect(decodeMediaCursor(initial.nextCursor!)).toEqual({ updatedAt: second.updatedAt.toISOString(), id: second.id })
    expect(builder.take).toHaveBeenCalledWith(3)
    expect(builder.andWhere).toHaveBeenCalledWith("asset.state = :state", { state: "ready" })
    expect(builder.andWhere).toHaveBeenCalledWith(expect.stringContaining("LIKE :q"), { q: "%лес%" })

    const next = await service.list({ q: "лес", state: "ready", limit: 2, cursor: initial.nextCursor! }, actor)
    expect(next.items.map((item) => item.id)).toEqual([third.id])
    expect(next.nextCursor).toBeNull()
    expect(builder.orderBy).toHaveBeenCalledWith("date_trunc('milliseconds', asset.updated_at)", "DESC")
    expect(builder.addOrderBy).toHaveBeenCalledWith("asset.id", "DESC")
    expect(builder.andWhere).toHaveBeenCalledWith(expect.stringContaining("date_trunc('milliseconds', asset.updated_at) < :beforeUpdatedAt"), { beforeUpdatedAt: second.updatedAt.toISOString(), beforeId: second.id })
  })

  it("rejects a malformed cursor before querying the list", async () => {
    const builder = { andWhere: vi.fn().mockReturnThis(), getMany: vi.fn() }
    const service = new MediaService({ getRepository: () => ({ createQueryBuilder: () => builder }) } as never, { get: () => undefined } as never, {} as never, {} as never, {} as never)
    await expect(service.list({ limit: 2, cursor: "not-a-cursor" }, actor)).rejects.toMatchObject({ response: { code: "INVALID_CURSOR" } })
    expect(builder.getMany).not.toHaveBeenCalled()
  })
})

function asset(id: string, updatedAt: string) {
  return { id, version: 1, kind: "image", state: "ready", title: "Лес", alt: "Лес", caption: null, credit: null, license: null, tags: [], focalPoint: { x: 0.5, y: 0.5 }, originalFilename: "forest.jpg", mimeType: "image/jpeg", byteSize: 1200, width: 800, height: 600, currentBlobId: null, archivedAt: null, createdAt: new Date(updatedAt), updatedAt: new Date(updatedAt) }
}
