import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { MediaStorageService } from "./media-storage.service.js"

describe("MediaStorageService local adapter", () => {
  const roots: string[] = []
  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it("isolates namespaces, lists objects and preserves API fallback URLs", async () => {
    const root = await mkdtemp(join(tmpdir(), "crm-v7-media-"))
    roots.push(root)
    const service = new MediaStorageService({ get: (key: string, fallback?: unknown) => ({ MEDIA_STORAGE_ROOT: root, MEDIA_STORAGE_DRIVER: "local" }[key] ?? fallback) } as never)

    await service.writeStaging("upload-1/payload", Buffer.from("source"))
    await service.writePublic("asset-1/variant.webp", Buffer.from("variant"), "image/webp")
    expect(await service.readStaging("upload-1/payload")).toEqual(Buffer.from("source"))
    expect((await service.listObjects()).map((object) => object.key).sort()).toEqual(["public/asset-1/variant.webp", "staging/upload-1/payload"])
    expect(service.publicUrl("public/asset-1/variant.webp", "/api/public/v1/media/a/v")).toBe("/api/public/v1/media/a/v")

    await service.deleteObject("public/asset-1/variant.webp")
    expect((await service.listObjects()).map((object) => object.key)).toEqual(["staging/upload-1/payload"])
  })

  it("rejects traversal-like storage keys", async () => {
    const root = await mkdtemp(join(tmpdir(), "crm-v7-media-"))
    roots.push(root)
    const service = new MediaStorageService({ get: (key: string, fallback?: unknown) => ({ MEDIA_STORAGE_ROOT: root, MEDIA_STORAGE_DRIVER: "local" }[key] ?? fallback) } as never)
    await expect(service.writePublic("../escape", Buffer.from("bad"))).rejects.toThrow("Invalid media storage key")
  })
})
