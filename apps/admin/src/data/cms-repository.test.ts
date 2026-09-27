import type { CmsNodeDetail } from "@crm/contracts/content"
import { AnalyticsAggregateResponseSchema } from "@crm/contracts/analytics"

import { analyticsRecentDateRange, ApiCmsRepository, FixtureCmsRepository } from "@admin/data/cms-repository"
import { CmsConflictError } from "@admin/entities/cms"
import { AdminApiError } from "@admin/lib/api-client"
import { createPartnersEditorSection, partnersPolicy } from "@admin/data/partners-section"
import { createWhyUsEditorSection, whyUsPolicy } from "@admin/data/why-us-section"
import { createHomepageSectionEditorSection, homepageSectionPolicy } from "@admin/data/homepage-section"
import { createEditorialSection, editorialPolicy } from "@admin/data/editorial-section"

describe("FixtureCmsRepository", () => {
  it("shows only real fixture revisions created by saves", async () => {
    const repository = new FixtureCmsRepository()
    const editor = await repository.getEditor("landing-family", "landing")
    const before = await repository.getRevisionHistory(editor.id)
    expect(before.items).toHaveLength(1)
    const saved = await repository.saveEditor({ ...editor, publicTitle: "Новый заголовок" }, editor.version)
    const after = await repository.getRevisionHistory(saved.id)
    expect(after.items.map((entry) => entry.revision)).toEqual([saved.revision, editor.revision ?? editor.version])
    expect(after.items[0]).toMatchObject({ title: "Новый заголовок", state: "draft" })
    expect(after.items[1]).toMatchObject({ title: editor.publicTitle, state: "superseded" })
  })

  it("versions media metadata and rejects a stale fixture save", async () => {
    const repository = new FixtureCmsRepository()
    const original = await repository.getAsset("asset-hero")
    const saved = await repository.saveMediaMetadata({ ...original, caption: "Зимний лес" })
    expect(saved.version).toBe((original.version ?? 1) + 1)
    expect((await repository.getAsset(original.id)).caption).toBe("Зимний лес")
    await expect(repository.saveMediaMetadata(original)).rejects.toBeInstanceOf(CmsConflictError)
  })

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

  it("does not show a successful demo save for an empty menu link", async () => {
    const repository = new FixtureCmsRepository()
    const navigation = await repository.getNavigation()

    await expect(repository.saveNavigation({ ...navigation, header: [{ ...navigation.header[0]!, href: "" }] }, navigation.version)).rejects.toThrow("Укажите ссылку")
    expect((await repository.getNavigation()).version).toBe(navigation.version)
  })

  it("keeps a fixture page editable after unpublish and allows publishing it again", async () => {
    const repository = new FixtureCmsRepository()
    const editor = await repository.getEditor("houses", "category")
    const status = await repository.getPublicationStatus("houses")
    expect(status.active).toBe(true)
    await repository.unpublish("houses", editor.version, status)
    expect((await repository.getPublicationStatus("houses")).active).toBe(false)
    await repository.publish("houses", editor.version)
    expect((await repository.getPublicationStatus("houses")).active).toBe(true)
  })
})

