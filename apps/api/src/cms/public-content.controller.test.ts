import "reflect-metadata"

import { describe, expect, it, vi } from "vitest"

import { PUBLIC_ROUTE } from "../common/public.decorator.js"
import { PublicContentController } from "./public-content.controller.js"

describe("PublicContentController", () => {
  it("marks the whole controller public without granting internal CMS routes", () => {
    expect(Reflect.getMetadata(PUBLIC_ROUTE, PublicContentController)).toBe(true)
  })

  it("uses ETag and public cache headers for an active-release page", async () => {
    const resolve = vi.fn().mockResolvedValue({ cache: { etag: "\"release-revision\"", maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300, tags: ["cms-release:test"] } })
    const response = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() }
    const controller = new PublicContentController({ resolve } as never)
    await controller.resolve({ path: "/", locale: "ru-RU" }, undefined, response as never)
    expect(response.setHeader).toHaveBeenCalledWith("ETag", "\"release-revision\"")
    expect(response.setHeader).toHaveBeenCalledWith("Surrogate-Key", "cms-release:test")
    expect(response.status).toHaveBeenCalledWith(200)
  })
})
