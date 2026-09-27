import { describe, expect, it, vi } from "vitest"

import { ChangeLogEntity, CmsNodeEntity, CmsNodeRevisionEntity, PromotionEntity } from "@crm/db"

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
  const repositories = new Map<unknown, { findOneBy?: ReturnType<typeof vi.fn>; find?: ReturnType<typeof vi.fn>; save?: ReturnType<typeof vi.fn> }>([
    [CmsNodeRevisionEntity, { findOneBy: vi.fn().mockResolvedValue(revision) }],
    [CmsNodeEntity, { findOneBy: vi.fn().mockResolvedValue(node) }],
    [ChangeLogEntity, { save: vi.fn().mockImplementation(async (value) => value) }],
    [PromotionEntity, { find: vi.fn().mockResolvedValue([]) }],
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
      itemPath: resolvedContent.path,
    }]),
    getRepository: vi.fn((entity) => repositories.get(entity)),
  }
  const config = { get: vi.fn().mockReturnValue(secret) }
  const publication = { materializePreviewRevision: vi.fn().mockResolvedValue({ content: null, issues: [{ severity: "error", code: "CMS_INHERITANCE_NOT_MATERIALIZED", message: "Нет собранной страницы" }] }) }
  return {
    service: new PublicContentService(dataSource as never, config as never, publication as never),
    repositories,
    dataSource,
    config,
    publication,
    ...overrides,
  }
}

