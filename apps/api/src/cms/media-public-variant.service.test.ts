import { describe, expect, it, vi } from "vitest"

import { MediaVariantEntity } from "@crm/db"

import { MediaService } from "./media.service.js"

const assetId = "22222222-2222-4222-8222-222222222222"
const variantId = "33333333-3333-4333-8333-333333333333"

describe("MediaService public variants", () => {
  it("serves an immutable older variant after the asset's current blob is replaced", async () => {
    const oldVariant = { id: variantId, assetId, blobId: "old-blob", storageKey: "old/hero.webp", format: "webp", contentHash: "a".repeat(64) }
    const query = {
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn(),
    }
    query.getOne.mockImplementation(async () => {
      const predicate = `${String(query.innerJoin.mock.calls[0]?.[2])} ${String(query.where.mock.calls[0]?.[0])}`
      return predicate.includes("current_blob_id") ? null : oldVariant
    })
    const getRepository = vi.fn((entity) => entity === MediaVariantEntity ? { createQueryBuilder: () => query } : null)
    const bytes = Buffer.from("old published image")
    const readPublic = vi.fn().mockResolvedValue(bytes)
    const service = new MediaService({ getRepository } as never, { get: () => undefined } as never, { readPublic } as never, {} as never, {} as never)

    await expect(service.publicVariant(assetId, variantId)).resolves.toEqual({ value: bytes, format: "webp", contentHash: oldVariant.contentHash })
    expect(query.where).toHaveBeenCalledWith(expect.stringContaining("asset.state = 'ready'"), { assetId, variantId })
    expect(readPublic).toHaveBeenCalledWith(oldVariant.storageKey)
  })
})
