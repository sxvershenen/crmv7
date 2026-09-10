import type { CmsNodeDetail } from "@crm/contracts/content"

import { ApiCmsRepository, FixtureCmsRepository } from "@admin/data/cms-repository"
import { CmsConflictError } from "@admin/entities/cms"
import { AdminApiError } from "@admin/lib/api-client"
import { createPartnersEditorSection, partnersPolicy } from "@admin/data/partners-section"
import { createWhyUsEditorSection, whyUsPolicy } from "@admin/data/why-us-section"
import { createHomepageSectionEditorSection, homepageSectionPolicy } from "@admin/data/homepage-section"

describe("FixtureCmsRepository", () => {
  it("keeps fixtures behind a typed repository and increments versions", async () => {
    const repository = new FixtureCmsRepository(); const editor = await repository.getEditor("landing-family", "landing")
    const saved = await repository.saveEditor({ ...editor, publicTitle: "Новый H1" }, editor.version)
    expect(saved.publicTitle).toBe("Новый H1")
    expect(saved.version).toBe(editor.version + 1)
  })

  it("surfaces optimistic conflicts instead of overwriting", async () => {
    const repository = new FixtureCmsRepository(); const editor = await repository.getEditor("landing-family", "landing")
    await repository.saveEditor(editor, editor.version)
    await expect(repository.saveEditor(editor, editor.version)).rejects.toBeInstanceOf(CmsConflictError)
  })
})