describe("ApiCmsRepository", () => {
  it("issues a preview token for the saved current revision", async () => {
    const client = clientMock()
    client.get.mockResolvedValue(detail)
    const issued = { token: "p".repeat(40), expiresAt: "2026-09-27T18:00:00.000Z", previewPath: "/family" }
    client.post.mockResolvedValue(issued)
    const repository = new ApiCmsRepository(client as never)
    await expect(repository.getPreviewToken(ids.node, detail.node.version)).resolves.toEqual(issued)
    expect(client.post).toHaveBeenCalledWith(`/content/revisions/${detail.currentRevision!.id}/preview-token`, { ttlSeconds: 900 }, expect.anything())
    expect(client.get).toHaveBeenCalledOnce()
  })

  it("rejects a stale editor instead of previewing another author's revision", async () => {
    const client = clientMock()
    client.get.mockResolvedValue({ ...detail, node: { ...detail.node, version: detail.node.version + 1 } })
    const repository = new ApiCmsRepository(client as never)
    await expect(repository.getPreviewToken(ids.node, detail.node.version)).rejects.toBeInstanceOf(CmsConflictError)
    expect(client.post).not.toHaveBeenCalled()
  })

  it("binds ready desktop and mobile media with public variants before saving", async () => {
    const desktopId = ids.node2
    const mobileId = ids.revision2
    const client = clientMock()
    client.get.mockImplementation(async (path: string) => path.startsWith("/media/assets/") ? {
      asset: { ...wireMediaAsset(), id: path.endsWith(mobileId) ? mobileId : desktopId, variants: [{ id: ids.revision, format: "webp", width: 1600, height: 900, byteSize: 1200, url: path.endsWith(mobileId) ? "/mobile.webp" : "/desktop.webp", contentHash: "a".repeat(64) }] },
      usages: [], usageTotal: 0, usagesTruncated: false,
    } : detail)
    client.patch.mockImplementation(async (_path: string, body: { hero: unknown }) => ({ ...detail, currentRevision: { ...detail.currentRevision!, hero: body.hero } }))
    const repository = new ApiCmsRepository(client as never)
    const editor = await repository.getEditor(ids.node, "landing")

    await repository.saveEditor({ ...editor, hero: { ...editor.hero, mode: "override", desktopImage: desktopId, mobileImage: mobileId } }, editor.version)

    expect(client.patch.mock.calls[0]?.[1].hero.config).toMatchObject({
      backgroundAssetId: desktopId, background: { assetId: desktopId, alt: "Лес", variants: [{ url: "/desktop.webp", format: "webp" }] },
      mobileBackgroundAssetId: mobileId, mobileBackground: { assetId: mobileId, alt: "Лес", variants: [{ url: "/mobile.webp", format: "webp" }] },
    })
  })

  it("refuses media without a ready public variant before changing the page", async () => {
    const client = clientMock()
    client.get.mockImplementation(async (path: string) => path.startsWith("/media/assets/") ? { asset: wireMediaAsset(), usages: [], usageTotal: 0, usagesTruncated: false } : detail)
    const repository = new ApiCmsRepository(client as never)
    const editor = await repository.getEditor(ids.node, "landing")

    await expect(repository.saveEditor({ ...editor, hero: { ...editor.hero, mode: "override", desktopImage: ids.node } }, editor.version)).rejects.toThrow("ещё не готово")
    expect(client.patch).not.toHaveBeenCalled()
  })

  it("creates an article with its text inside the first CMS revision", async () => {
    const client = clientMock()
    client.post.mockImplementation(async (_path: string, body: { sections: NonNullable<CmsNodeDetail["currentRevision"]>["sections"] }) => ({
      ...detail, node: { ...detail.node, kind: "article" }, currentRevision: { ...detail.currentRevision!, sections: body.sections },
    }))
    const repository = new ApiCmsRepository(client as never)
    const editor = await repository.getEditor("new", "article")
    const section = createEditorialSection()
    section.editorialConfig = { heading: null, lead: null, blocks: [{ type: "paragraph", text: "Первая статья" }], links: [] }
    await repository.saveEditor({ ...editor, sections: [section] }, editor.version)
    expect(client.post).toHaveBeenCalledWith("/content/nodes", expect.objectContaining({ kind: "article", sections: [expect.objectContaining({ renderer: "editorial-content" })] }), expect.anything())
  })

  it("saves and reopens a typed text section with paragraphs, lists and links", async () => {
    let server = detail
    const client = clientMock()
    client.get.mockImplementation(async () => server)
    client.patch.mockImplementation(async (_path: string, body: { sections: NonNullable<CmsNodeDetail["currentRevision"]>["sections"] }) => {
      server = { ...server, node: { ...server.node, version: server.node.version + 1 }, currentRevision: { ...server.currentRevision!, sections: body.sections } }
      return server
    })
    const repository = new ApiCmsRepository(client as never)
    const editor = await repository.getEditor(ids.node, "landing")
    const section = createEditorialSection()
    section.editorialConfig = { heading: "О семейном отдыхе", lead: "Приезжайте вместе.", blocks: [
      { type: "paragraph", text: "Живой текст страницы." },
      { type: "list", items: ["Домики", "Программы"] },
    ], links: [{ label: "Домики", href: "/domiki" }] }
    const saved = await repository.saveEditor({ ...editor, sections: [section] }, editor.version)
    expect(saved.sections[0]?.editorialConfig).toEqual(section.editorialConfig)
    expect(client.patch.mock.calls[0]?.[1].sections[0]).toMatchObject({ key: "body", renderer: "editorial-content", policy: editorialPolicy(section.editorialConfig) })
    expect((await repository.getEditor(ids.node, "landing")).sections[0]?.editorialConfig).toEqual(section.editorialConfig)
  })

  it("keeps an unsupported text patch opaque when saving another field", async () => {
    const opaque = { id: ids.node2, key: "body", renderer: "editorial-content", rendererVersion: "1", schemaVersion: 1, order: 10, policy: { mode: "override" as const, patch: { scalars: {}, objects: { blocks: { operation: "merge" as const, values: {} } }, keyedArrays: {} } } }
    const server = { ...detail, currentRevision: { ...detail.currentRevision!, sections: [opaque] } }
    const client = clientMock()
    client.get.mockResolvedValueOnce(server)
    client.patch.mockResolvedValueOnce(server)
    const repository = new ApiCmsRepository(client as never)
    const editor = await repository.getEditor(ids.node, "landing")
    expect(editor.sections[0]?.editorialUnsupported).toBe(true)
    await repository.saveEditor({ ...editor, publicTitle: "Новый заголовок" }, editor.version)
    expect(client.patch.mock.calls[0]?.[1].sections).toEqual([opaque])
  })

  it("sends an exact active-release guard when unpublishing", async () => {
    const client = clientMock()
    client.post.mockResolvedValue({ unpublishedPath: "/family", publicationId: ids.node2, publicationVersion: 8, unpublishedAt: "2026-09-27T10:00:00.000Z" })
    const status = { active: true, path: "/family", revisionId: ids.node2, activeReleaseId: ids.node, activeReleaseVersion: 7 }
    await new ApiCmsRepository(client as never).unpublish(ids.node, 3, status)
    expect(client.post).toHaveBeenCalledWith(`/content/nodes/${ids.node}/unpublish`, expect.objectContaining({
      expectedVersion: 3, baseReleaseId: ids.node, expectedActiveReleaseVersion: 7, expectedPublishedRevisionId: ids.node2,
    }), expect.anything())
  })

  it("maps the bounded site-wide aggregate without inventing source or page dimensions", async () => {
    const client = clientMock()
    client.get.mockResolvedValueOnce({ uniqueVisitors: 7, items: [
      { period: "2026-08-14", pageNodeId: null, sectionKey: null, pageViews: 7, uniqueVisitors: 5, actions: 3, leads: 2, bookings: 1, payments: 1 },
      { period: "2026-08-15", pageNodeId: null, sectionKey: null, pageViews: 11, uniqueVisitors: 6, actions: 4, leads: 1, bookings: 1, payments: 0 },
    ] })
    const repository = new ApiCmsRepository(client as never)

    await expect(repository.getAnalytics()).resolves.toMatchObject({
      visitors: 7, views: 18, leads: 3, bookings: 2, paid: 1,
      series: [
        { period: "2026-08-14", visitors: 5, views: 7, actions: 3, leads: 2, bookings: 1, paid: 1 },
        { period: "2026-08-15", visitors: 6, views: 11, actions: 4, leads: 1, bookings: 1, paid: 0 },
      ],
      channels: [{ name: "Все источники", value: 7, percent: 100 }],
      pages: [{ path: "Все страницы", views: 18, cta: 7, leads: 3 }],
    })
    const [path, parser] = client.get.mock.calls[0] as [string, unknown]
    expect(path).toMatch(/^\/analytics\/aggregates\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}&interval=day$/)
    expect(parser).toBe(AnalyticsAggregateResponseSchema)
  })

  it("preserves analytics API errors instead of falling back to fixtures", async () => {
    const failure = new AdminApiError({ code: "AUTHORIZATION_DENIED", message: "Нет доступа", details: {} }, 403, "PERMISSION_DENIED")
    const client = clientMock()
    client.get.mockRejectedValueOnce(failure)

    await expect(new ApiCmsRepository(client as never).getAnalytics()).rejects.toBe(failure)
    expect(client.get).toHaveBeenCalledOnce()
  })

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
      productionRelease: "REL-7", publishedAt: "2026-09-01T10:00:00.000Z", drafts: 2,
      metrics: [
        { id: "pages", label: "Страницы", value: "4", detail: "3 в production" },
        { id: "seo", label: "SEO-качество", value: "3 / 4", detail: "1 страниц с рисками" },
        { id: "media", label: "Медиа", value: "8", detail: "0 файлов в обработке" },
        { id: "release", label: "Черновики", value: "2", detail: "1 на проверке" },
      ], attention: [], activity: [{ id: "change-1", actor: "Марина", action: "обновил", target: "Главная", when: "2026-09-01T09:00:00.000Z", status: "draft" }],
    })
    const repository = new ApiCmsRepository(client as never)

    const result = await repository.getDashboard()

    expect(client.get).toHaveBeenCalledWith("/dashboard", expect.anything())
    expect(result).toMatchObject({ productionRelease: "REL-7", drafts: 2 })
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

  it("keeps the current draft separate from its publication history", async () => {
    const published = { ...listItem(detail).currentRevision!, id: ids.revision2, revision: 3, state: "published" as const }
    const client = clientMock()
    client.get.mockResolvedValueOnce({ items: [{ ...listItem(detail), latestPublished: published }], nextCursor: null })
    const repository = new ApiCmsRepository(client as never)

    await expect(repository.getNodes()).resolves.toMatchObject([{ status: "draft", hasPublishedRevision: true }])
    client.get.mockResolvedValueOnce({ ...detail, latestPublished: published })
    await expect(repository.getEditor(ids.node, "landing")).resolves.toMatchObject({ status: "draft", reviewLabel: "Редакция 3 публиковалась" })
  })

  it("uses the server page kind even when the requested editor route says landing", async () => {
    const client = clientMock()
    client.get.mockResolvedValueOnce({ ...detail, node: { ...detail.node, kind: "resource_detail" } })

    await expect(new ApiCmsRepository(client as never).getEditor(ids.node, "landing")).resolves.toMatchObject({ id: ids.node, kind: "profile" })
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

  it("preserves extended hero fields and stable action IDs while editing supported hero copy", async () => {
    const hero = {
      mode: "override" as const,
      config: {
        variant: "fullscreen" as const, eyebrow: "До города 20 минут", title: "Старый hero", subtitle: "Описание",
        backgroundAssetId: ids.node, foregroundAssetId: ids.node2,
        background: { assetId: ids.node, alt: "Лес", variants: [{ url: "/media/hero.webp", format: "webp" as const, width: 1600, height: 900 }] },
        foreground: { assetId: ids.node2, alt: "Дом", variants: [{ url: "/media/house.webp", format: "webp" as const, width: 600, height: 800 }] },
        overlay: "soft" as const, align: "left" as const,
        actions: [
          { id: ids.revision, label: "Смотреть", href: "/old", target: "_blank" as const, style: "primary" as const, enabled: true },
          { id: ids.revision2, label: "Подробнее", href: "/details", target: "_self" as const, style: "link" as const, enabled: true },
        ],
        slides: [{ id: ids.revision, imageAssetId: ids.node, image: null, title: "Зима", tagline: "Тихо", focalPoint: { x: 0.2, y: 0.8 } }],
        badge: { label: "Новинка", icon: "star" },
        featureCards: [{ id: ids.revision2, imageAssetId: ids.node2, image: null, title: "Домики", description: "Уютно", href: "/houses", target: "_blank" as const }],
        autoplayMs: 5000,
      },
    }
    const server = { ...detail, currentRevision: { ...detail.currentRevision!, hero } }
    const client = clientMock()
    client.get.mockResolvedValueOnce(server)
    client.patch.mockImplementation(async (_path: string, body: { hero: typeof hero }) => ({ ...server, currentRevision: { ...server.currentRevision!, hero: body.hero } }))
    const repository = new ApiCmsRepository(client as never)
    const editor = await repository.getEditor(ids.node, "landing")

    await repository.saveEditor({ ...editor, hero: { ...editor.hero, title: "Новый hero", primaryCtaTarget: "/new" } }, editor.version)

    const savedHero = client.patch.mock.calls[0]?.[1].hero
    expect(savedHero.config).toMatchObject({
      variant: "fullscreen", title: "Новый hero", background: hero.config.background, foreground: hero.config.foreground,
      slides: hero.config.slides, badge: hero.config.badge, featureCards: hero.config.featureCards, autoplayMs: 5000,
    })
    expect(savedHero.config.actions).toEqual([
      { ...hero.config.actions[0], href: "/new" },
      hero.config.actions[1],
    ])
  })

  it.each([
    ["only secondary/link actions", [
      { id: ids.revision, label: "Вторичная", href: "/secondary", target: "_blank" as const, style: "secondary" as const, enabled: true },
      { id: ids.revision2, label: "Текстовая", href: "/more", target: "_self" as const, style: "link" as const, enabled: true },
    ]],
    ["no actions", []],
  ])("keeps null media/copy and %s unchanged during an unrelated save", async (_label, actions) => {
    const hero = { mode: "override" as const, config: {
      variant: "compact" as const, eyebrow: null, title: "Hero", subtitle: null,
      backgroundAssetId: null, foregroundAssetId: null, background: null, foreground: null,
      overlay: "none" as const, align: "center" as const, actions,
      slides: [], badge: null, featureCards: [], autoplayMs: null,
    } }
    const server = { ...detail, currentRevision: { ...detail.currentRevision!, hero } }
    const client = clientMock()
    client.get.mockResolvedValueOnce(server)
    client.patch.mockResolvedValueOnce(server)
    const repository = new ApiCmsRepository(client as never)
    const editor = await repository.getEditor(ids.node, "landing")

    await repository.saveEditor({ ...editor, publicTitle: "Изменён только H1 страницы" }, editor.version)

    expect(client.patch.mock.calls[0]?.[1].hero).toEqual(hero)
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
    expect(navigation.hasPublishedRevision).toBe(false)

    const saved = await repository.saveNavigation({ ...navigation, header: [] }, navigation.version)

    expect(saved.header).toEqual([])
    expect(client.patch).toHaveBeenCalledWith("/site-settings", expect.objectContaining({
      expectedVersion: 3,
      value: expect.objectContaining({ siteName: "Свистоплясово", headerNavigation: [], footerNavigation: expect.any(Array) }),
    }), expect.anything())
  })

  it("edits only the site name in the shared settings draft and publishes its saved version", async () => {
    const settings = siteSettingsDetail()
    const current = { ...settings, draft: { ...settings.draft!, value: { ...settings.draft!.value,
      headerCta: { label: "Заявка", link: { kind: "internal" as const, path: "/contacts" }, enabled: true },
      sectionDefaults: [],
    } } }
    const saved = { ...current, version: 4, draft: { ...current.draft, revision: 3, value: { ...current.draft.value, siteName: "Новое название" } } }
    const published = { ...saved, version: 5, draft: null, published: { ...saved.draft, state: "published" as const } }
    const client = clientMock()
    client.get.mockResolvedValueOnce(current)
    client.patch.mockResolvedValueOnce(saved)
    client.post.mockResolvedValueOnce(published)
    const repository = new ApiCmsRepository(client as never)

    expect((await repository.getSiteSettings()).draft?.value.siteName).toBe("Свистоплясово")
    expect((await repository.saveSiteName("Новое название", 3)).draft?.value.siteName).toBe("Новое название")
    expect(client.patch).toHaveBeenCalledWith("/site-settings", expect.objectContaining({ expectedVersion: 3,
      value: expect.objectContaining({ siteName: "Новое название", headerNavigation: current.draft.value.headerNavigation, headerCta: current.draft.value.headerCta }),
    }), expect.anything())
    expect((await repository.publishSiteSettings(4)).published?.value.siteName).toBe("Новое название")
    expect(client.post).toHaveBeenCalledWith("/site-settings/publish", expect.objectContaining({ expectedVersion: 4 }), expect.anything())
  })

  it("reports previous navigation publication separately from the current draft", async () => {
    const settings = siteSettingsDetail()
    const client = clientMock()
    client.get.mockResolvedValueOnce({ ...settings, published: { ...settings.draft!, state: "published", id: ids.revision, revision: 1 } })

    await expect(new ApiCmsRepository(client as never).getNavigation()).resolves.toMatchObject({ status: "draft", hasPublishedRevision: true })
  })

  it("shows other site-setting changes which a menu publication would include", async () => {
    const settings = siteSettingsDetail()
    const client = clientMock()
    client.get.mockResolvedValueOnce({
      ...settings,
      draft: { ...settings.draft!, value: { ...settings.draft!.value, headerCta: { label: "Оставить заявку", link: { kind: "internal", path: "/contacts" }, enabled: true } } },
      published: { ...settings.draft!, id: ids.revision, state: "published", revision: 1, value: { ...settings.draft!.value, siteName: "Старое название" } },
    })

    const navigation = await new ApiCmsRepository(client as never).getNavigation()

    expect(navigation.otherDraftChanges).toEqual(["Название сайта", "Кнопка в шапке"])
  })

  it("preserves navigation target and device visibility and rejects silent truncation", async () => {
    const navigationItem = { ...siteSettingsDetail().draft!.value.headerNavigation[0]!, target: "_blank" as const, visibleOn: "mobile" as const, icon: null, color: null }
    const baseSettings = siteSettingsDetail()
    const settings = { ...baseSettings, draft: { ...baseSettings.draft!, value: { ...baseSettings.draft!.value, headerNavigation: [navigationItem] } } }
    const client = clientMock()
    client.get.mockResolvedValueOnce(settings)
    client.patch.mockResolvedValueOnce(settings)
    const repository = new ApiCmsRepository(client as never)
    const navigation = await repository.getNavigation()

    await repository.saveNavigation({ ...navigation, header: navigation.header.map((item) => ({ ...item, label: "Изменено" })) }, navigation.version)

    expect(client.patch.mock.calls[0]?.[1].value.headerNavigation[0]).toMatchObject({ target: "_blank", visibleOn: "mobile", icon: null, color: null, label: "Изменено", id: navigationItem.id })
    const tooMany = Array.from({ length: 31 }, (_, index) => ({ ...navigation.header[0]!, id: `${navigation.header[0]!.id}-${index}` }))
    await expect(repository.saveNavigation({ ...navigation, header: tooMany }, navigation.version)).rejects.toThrow("больше 30")
    expect(client.patch).toHaveBeenCalledOnce()
  })

  it.each(["", " ", "#", "/domiki#", "/domiki#faq#extra", "/domiki?view=all", "javascript:alert(1)"])("rejects invalid navigation href %j before saving", async (href) => {
    const client = clientMock()
    client.get.mockResolvedValueOnce(siteSettingsDetail())
    const repository = new ApiCmsRepository(client as never)
    const navigation = await repository.getNavigation()

    await expect(repository.saveNavigation({ ...navigation, header: [{ ...navigation.header[0]!, href }] }, navigation.version)).rejects.toThrow()

    expect(client.patch).not.toHaveBeenCalled()
  })

  it("keeps an explicit anchor-only navigation link", async () => {
    const settings = siteSettingsDetail()
    const client = clientMock()
    client.get.mockResolvedValueOnce(settings)
    client.patch.mockResolvedValueOnce(settings)
    const repository = new ApiCmsRepository(client as never)
    const navigation = await repository.getNavigation()

    await repository.saveNavigation({ ...navigation, header: [{ ...navigation.header[0]!, href: "#booking" }] }, navigation.version)

    expect(client.patch.mock.calls[0]?.[1].value.headerNavigation[0].link).toEqual({ kind: "internal", path: "/", anchor: "booking" })
  })

  it("round-trips media metadata fields which are not shown by the current form", async () => {
    const asset = { ...wireMediaAsset(), license: null }
    const client = clientMock()
    client.get.mockResolvedValueOnce({ asset, usages: [], usageTotal: 0, usagesTruncated: false })
    client.patch.mockResolvedValueOnce({ asset: { ...asset, title: "Новое название" }, usages: [], usageTotal: 0, usagesTruncated: false })
    const repository = new ApiCmsRepository(client as never)
    const editorAsset = await repository.getAsset(asset.id)

    await repository.saveMediaMetadata({ ...editorAsset, title: "Новое название" })

    expect(client.patch).toHaveBeenCalledWith(`/media/assets/${asset.id}`, expect.objectContaining({
      title: "Новое название", caption: asset.caption, credit: asset.credit, license: null, tags: asset.tags, focalPoint: asset.focalPoint,
    }), expect.anything())
  })
})

describe("analyticsRecentDateRange", () => {
  it("uses the Moscow calendar date and returns 30 inclusive days", () => {
    expect(analyticsRecentDateRange(new Date("2026-09-11T21:30:00.000Z"))).toEqual({
      from: "2026-08-14",
      to: "2026-09-12",
    })
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

function wireMediaAsset() {
  return {
    id: ids.node, version: 4, kind: "image" as const, state: "ready" as const, title: "Hero", alt: "Лес",
    caption: "Подпись", credit: "Автор", license: "Собственное фото", tags: ["hero", "summer"], focalPoint: { x: 0.25, y: 0.75 },
    originalFilename: "hero.jpg", mimeType: "image/jpeg", byteSize: 1200, width: 1600, height: 900, variants: [],
    usageCount: 0, publishedUsage: false, archivedAt: null, createdAt: "2026-08-31T08:00:00.000Z", updatedAt: "2026-08-31T09:00:00.000Z",
  }
}