describe("PublicContentService", () => {
  it("projects only current CRM promotions selected in the published homepage, preserving order", async () => {
    const subject = service()
    const first = "66666666-6666-4666-8666-666666666666"
    const second = "77777777-7777-4777-8777-777777777777"
    const expired = "88888888-8888-4888-8888-888888888888"
    const home = { ...resolvedContent, kind: "home", path: "/", hero: { title: "Главная", promotionIds: [second, expired, first] } }
    subject.dataSource.query.mockResolvedValue([{ releaseId, releaseCreatedAt: new Date("2026-09-01T10:00:00.000Z"), releasePublishedAt: new Date("2026-09-01T10:01:00.000Z"), nodeId, revisionId, resolvedContentHash: resolvedContentHash(home), resolvedContent: home, dependencies: [], itemPath: "/" }])
    const terms = (code: string, value: number, endsAt: string | null = null) => ({ code, name: `Скидка ${code}`, active: true, discountType: "fixed", value, minimumAmountMinor: 0, startsAt: null, endsAt, scope: "all", resourceIds: [], offeringIds: [] })
    const rows = [
      { id: first, code: "FIRST", archivedAt: null, terms: terms("FIRST", 300000) },
      { id: second, code: "SECOND", archivedAt: null, terms: terms("SECOND", 500000) },
      { id: expired, code: "EXPIRED", archivedAt: null, terms: terms("EXPIRED", 100000, "2020-01-01T00:00:00.000Z") },
    ]
    subject.repositories.get(PromotionEntity)!.find!.mockResolvedValue(rows)
    const before = await subject.service.resolve({ path: "/", locale: "ru-RU" })
    expect(before.featuredPromotions.map((promotion) => promotion.code)).toEqual(["SECOND", "FIRST"])
    expect(before.featuredPromotions[0]).toMatchObject({ value: 500000, discountType: "fixed", minimumAmountMinor: 0, scope: "all" })
    expect(before.featuredPromotions[0]).not.toHaveProperty("resourceIds")
    expect(before.cache).toMatchObject({ maxAgeSeconds: 0, staleWhileRevalidateSeconds: 0 })
    rows[0]!.terms.active = false
    rows[1]!.terms.value = 800000
    const after = await subject.service.resolve({ path: "/", locale: "ru-RU" })
    expect(after.featuredPromotions).toMatchObject([{ code: "SECOND", value: 800000 }])
    expect(after.cache.etag).not.toBe(before.cache.etag)
    expect(subject.repositories.get(PromotionEntity)!.find).toHaveBeenCalledTimes(2)
  })
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

  it("serves an existing English release item at its canonical Russian URL", async () => {
    const subject = service()
    const legacy = { ...resolvedContent, path: "/houses/forest" }
    subject.dataSource.query.mockResolvedValue([{ releaseId, releaseCreatedAt: new Date("2026-09-01T10:00:00.000Z"), releasePublishedAt: new Date("2026-09-01T10:01:00.000Z"), nodeId, revisionId, resolvedContentHash: resolvedContentHash(legacy), resolvedContent: legacy, dependencies: [], itemPath: legacy.path }])
    await expect(subject.service.resolve({ path: "/domiki/forest", locale: "ru-RU" })).resolves.toMatchObject({ path: "/domiki/forest", releaseId })
    expect(subject.dataSource.query.mock.calls[0]?.[1]).toEqual([["/domiki/forest", "/houses/forest"]])
  })

  it("builds sitemap routes and direct redirects only from the active release", async () => {
    const subject = service()
    const legacy = { ...resolvedContent, path: "/venues/meadow", seo: { ...resolvedContent.seo, structuredData: [{ id: nodeId, schemaType: "Service", enabled: true, payload: { name: "Поляна" } }] } }
    subject.dataSource.query.mockResolvedValue([{ releaseId, releaseCreatedAt: new Date("2026-09-01T10:00:00.000Z"), releasePublishedAt: new Date("2026-09-01T10:01:00.000Z"), resolvedContentHash: resolvedContentHash(legacy), resolvedContent: legacy, itemPath: legacy.path }])
    await expect(subject.service.manifest()).resolves.toMatchObject({
      releaseId,
      routes: [{ path: "/poshadki/meadow", schemaTypes: ["Service"] }],
      redirects: [{ sourcePath: "/venues/meadow", destinationPath: "/poshadki/meadow", statusCode: 301 }],
    })
  })

  it("allows a valid signed draft preview but marks it private and noindex", async () => {
    const subject = service()
    subject.repositories.get(CmsNodeRevisionEntity)!.findOneBy!.mockResolvedValue({ ...revision, state: "draft" })
    const token = signPreviewToken({ version: 1, revisionId, contentHash: hash, expiresAt: Date.now() + 60_000 }, secret)
    const page = await subject.service.preview({ token })
    expect(page).toMatchObject({ revisionId, renderable: false, seo: { indexPolicy: "noindex_nofollow" } })
    expect(page.blockingIssues).toEqual(["CMS_INHERITANCE_NOT_MATERIALIZED"])
  })

  it("returns a materialized noindex page while CRM facts are not ready", async () => {
    const subject = service()
    subject.repositories.get(CmsNodeRevisionEntity)!.findOneBy!.mockResolvedValue({ ...revision, state: "draft" })
    subject.publication.materializePreviewRevision.mockResolvedValue({ content: resolvedContent, issues: [{ severity: "error", code: "CMS_RESOURCE_PUBLIC_PROJECTION_REQUIRED", message: "Предложение ещё не готово", route: revision.path }] })
    const token = signPreviewToken({ version: 1, revisionId, contentHash: hash, expiresAt: Date.now() + 60_000 }, secret)
    const page = await subject.service.preview({ token })
    expect(page).toMatchObject({ renderable: true, path: "/svadby", page: { path: "/svadby", seo: { indexPolicy: "noindex_nofollow" } }, blockingIssues: ["CMS_RESOURCE_PUBLIC_PROJECTION_REQUIRED"] })
    expect(page).not.toHaveProperty("relations")
  })

  it("resolves current CRM promotions for a signed homepage draft preview", async () => {
    const subject = service()
    const promotionId = "66666666-6666-4666-8666-666666666666"
    subject.repositories.get(CmsNodeEntity)!.findOneBy!.mockResolvedValue({ ...node, kind: "home" })
    subject.repositories.get(CmsNodeRevisionEntity)!.findOneBy!.mockResolvedValue({ ...revision, path: "/", state: "draft" })
    subject.publication.materializePreviewRevision.mockResolvedValue({ content: { ...resolvedContent, kind: "home", path: "/", hero: { title: "Главная", promotionIds: [promotionId] } }, issues: [] })
    subject.repositories.get(PromotionEntity)!.find!.mockResolvedValue([{ id: promotionId, code: "AUTUMN15", archivedAt: null, terms: { code: "AUTUMN15", name: "Осенние выходные", active: true, discountType: "percent", value: 15, minimumAmountMinor: 0, startsAt: null, endsAt: null, scope: "all", resourceIds: [], offeringIds: [] } }])
    const token = signPreviewToken({ version: 1, revisionId, contentHash: hash, expiresAt: Date.now() + 60_000 }, secret)
    const preview = await subject.service.preview({ token })
    expect(preview).toMatchObject({ renderable: true, path: "/", page: { path: "/", seo: { indexPolicy: "noindex_nofollow" } }, featuredPromotions: [{ code: "AUTUMN15", value: 15 }] })
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
