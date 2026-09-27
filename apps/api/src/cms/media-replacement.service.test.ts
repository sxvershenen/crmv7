import { describe, expect, it, vi } from "vitest"

import { MediaAssetEntity, MediaUploadEntity } from "@crm/db"
import { roleCapabilities } from "@crm/domain"

import { MediaService } from "./media.service.js"

const assetId = "22222222-2222-4222-8222-222222222222"
const actor = { id: "11111111-1111-4111-8111-111111111111", name: "Администратор", role: "admin" as const, capabilities: roleCapabilities("admin") }

describe("MediaService replacement grants", () => {
  it("rejects a second replacement while the first upload is being processed", async () => {
    const assetQuery = { setLock: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), getOne: vi.fn().mockResolvedValue({ id: assetId, state: "ready", version: 3, currentBlobId: "old-blob" }) }
    const uploadQuery = { where: vi.fn().mockReturnThis(), getOne: vi.fn().mockResolvedValue({ id: "active-upload", state: "processing" }) }
    const manager = {
      getRepository: vi.fn((entity) => entity === MediaAssetEntity ? { createQueryBuilder: () => assetQuery } : entity === MediaUploadEntity ? { createQueryBuilder: () => uploadQuery } : null),
      create: vi.fn(),
      save: vi.fn(),
    }
    const dataSource = { transaction: async (callback: (tx: typeof manager) => Promise<unknown>) => callback(manager) }
    const service = new MediaService(dataSource as never, { get: () => undefined } as never, {} as never, {} as never, {} as never)

    await expect(service.initReplacement(assetId, { expectedVersion: 3, filename: "new.webp", mimeType: "image/webp", byteSize: 100, checksumSha256: "a".repeat(64) }, actor, "http://localhost:3000"))
      .rejects.toMatchObject({ response: { code: "MEDIA_REPLACEMENT_IN_PROGRESS" } })
    expect(assetQuery.setLock).toHaveBeenCalledWith("pessimistic_write")
    expect(uploadQuery.where).toHaveBeenCalledWith(expect.stringContaining("upload.state = 'processing'"), { assetId })
    expect(manager.save).not.toHaveBeenCalled()
  })
})