describe("ApiCmsRepository", () => {
  it("round-trips new partners, edits and item order through the revision contract", async () => {
    const client = clientMock()
    client.get.mockResolvedValueOnce(detail)
    client.patch.mockImplementation(async (_path: string, body: { sections: NonNullable<CmsNodeDetail["currentRevision"]>["sections"] }) => ({ ...detail, currentRevision: { ...detail.currentRevision!, sections: body.sections } }))
    const repository = new ApiCmsRepository(client as never)
    const editor = await repository.getEditor(ids.node, "home")
    const section = createPartnersEditorSection()
    section.partnersConfig = { title: "С нами сотрудничают", description: "Редакционный текст", items: [{ id: ids.node, label: "Первый" }, { id: ids.node2, label: "Второй" }] }
    const added = await repository.saveEditor({ ...editor, sections: [section] }, editor.version)
    expect(added.sections[0]?.partnersConfig).toEqual(section.partnersConfig)
    expect(client.patch.mock.calls[0]?.[1].sections[0]).toMatchObject({ id: section.id, key: "partners", renderer: "partners", rendererVersion: "1", schemaVersion: 1, policy: partnersPolicy(section.partnersConfig) })
    const changed = { ...added.sections[0]!, partnersConfig: { ...section.partnersConfig, title: "Обновлено", items: [...section.partnersConfig.items].reverse() } }
    const saved = await repository.saveEditor({ ...added, sections: [changed] }, added.version)
    expect(saved.sections[0]?.partnersConfig).toEqual(changed.partnersConfig)
    expect(client.patch.mock.calls[1]?.[1]).toHaveProperty("sections")
  })

  it("preserves complex partner patches and metadata when editing unrelated content", async () => {
    const opaque = { id: ids.node2, key: "partners", renderer: "partners", rendererVersion: "1", schemaVersion: 1, order: 85, analyticsActionId: "home.partners.view", policy: { mode: "override" as const, patch: { scalars: {}, objects: {}, keyedArrays: { items: [{ operation: "remove" as const, key: ids.actor }] } } } }
    const server = { ...detail, currentRevision: { ...detail.currentRevision!, sections: [opaque] } }
    const client = clientMock(); client.get.mockResolvedValueOnce(server); client.patch.mockResolvedValueOnce(server)
    const repository = new ApiCmsRepository(client as never)
    const editor = await repository.getEditor(ids.node, "home")
    expect(editor.sections[0]?.partnersConfig).toBeUndefined()
    await repository.saveEditor({ ...editor, publicTitle: "Изменён заголовок страницы" }, editor.version)
    expect(client.patch.mock.calls[0]?.[1].sections).toEqual([opaque])
  })

  it("keeps incomplete partners in a draft and serializes hide as a disabled policy", async () => {
    const client = clientMock(); client.get.mockResolvedValueOnce(detail)
    client.patch.mockImplementation(async (_path: string, body: { sections: NonNullable<CmsNodeDetail["currentRevision"]>["sections"] }) => ({ ...detail, currentRevision: { ...detail.currentRevision!, sections: body.sections } }))
    const repository = new ApiCmsRepository(client as never)
    const editor = await repository.getEditor(ids.node, "home")
    const saved = await repository.saveEditor({ ...editor, sections: [createPartnersEditorSection()] }, editor.version)
    expect(saved.sections[0]?.partnersConfig?.items).toEqual([])
    await repository.saveEditor({ ...saved, sections: saved.sections.map((section) => ({ ...section, mode: "disabled" as const })) }, saved.version)
    expect(client.patch.mock.calls[1]?.[1].sections[0].policy).toEqual({ mode: "disabled" })
  })

  it("round-trips why-us facts and team copy through the revision contract", async () => {
    const client = clientMock()
    client.get.mockResolvedValueOnce(detail)
    client.patch.mockImplementation(async (_path: string, body: { sections: NonNullable<CmsNodeDetail["currentRevision"]>["sections"] }) => ({ ...detail, currentRevision: { ...detail.currentRevision!, sections: body.sections } }))
    const repository = new ApiCmsRepository(client as never)
    const editor = await repository.getEditor(ids.node, "home")
    const section = createWhyUsEditorSection()
    section.whyUsConfig = {
      eyebrow: "Почему нас", title: "Доверие", description: "Факты", facts: [{ id: "distance", number: "9 мин", title: "Рядом", description: "Быстро." }],
      team: { label: "Команда", title: "Всегда рядом", description: "Помогаем." },
    }
    const added = await repository.saveEditor({ ...editor, sections: [section] }, editor.version)
    expect(added.sections[0]?.whyUsConfig).toEqual(section.whyUsConfig)
    expect(client.patch.mock.calls[0]?.[1].sections[0]).toMatchObject({ id: section.id, key: "why-us", renderer: "why-us", rendererVersion: "1", schemaVersion: 1, policy: whyUsPolicy(section.whyUsConfig) })
  })

  it("round-trips shared homepage editorial fields through the revision contract", async () => {
    const client = clientMock()
    client.get.mockResolvedValueOnce(detail)
    client.patch.mockImplementation(async (_path: string, body: { sections: NonNullable<CmsNodeDetail["currentRevision"]>["sections"] }) => ({ ...detail, currentRevision: { ...detail.currentRevision!, sections: body.sections } }))
    const repository = new ApiCmsRepository(client as never)
    const editor = await repository.getEditor(ids.node, "home")
    const section = createHomepageSectionEditorSection("events")
    section.homepageConfig = { eyebrow: "CMS афиша", title: "События из CMS", description: "Редакционный текст", action: { label: "Все события", href: "/events" } }
    const saved = await repository.saveEditor({ ...editor, sections: [section] }, editor.version)
    expect(saved.sections[0]?.homepageConfig).toEqual(section.homepageConfig)
    expect(client.patch.mock.calls[0]?.[1].sections[0]).toMatchObject({ id: section.id, key: "events", renderer: "homepage-section", rendererVersion: "1", schemaVersion: 1, policy: homepageSectionPolicy(section.homepageConfig) })
  })

  it("reads CMS access through the same Admin API client", async () => {
    const client = clientMock()
    client.get.mockResolvedValueOnce({ user: { id: ids.actor, name: "Марина", role: "admin", capabilities: {
      canView: true, canCreate: true, canEdit: true, canDelete: true, canArchive: true, canAssign: true,
      canChangeStatus: true, canAddPayment: true, canRefund: true, canOverrideConflict: true, canViewFinance: true,
      canViewAudit: true, canManageUsers: true, canManageSettings: true, canViewContent: true, canEditContent: false,
      canReviewContent: true, canPublishContent: false, canManageSeo: true, canManageMedia: true, canViewAnalytics: true,
      canViewRawAnalytics: true, canManageSiteCode: true, canManageIntegrations: true, canManageRedirects: true,
      canManageSiteSettings: true,
    } } })
    const repository = new ApiCmsRepository(client as never)

    await expect(repository.getAccess()).resolves.toEqual({
      canViewContent: true, canEditContent: false, canReviewContent: true, canPublishContent: false,
    })
    expect(client.get).toHaveBeenCalledWith("/auth/session", expect.anything())
  })

  it("reads and strictly parses the authoritative dashboard endpoint", async () => {
    const client = clientMock()
    client.get.mockResolvedValueOnce({
      productionRelease: "REL-7", publishedAt: "2026-09-01T10:00:00.000Z", drafts: 2, queueHealthy: true,
      metrics: [
        { id: "pages", label: "Страницы", value: "4", detail: "3 в production" },
        { id: "seo", label: "SEO-качество", value: "3 / 4", detail: "1 страниц с рисками" },
        { id: "media", label: "Медиа", value: "8", detail: "0 файлов в обработке" },
        { id: "release", label: "Черновики", value: "2", detail: "1 на проверке" },
      ], attention: [], activity: [{ id: "change-1", actor: "Марина", action: "обновил", target: "Главная", when: "2026-09-01T09:00:00.000Z", status: "draft" }], funnel: { visitors: 0, leads: 12, bookings: 5, paid: 3 },
    })
    const repository = new ApiCmsRepository(client as never)

    const result = await repository.getDashboard()

    expect(client.get).toHaveBeenCalledWith("/dashboard", expect.anything())
    expect(result).toMatchObject({ productionRelease: "REL-7", drafts: 2, funnel: { visitors: 0, leads: 12 } })
    expect(result.activity[0]?.when).not.toBe("2026-09-01T09:00:00.000Z")
  })

  it("forwards cursor search and filters, then maps authoritative list records", async () => {
    const first = listItem({ ...detail, source: { sourceKind: "catalog_offering", sourceId: ids.node2, sourceVersion: 3, syncState: "draft", createdAt: "2026-08-31T09:30:00.000Z" } })
    const second = listItem({ ...detail, node: { ...detail.node, id: ids.node2 }, currentRevision: { ...detail.currentRevision!, id: ids.revision2, nodeId: ids.node2, title: "Вторая", route: { ...detail.currentRevision!.route, path: "/second", slug: "second" } } })
    const client = clientMock()
    client.get.mockResolvedValueOnce({ items: [first], nextCursor: "cursor-2" }).mockResolvedValueOnce({ items: [second], nextCursor: null })
    const repository = new ApiCmsRepository(client as never)

    const result = await repository.getNodes({ q: "семья", kind: "landing", status: "active" })

    expect(result.map((node) => node.title)).toEqual(["Семейный отдых", "Вторая"])
    expect(client.get).toHaveBeenNthCalledWith(1, "/content/nodes?limit=100&q=%D1%81%D0%B5%D0%BC%D1%8C%D1%8F&kind=landing&status=active", expect.anything())
    expect(client.get).toHaveBeenNthCalledWith(2, expect.stringContaining("cursor=cursor-2"), expect.anything())
    expect(result[0]).toMatchObject({ inboundLinks: null, mediaCount: null, pageKind: "landing", path: "/family", sortOrder: 10, source: "CRM", sourceKind: "catalog_offering", status: "draft" })
  })

  it("updates by immutable revision with expectedVersion and preserved server fields", async () => {
    const client = clientMock()
    client.get.mockResolvedValueOnce(detail)
    client.patch.mockImplementation(async (_path: string, body: { title: string }) => responseDetail({ title: body.title, revision: 5, version: 8 }))
    const repository = new ApiCmsRepository(client as never)
    const editor = await repository.getEditor(ids.node, "landing")

    const saved = await repository.saveEditor({ ...editor, publicTitle: "Обновлённый H1", seoTitle: "Обновлённый SEO title" }, editor.version)

    expect(saved).toMatchObject({ publicTitle: "Обновлённый H1", revision: 5, version: 8 })
    expect(client.patch).toHaveBeenCalledWith(`/content/nodes/${ids.node}`, expect.objectContaining({
      expectedVersion: 7,
      title: "Обновлённый H1",
      relations: detail.currentRevision!.relations,
      seo: expect.objectContaining({ title: "Обновлённый SEO title" }),
    }), expect.anything())
    const body = client.patch.mock.calls[0]![1] as Record<string, unknown>
    expect(body.operationId).toEqual(expect.any(String))
    expect(body.idempotencyKey).toEqual(expect.any(String))
  })

  it("creates a child with authoritative parent placement and end sort order", async () => {
    const client = clientMock()
    client.post.mockResolvedValueOnce({ ...detail, currentRevision: { ...detail.currentRevision!, route: { path: "/family/summer", slug: "summer", parentNodeId: ids.node2, sortOrder: 40 } } })
    const repository = new ApiCmsRepository(client as never)
    const editor = await repository.getEditor("new", "landing")

    await repository.saveEditor({ ...editor, slug: "summer", url: "/family/summer", parentNodeId: ids.node2, sortOrder: 40 }, editor.version)

    expect(client.post).toHaveBeenCalledWith("/content/nodes", expect.objectContaining({
      kind: "landing", route: { path: "/family/summer", slug: "summer", parentNodeId: ids.node2, sortOrder: 40 }, relations: [],
    }), expect.anything())
  })

  it("uses a route-only revision patch with expectedVersion for placement changes", async () => {
    const client = clientMock()
    client.get.mockResolvedValueOnce(detail)
    client.patch.mockResolvedValueOnce({ ...detail, node: { ...detail.node, version: 8 }, currentRevision: { ...detail.currentRevision!, revision: 5, route: { path: "/section/family", slug: "family", parentNodeId: ids.node2, sortOrder: 20 } } })
    const repository = new ApiCmsRepository(client as never)
    const editor = await repository.getEditor(ids.node, "landing")

    await repository.saveEditor({ ...editor, url: "/section/family", parentNodeId: ids.node2, sortOrder: 20 }, editor.version)

    expect(client.patch).toHaveBeenCalledWith(`/content/nodes/${ids.node}`, expect.objectContaining({
      expectedVersion: 7, route: { path: "/section/family", slug: "family", parentNodeId: ids.node2, sortOrder: 20 },
    }), expect.anything())
    const body = client.patch.mock.calls[0]![1] as Record<string, unknown>
    expect(body).not.toHaveProperty("relations")
    expect(body).not.toHaveProperty("title")
  })

  it("uses explicit review endpoints and maps version conflicts", async () => {
    const client = clientMock()
    client.get.mockResolvedValueOnce(detail)
    client.post.mockResolvedValueOnce(responseDetail({ state: "review", version: 8 }))
    const repository = new ApiCmsRepository(client as never)
    await repository.getEditor(ids.node, "landing")

    const reviewed = await repository.submitReview(ids.node, 7)
    expect(reviewed.status).toBe("review")
    expect(reviewed.revisionState).toBe("review")
    expect(client.post).toHaveBeenCalledWith(`/content/nodes/${ids.node}/submit-review`, expect.objectContaining({ expectedVersion: 7 }), expect.anything())

    client.post.mockResolvedValueOnce(responseDetail({ state: "approved", version: 9 }))
    const approved = await repository.approve(ids.node, 8)
    expect(approved.revisionState).toBe("approved")
    expect(client.post).toHaveBeenCalledWith(`/content/nodes/${ids.node}/approve`, expect.objectContaining({ expectedVersion: 8 }), expect.anything())

    client.patch.mockRejectedValueOnce(new AdminApiError({ code: "STALE_VERSION", message: "Устаревшая версия", details: { serverVersion: 12 }, requestId: "req-conflict" }, 409, "VERSION_CONFLICT"))
    const conflict = repository.saveEditor({ ...reviewed, status: "draft" }, reviewed.version)
    await expect(conflict).rejects.toBeInstanceOf(CmsConflictError)
    await expect(conflict).rejects.toMatchObject({ serverVersion: 12, requestId: "req-conflict" })
  })

  it("publishes a page through the one-click endpoint and refreshes its authoritative state", async () => {
    const client = clientMock()
    client.get.mockResolvedValueOnce(detail).mockResolvedValueOnce({ ...detail, node: { ...detail.node, version: 8 }, currentRevision: { ...detail.currentRevision!, state: "published" }, latestPublished: { id: detail.currentRevision!.id, nodeId: detail.node.id, revision: 4, state: "published", route: detail.currentRevision!.route, title: detail.currentRevision!.title, contentHash: detail.currentRevision!.contentHash, createdBy: ids.actor, createdAt: detail.currentRevision!.createdAt } })
    client.post.mockResolvedValueOnce({ node: { ...detail.node, version: 8 }, publishedRevision: { id: detail.currentRevision!.id, nodeId: detail.node.id, revision: 4, state: "published", route: detail.currentRevision!.route, title: detail.currentRevision!.title, contentHash: detail.currentRevision!.contentHash, createdBy: ids.actor, createdAt: detail.currentRevision!.createdAt }, publishedAt: "2026-08-31T10:00:00.000Z", publicationId: ids.revision2, publicationVersion: 2 })
    const repository = new ApiCmsRepository(client as never)
    await repository.getEditor(ids.node, "landing")

    const published = await repository.publish(ids.node, 7)

    expect(published.status).toBe("published")
    expect(client.post).toHaveBeenCalledWith(`/content/nodes/${ids.node}/publish`, expect.objectContaining({ expectedVersion: 7 }), expect.anything())
  })

  it("preserves site settings while saving nested public navigation", async () => {
    const settings = siteSettingsDetail()
    const client = clientMock()
    client.get.mockResolvedValueOnce(settings)
    client.patch.mockResolvedValueOnce({ ...settings, version: 4, draft: { ...settings.draft!, revision: 3, value: { ...settings.draft!.value, headerNavigation: [] } } })
    const repository = new ApiCmsRepository(client as never)
    const navigation = await repository.getNavigation()

    const saved = await repository.saveNavigation({ ...navigation, header: [] }, navigation.version)

    expect(saved.header).toEqual([])
    expect(client.patch).toHaveBeenCalledWith("/site-settings", expect.objectContaining({
      expectedVersion: 3,
      value: expect.objectContaining({ siteName: "Свистоплясово", headerNavigation: [], footerNavigation: expect.any(Array) }),
    }), expect.anything())
  })
})

