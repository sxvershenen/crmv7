import { describe, expect, it, vi } from "vitest"

import { ChangeLogEntity, CmsNodeEntity, CmsNodeRevisionEntity } from "@crm/db"

import { PublicContentService, resolvedContentHash, signPreviewToken } from "./public-content.service.js"

const nodeId = "11111111-1111-4111-8111-111111111111"
const revisionId = "22222222-2222-4222-8222-222222222222"
const releaseId = "33333333-3333-4333-8333-333333333333"
const hash = "a".repeat(64)
const secret = "preview-secret-at-least-thirty-two-characters"

const node = { id: nodeId, kind: "landing", status: "active", archivedAt: null }
const revision = {
  id: revisionId,
  nodeId,
  revision: 2,
  state: "published",
  path: "/svadby",
  title: "Свадьбы",
  summary: "Площадки для праздника",
  sections: [{ id: "44444444-4444-4444-8444-444444444444", key: "hero", renderer: "hero", rendererVersion: "1", schemaVersion: 1, policy: { mode: "inherit" }, order: 10 }],
  seo: { title: "Свадьбы", description: "Площадки для праздника" },
  contentHash: hash,
}

const resolvedContent = {
  kind: "landing",
  path: "/svadby",
  title: "Свадьбы",
  summary: "Площадки для праздника",
  sections: [{ id: "44444444-4444-4444-8444-444444444444", key: "hero", renderer: "hero", rendererVersion: "1", schemaVersion: 1, config: { title: "Свадьбы" }, order: 10 }],
  seo: { title: "Свадьбы", description: "Площадки для праздника", indexPolicy: "index_follow", canonical: { mode: "self" }, structuredData: [] },
}

function service(overrides: Partial<Record<string, unknown>> = {}) {
  const repositories = new Map<unknown, { findOneBy?: ReturnType<typeof vi.fn>; save?: ReturnType<typeof vi.fn> }>([
    [CmsNodeRevisionEntity, { findOneBy: vi.fn().mockResolvedValue(revision) }],
    [CmsNodeEntity, { findOneBy: vi.fn().mockResolvedValue(node) }],
    [ChangeLogEntity, { save: vi.fn().mockImplementation(async (value) => value) }],
  ])
  const dataSource = {
    query: vi.fn().mockResolvedValue([{
      releaseId,
      releaseCreatedAt: new Date("2026-09-01T10:00:00.000Z"),
      releasePublishedAt: new Date("2026-09-01T10:01:00.000Z"),
      nodeId,
      revisionId,
      resolvedContentHash: resolvedContentHash(resolvedContent),
      resolvedContent,
      dependencies: [],
    }]),
    getRepository: vi.fn((entity) => repositories.get(entity)),
  }
  const config = { get: vi.fn().mockReturnValue(secret) }
  return {
    service: new PublicContentService(dataSource as never, config as never),
    repositories,
    dataSource,
    config,
    ...overrides,
  }
}

describe("PublicContentService", () => {
  it("resolves only the revision pinned by the active published release", async () => {
    const subject = service()
    const page = await subject.service.resolve({ path: "/svadby", locale: "ru-RU" })
    expect(page).toMatchObject({ nodeId, revisionId, releaseId, path: "/svadby", title: "Свадьбы" })
    expect(page.sections).toEqual([expect.objectContaining({ key: "hero", config: { title: "Свадьбы" } })])
    expect(page).not.toHaveProperty("relations")
    expect(page.cache.etag).toContain(releaseId)
    expect(subject.dataSource.query.mock.calls[0]?.[0]).not.toContain("revision.state = 'published'")
  })

  it("does not leak an unpublished draft through the active release resolver", async () => {
    const subject = service()
    subject.dataSource.query.mockResolvedValue([])
    await expect(subject.service.resolve({ path: "/svadby", locale: "ru-RU" })).rejects.toMatchObject({ response: { code: "NOT_FOUND" } })
  })

  it("allows a valid signed draft preview but marks it private and noindex", async () => {
    const subject = service()
    subject.repositories.get(CmsNodeRevisionEntity)!.findOneBy!.mockResolvedValue({ ...revision, state: "draft" })
    const token = signPreviewToken({ version: 1, revisionId, contentHash: hash, expiresAt: Date.now() + 60_000 }, secret)
    const page = await subject.service.preview({ token })
    expect(page).toMatchObject({ revisionId, renderable: false, seo: { indexPolicy: "noindex_nofollow" } })
    expect(page.blockingIssues).toEqual(["CMS_INHERITANCE_NOT_MATERIALIZED"])
  })

  it("rejects an invalid preview token before looking up a revision", async () => {
    const subject = service()
    await expect(subject.service.preview({ token: "not-a-valid-token-with-enough-length-123456" })).rejects.toMatchObject({ response: { code: "NOT_FOUND" } })
    expect(subject.repositories.get(CmsNodeRevisionEntity)!.findOneBy!).not.toHaveBeenCalled()
  })

  it("audits preview bearer issuance without persisting the token", async () => {
    const subject = service()
    const actorId = "55555555-5555-4555-8555-555555555555"
    const issued = await subject.service.issuePreview(revisionId, { ttlSeconds: 60 }, actorId, "request-preview-1")
    expect(issued.token).toContain(".")
    expect(subject.repositories.get(ChangeLogEntity)!.save).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "cms_node_revision",
      entityId: revisionId,
      action: "preview_token_issued",
      actorId,
      requestId: "request-preview-1",
    }))
    expect(JSON.stringify(subject.repositories.get(ChangeLogEntity)!.save!.mock.calls)).not.toContain(issued.token)
  })

  it("keeps published resolution available when preview signing is not configured", async () => {
    const subject = service()
    subject.config.get.mockReturnValue(undefined)
    await expect(subject.service.resolve({ path: "/svadby", locale: "ru-RU" })).resolves.toMatchObject({ releaseId })
    await expect(subject.service.issuePreview(revisionId, { ttlSeconds: 60 }, "55555555-5555-4555-8555-555555555555", "request-1")).rejects.toMatchObject({ status: 503 })
  })
})
