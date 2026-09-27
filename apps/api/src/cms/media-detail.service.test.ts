import { describe, expect, it, vi } from "vitest"

import { MediaAssetEntity, MediaProcessingJobEntity, MediaUploadEntity, MediaUsageEntity } from "@crm/db"
import { roleCapabilities } from "@crm/domain"

import { MediaService } from "./media.service.js"

const assetId = "22222222-2222-4222-8222-222222222222"
const uploadId = "33333333-3333-4333-8333-333333333333"
const actor = { id: "11111111-1111-4111-8111-111111111111", name: "Администратор", role: "admin" as const, capabilities: roleCapabilities("admin") }

function serviceFor(upload: Record<string, unknown> | null, job: Record<string, unknown> | null) {
  const row = {
    id: assetId, version: 1, kind: "image", state: "ready", title: "Лес", alt: "Лес", caption: null, credit: null,
    license: null, tags: [], focalPoint: { x: 0.5, y: 0.5 }, originalFilename: "forest.jpg", mimeType: "image/jpeg",
    byteSize: 1200, width: 800, height: 600, currentBlobId: null, archivedAt: null,
    createdAt: new Date("2026-09-27T10:00:00.000Z"), updatedAt: new Date("2026-09-27T10:00:00.000Z"),
  }
  const getRepository = vi.fn((entity) => {
    if (entity === MediaAssetEntity) return { findOneBy: vi.fn().mockResolvedValue(row) }
    if (entity === MediaUploadEntity) return { findOne: vi.fn().mockResolvedValue(upload) }
    if (entity === MediaProcessingJobEntity) return { findOneBy: vi.fn().mockResolvedValue(job) }
    if (entity === MediaUsageEntity) return { delete: vi.fn().mockResolvedValue(undefined) }
    return null
  })
  const dataSource = {
    getRepository,
    query: vi.fn().mockResolvedValue([]),
    transaction: async (callback: (manager: { getRepository: typeof getRepository }) => Promise<unknown>) => callback({ getRepository }),
  }
  return new MediaService(dataSource as never, { get: () => undefined } as never, {} as never, {} as never, {} as never)
}

describe("MediaService asset processing detail", () => {
  it("shows the next automatic attempt for a replacement while the original stays ready", async () => {
    const service = serviceFor({ id: uploadId, state: "processing", purpose: "replacement", errorCode: null }, {
      state: "queued", attempts: 2, availableAt: new Date("2026-09-27T12:00:00.000Z"), errorCode: "MEDIA_STORAGE_UNAVAILABLE",
      errorMessage: "internal bucket name must stay private",
    })
    const detail = await service.get(assetId, { limit: 100 }, actor)
    expect(detail.asset.state).toBe("ready")
    expect(detail.processing).toEqual({ state: "queued", purpose: "replacement", attempts: 2, nextAttemptAt: "2026-09-27T12:00:00.000Z", errorCode: "MEDIA_STORAGE_UNAVAILABLE" })
    expect(JSON.stringify(detail)).not.toContain("internal bucket name")
  })

  it("reports terminal upload errors without leaking arbitrary error text or codes", async () => {
    const service = serviceFor({ id: uploadId, state: "failed", purpose: "initial", errorCode: "SECRET_ENDPOINT", errorMessage: "private server path" }, null)
    const detail = await service.get(assetId, { limit: 100 }, actor)
    expect(detail.processing).toEqual({ state: "failed", purpose: "initial", attempts: 0, nextAttemptAt: null, errorCode: null })
    expect(JSON.stringify(detail)).not.toContain("private server path")
  })

  it("does not display a completed upload as pending processing", async () => {
    const service = serviceFor({ id: uploadId, state: "completed", purpose: "initial" }, null)
    expect((await service.get(assetId, { limit: 100 }, actor)).processing).toBeNull()
  })

  it("shows an expired upload grant as failed even before another upload request", async () => {
    const service = serviceFor({ id: uploadId, state: "pending", purpose: "initial", expiresAt: new Date("2020-01-01T00:00:00.000Z"), errorCode: null }, null)
    expect((await service.get(assetId, { limit: 100 }, actor)).processing).toMatchObject({ state: "failed", errorCode: "MEDIA_UPLOAD_EXPIRED" })
  })
})