const ids = {
  node: "11111111-1111-4111-8111-111111111111",
  node2: "11111111-1111-4111-8111-222222222222",
  revision: "22222222-2222-4222-8222-111111111111",
  revision2: "22222222-2222-4222-8222-222222222222",
  actor: "33333333-3333-4333-8333-333333333333",
}

const detail: CmsNodeDetail = {
  node: { id: ids.node, kind: "landing", status: "active", version: 7, createdAt: "2026-08-31T08:00:00.000Z", updatedAt: "2026-08-31T09:00:00.000Z" },
  currentRevision: {
    id: ids.revision, nodeId: ids.node, revision: 4, state: "draft", route: { path: "/family", slug: "family", parentNodeId: null, sortOrder: 10 },
    title: "Семейный отдых", summary: "Описание", hero: { mode: "inherit" }, sections: [],
    seo: { title: "Семейный отдых", description: "Описание семейного отдыха", indexPolicy: "index_follow", canonical: { mode: "self" }, structuredData: [] },
    relations: [], schemaVersion: 1, contentHash: "a".repeat(64), createdBy: ids.actor, createdAt: "2026-08-31T09:00:00.000Z",
  },
  latestPublished: null, source: null,
}

function listItem(value: CmsNodeDetail) {
  const revision = value.currentRevision!
  return { node: value.node, currentRevision: { id: revision.id, nodeId: revision.nodeId, revision: revision.revision, state: revision.state, route: revision.route, title: revision.title, contentHash: revision.contentHash, createdBy: revision.createdBy, createdAt: revision.createdAt }, latestPublished: value.latestPublished, source: value.source }
}

function responseDetail({ state = "draft", title = detail.currentRevision!.title, revision = detail.currentRevision!.revision, version = detail.node.version }: { state?: "draft" | "review" | "approved"; title?: string; revision?: number; version?: number }) {
  return { ...detail, node: { ...detail.node, version }, currentRevision: { ...detail.currentRevision!, state, title, revision } }
}

function clientMock() {
  return { get: vi.fn(), patch: vi.fn(), post: vi.fn() }
}

function siteSettingsDetail() {
  const navigationItem = { id: ids.node, label: "Домики", link: { kind: "internal" as const, path: "/houses" }, target: "_self" as const, icon: "home", color: "#2f6b4f", visibleOn: "all" as const, enabled: true, children: [] }
  return {
    id: ids.node2, version: 3,
    draft: { id: ids.revision2, revision: 2, state: "draft" as const, value: { siteName: "Свистоплясово", headerNavigation: [navigationItem], mobileNavigation: [], footerNavigation: [navigationItem], headerCta: null, heroDefault: null }, contentHash: "b".repeat(64), createdBy: ids.actor, createdAt: "2026-08-31T10:00:00.000Z" },
    published: null,
  }
}
