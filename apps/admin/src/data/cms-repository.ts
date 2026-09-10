import { CmsNodeDetailSchema, CmsNodeListResponseSchema, CmsNodePublishResultSchema, type CmsHeroPolicy, type CmsNodeDetail, type CmsNodeRevision, type CmsPageKind, type CmsSection } from "@crm/contracts/content"
import { CmsDashboardResponseSchema } from "@crm/contracts/cms-dashboard"
import { SessionUserSchema } from "@crm/contracts/auth"
import { CmsSiteSettingsDetailSchema, type CmsSiteSettingsDetail, type CmsSiteSettingsValue } from "@crm/contracts"
import { MediaAssetDetailSchema, MediaAssetListResponseSchema, MediaAssetSchema, MediaUploadGrantSchema, type MediaAsset as WireMediaAsset } from "@crm/contracts"

import type { CmsAccess, CmsNodeQuery, CmsRepository, ContentNode, ContentStatus, EditorRecord, HeroConfig, PublicNavigation, PublicNavigationItem } from "@admin/entities/cms"
import { CmsConflictError, CmsUnavailableError } from "@admin/entities/cms"
import { analyticsFixture, codeArtifactFixture, dashboardFixture, editorFixtures, mediaFixtures, navigationFixture, nodeFixtures, releaseFixtures } from "@admin/fixtures/cms"
import { AdminApiError, createAdminApiClient, type AdminApiClient } from "@admin/lib/api-client"
import { cmsDataMode } from "@admin/lib/data-mode"
import { isPartnersRenderer, partnersDraft, partnersPolicy } from "./partners-section"
import { isWhyUsRenderer, whyUsDraft, whyUsPolicy } from "./why-us-section"

const clone = <T,>(value: T): T => structuredClone(value)
const pause = () => new Promise<void>((resolve) => window.setTimeout(resolve, 120))
const fixtureAccess: CmsAccess = { canViewContent: true, canEditContent: true, canReviewContent: true, canPublishContent: true }

export class FixtureCmsRepository implements CmsRepository {
  readonly mode = "fixtures" as const
  private editors = clone(editorFixtures)
  private navigation = clone(navigationFixture)

  async getAccess() { return fixtureAccess }
  async getDashboard() { await pause(); return clone(dashboardFixture) }
  async getNodes(query: CmsNodeQuery = {}) { await pause(); return clone(nodeFixtures).filter((node) => (!query.q || `${node.title} ${node.path}`.toLocaleLowerCase("ru-RU").includes(query.q.toLocaleLowerCase("ru-RU"))) && (!query.status || (query.status === "archived" ? node.status === "archived" : node.status !== "archived"))) }
  async getEditor(id: string, kind: EditorRecord["kind"]) {
    await pause()
    if (id === "new") return clone(blankEditor(kind))
    const fallbackId = kind === "home" ? "home" : kind === "category" ? "houses" : kind === "profile" ? "house-lesnoy" : "landing-family"
    const record = this.editors[id] ?? this.editors[fallbackId]
    if (!record) throw new Error("Запись не найдена")
    return { ...clone(record), id, kind, internalName: record.internalName, status: record.status, hasPublishedRevision: record.hasPublishedRevision ?? record.status === "published" }
  }
  async saveEditor(record: EditorRecord, expectedVersion: number) {
    await pause()
    const current = this.editors[record.id]
    if (current && current.version !== expectedVersion) throw new CmsConflictError(current.version)
    const savedId = record.id === "new" ? `fixture-${Date.now()}` : record.id
    const saved = { ...clone(record), id: savedId, version: expectedVersion + 1, revision: (record.revision ?? expectedVersion) + 1, updatedLabel: "только что" }
    this.editors[savedId] = saved
    return clone(saved)
  }
  async submitReview(id: string, expectedVersion: number) { return this.transitionFixture(id, expectedVersion, "review") }
  async returnToDraft(id: string, expectedVersion: number) { return this.transitionFixture(id, expectedVersion, "draft") }
  async approve(id: string, expectedVersion: number) { return this.transitionFixture(id, expectedVersion, "approved") }
  async archive(id: string, expectedVersion: number) { return this.transitionFixture(id, expectedVersion, "archived") }
  async publish(id: string, expectedVersion: number) { return this.transitionFixture(id, expectedVersion, "published") }
  async getNavigation() { await pause(); return clone(this.navigation) }
  async saveNavigation(value: PublicNavigation, expectedVersion: number) {
    await pause()
    if (this.navigation.version !== expectedVersion) throw new CmsConflictError(this.navigation.version)
    this.navigation = { ...clone(value), version: expectedVersion + 1, status: "draft", updatedLabel: "только что" }
    return clone(this.navigation)
  }
  async publishNavigation(expectedVersion: number) {
    await pause()
    if (this.navigation.version !== expectedVersion) throw new CmsConflictError(this.navigation.version)
    this.navigation = { ...this.navigation, version: expectedVersion + 1, status: "published", updatedLabel: "только что" }
    return clone(this.navigation)
  }
  async getMedia() { await pause(); return clone(mediaFixtures) }
  async getAsset(id: string) { await pause(); const asset = mediaFixtures.find((item) => item.id === id); if (!asset) throw new Error("Ассет не найден"); return clone(asset) }
  async uploadMedia(file: File) { await pause(); const asset = { id: `fixture-${Date.now()}`, version: 1, title: file.name.replace(/\.[^.]+$/, ""), filename: file.name, status: "ready" as const, progress: 100, dimensions: "—", size: formatBytes(file.size), usageCount: 0, publishedUsage: false, alt: "", license: "Не указана", dominant: "#66705a" }; mediaFixtures.unshift(asset); return clone(asset) }
  async saveMediaMetadata(asset: import("@admin/entities/cms").MediaAsset) { const index = mediaFixtures.findIndex((item) => item.id === asset.id); if (index >= 0) mediaFixtures[index] = clone(asset); return clone(asset) }
  async archiveMedia(id: string) { const asset = await this.getAsset(id); const archived = { ...asset, status: "archived" as const, version: (asset.version ?? 1) + 1 }; const index = mediaFixtures.findIndex((item) => item.id === id); if (index >= 0) mediaFixtures[index] = archived; return clone(archived) }
  async getReleases() { await pause(); return clone(releaseFixtures) }
  async getRelease(id: string) { await pause(); const release = releaseFixtures.find((item) => item.id === id) ?? releaseFixtures[0]; if (!release) throw new Error("Релиз не найден"); return clone(release) }
  async getAnalytics() { await pause(); return clone(analyticsFixture) }
  async getCodeArtifact() { await pause(); return clone(codeArtifactFixture) }

  private async transitionFixture(id: string, expectedVersion: number, revisionState: "draft" | "review" | "approved" | "published" | "archived") {
    await pause()
    const current = this.editors[id]
    if (!current) throw new Error("Запись не найдена")
    if (current.version !== expectedVersion) throw new CmsConflictError(current.version)
    const status: ContentStatus = revisionState === "approved" ? "review" : revisionState
    const saved = { ...current, revisionState, status, version: current.version + 1, updatedLabel: "только что" }
    this.editors[id] = saved
    return clone(saved)
  }
}

export class ApiCmsRepository implements CmsRepository {
  readonly mode = "api" as const
  private readonly details = new Map<string, CmsNodeDetail>()
  private settingsDetail?: CmsSiteSettingsDetail

  constructor(private readonly client: AdminApiClient = createAdminApiClient()) {}

  async getAccess(): Promise<CmsAccess> {
    const { user } = await this.client.get("/auth/session", sessionResponseParser)
    return { canViewContent: user.capabilities.canViewContent === true, canEditContent: user.capabilities.canEditContent === true, canReviewContent: user.capabilities.canReviewContent === true, canPublishContent: user.capabilities.canPublishContent === true }
  }

  async getNodes(query: CmsNodeQuery = {}): Promise<ContentNode[]> {
    const pages = await this.listWire(query)
    const nodes = pages.map((item) => this.node(item))
    const byId = new Map(nodes.map((node) => [node.id, node]))
    for (const node of nodes) if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node.id)
    return nodes
  }

  async getEditor(id: string, kind: EditorRecord["kind"]): Promise<EditorRecord> {
    if (id === "new") return blankEditor(kind)
    let nodeId = id
    if (kind === "home" && !isUuid(id)) {
      const home = (await this.listWire({ kind: "home" }))[0]
      if (!home) throw new CmsUnavailableError("Главная страница не создана")
      nodeId = home.node.id
    }
    const detail = await this.client.get(`/content/nodes/${encodeURIComponent(nodeId)}`, CmsNodeDetailSchema)
    this.details.set(detail.node.id, detail)
    return this.editor(detail, kind)
  }

  async saveEditor(record: EditorRecord, expectedVersion: number): Promise<EditorRecord> {
    try {
      if (record.id === "new") {
        const detail = await this.client.post("/content/nodes", {
          ...operationMeta(), kind: apiKind(record.kind),
          route: { path: record.url, slug: record.kind === "home" ? "home" : record.slug, parentNodeId: record.parentNodeId ?? null, sortOrder: record.sortOrder ?? 10 },
          title: record.publicTitle, summary: record.description || null, hero: heroPolicy(record.hero), sections: mergeSectionModes([], record.sections),
          seo: { title: record.seoTitle, description: record.seoDescription, indexPolicy: record.indexPolicy, canonical: { mode: "self" }, structuredData: [] },
          relations: [], schemaVersion: 1,
        }, CmsNodeDetailSchema)
        this.details.set(detail.node.id, detail)
        return this.editor(detail, record.kind)
      }
      const current = this.details.get(record.id) ?? await this.client.get(`/content/nodes/${encodeURIComponent(record.id)}`, CmsNodeDetailSchema)
      const revision = editableRevision(current)
      const route = { path: record.url, slug: record.kind === "home" ? "home" : record.slug, parentNodeId: record.parentNodeId ?? null, sortOrder: record.sortOrder ?? 10 }
      const baseline = this.editor(current, record.kind)
      const contentChanged = !sameEditorContent(record, baseline)
      const detail = await this.client.patch(`/content/nodes/${encodeURIComponent(record.id)}`, contentChanged ? {
        ...operationMeta(), expectedVersion, route,
        title: record.publicTitle, summary: record.description || null,
        hero: heroPolicy(record.hero), sections: mergeSectionModes(revision.sections, record.sections),
        seo: { ...revision.seo, title: record.seoTitle, description: record.seoDescription, indexPolicy: record.indexPolicy },
        relations: revision.relations,
      } : { ...operationMeta(), expectedVersion, route }, CmsNodeDetailSchema)
      this.details.set(detail.node.id, detail)
      return this.editor(detail, record.kind)
    } catch (error) { throw mapMutationError(error) }
  }

  submitReview(id: string, expectedVersion: number) { return this.transition(id, expectedVersion, "submit-review") }
  returnToDraft(id: string, expectedVersion: number) { return this.transition(id, expectedVersion, "return-to-draft") }
  approve(id: string, expectedVersion: number) { return this.transition(id, expectedVersion, "approve") }
  archive(id: string, expectedVersion: number) { return this.transition(id, expectedVersion, "archive") }

  async publish(id: string, expectedVersion: number): Promise<EditorRecord> {
    try {
      const current = this.details.get(id) ?? await this.client.get(`/content/nodes/${encodeURIComponent(id)}`, CmsNodeDetailSchema)
      await this.client.post(`/content/nodes/${encodeURIComponent(id)}/publish`, { ...operationMeta(), expectedVersion }, CmsNodePublishResultSchema)
      const detail = await this.client.get(`/content/nodes/${encodeURIComponent(id)}`, CmsNodeDetailSchema)
      this.details.set(id, detail)
      return this.editor(detail, localKind(current.node.kind))
    } catch (error) { throw mapMutationError(error) }
  }

  async getNavigation(): Promise<PublicNavigation> { const detail = await this.client.get("/site-settings", CmsSiteSettingsDetailSchema); this.settingsDetail = detail; return navigationFromDetail(detail) }
  async saveNavigation(value: PublicNavigation, expectedVersion: number): Promise<PublicNavigation> {
    try {
      const current = this.settingsDetail ?? await this.client.get("/site-settings", CmsSiteSettingsDetailSchema)
      const detail = await this.client.patch("/site-settings", { ...operationMeta(), expectedVersion, value: navigationValues(value, current) }, CmsSiteSettingsDetailSchema)
      this.settingsDetail = detail
      return navigationFromDetail(detail)
    }
    catch (error) { throw mapMutationError(error) }
  }
  async publishNavigation(expectedVersion: number): Promise<PublicNavigation> {
    try { const detail = await this.client.post("/site-settings/publish", { ...operationMeta(), expectedVersion }, CmsSiteSettingsDetailSchema); this.settingsDetail = detail; return navigationFromDetail(detail) }
    catch (error) { throw mapMutationError(error) }
  }

  async getDashboard(): Promise<import("@admin/entities/cms").CmsDashboard> {
    const dashboard = await this.client.get("/dashboard", CmsDashboardResponseSchema)
    return {
      productionRelease: dashboard.productionRelease ?? "Нет опубликованной версии",
      publishedAt: dashboard.publishedAt ? formatUpdated(dashboard.publishedAt) : "Пока не публиковали",
      drafts: dashboard.drafts,
      queueHealthy: dashboard.queueHealthy,
      metrics: dashboard.metrics.map(({ trend, ...metric }) => trend === undefined ? metric : { ...metric, trend }),
      attention: dashboard.attention,
      activity: dashboard.activity.map((item) => ({ ...item, when: formatUpdated(item.when) })),
      funnel: dashboard.funnel,
    }
  }
  async getMedia() { const response = await this.client.get("/media/assets?limit=100", MediaAssetListResponseSchema); return response.items.map((asset) => mediaView(asset)) }
  async getAsset(id: string) { const response = await this.client.get(`/media/assets/${encodeURIComponent(id)}`, MediaAssetDetailSchema); return mediaView(response.asset, response.usages) }
  async uploadMedia(file: File) {
    const bytes = await file.arrayBuffer()
    const checksumSha256 = [...new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes))].map((value) => value.toString(16).padStart(2, "0")).join("")
    const grant = await this.client.post("/media/uploads", { filename: file.name, mimeType: file.type || "application/octet-stream", byteSize: file.size, checksumSha256 }, MediaUploadGrantSchema)
    const response = await fetch(grant.uploadUrl, { method: grant.method, headers: grant.requiredHeaders, body: file })
    const payload = await response.json() as unknown
    if (!response.ok) throw new Error(payload && typeof payload === "object" && "message" in payload ? String(payload.message) : "Media upload failed")
    return mediaView(MediaAssetSchema.parse(payload))
  }
  async saveMediaMetadata(asset: import("@admin/entities/cms").MediaAsset) {
    const response = await this.client.patch(`/media/assets/${encodeURIComponent(asset.id)}`, { expectedVersion: asset.version ?? 1, title: asset.title, alt: asset.alt || null, caption: null, credit: null, license: asset.license || null, tags: [], focalPoint: { x: 0.5, y: 0.5 } }, MediaAssetDetailSchema)
    return mediaView(response.asset, response.usages)
  }
  async archiveMedia(id: string, expectedVersion: number) { const response = await this.client.post(`/media/assets/${encodeURIComponent(id)}/archive`, { expectedVersion }, MediaAssetDetailSchema); return mediaView(response.asset, response.usages) }
  async getReleases(): Promise<never> { throw new CmsUnavailableError("Releases") }
  async getRelease(): Promise<never> { throw new CmsUnavailableError("Release detail") }
  async getAnalytics(): Promise<never> { throw new CmsUnavailableError("Analytics") }
  async getCodeArtifact(): Promise<never> { throw new CmsUnavailableError("Code workspace") }

  private async transition(id: string, expectedVersion: number, action: "submit-review" | "return-to-draft" | "approve" | "archive") {
    try {
      const current = this.details.get(id) ?? await this.client.get(`/content/nodes/${encodeURIComponent(id)}`, CmsNodeDetailSchema)
      const detail = await this.client.post(`/content/nodes/${encodeURIComponent(id)}/${action}`, { ...operationMeta(), expectedVersion }, CmsNodeDetailSchema)
      this.details.set(id, detail)
      return this.editor(detail, localKind(current.node.kind))
    } catch (error) { throw mapMutationError(error) }
  }

  private async listWire(query: CmsNodeQuery) {
    const items: Awaited<ReturnType<typeof this.fetchPage>>["items"] = []
    let cursor: string | null = null
    for (let page = 0; page < 100; page += 1) {
      const response = await this.fetchPage(query, cursor)
      items.push(...response.items)
      cursor = response.nextCursor
      if (!cursor) return items
    }
    throw new Error("CMS API вернул cursor chain длиннее 100 страниц")
  }

  private fetchPage(query: CmsNodeQuery, cursor: string | null) {
    const params = new URLSearchParams({ limit: "100" })
    if (query.q) params.set("q", query.q)
    if (query.kind) params.set("kind", query.kind)
    if (query.status) params.set("status", query.status)
    if (cursor) params.set("cursor", cursor)
    return this.client.get(`/content/nodes?${params.toString()}`, CmsNodeListResponseSchema)
  }

  private node(item: Awaited<ReturnType<typeof this.fetchPage>>["items"][number]): ContentNode {
    const revision = item.currentRevision ?? item.latestPublished
    const status = item.node.status === "archived" ? "archived" : contentStatus(revision?.state)
    const importedDraft = item.source !== null
    return {
      id: item.node.id, title: revision?.title ?? "Без названия", path: revision?.route.path ?? "—", type: localNodeType(item.node.kind), status,
      pageKind: item.node.kind, sortOrder: revision?.route.sortOrder ?? 0, quality: status === "draft" || status === "review" ? "warning" : "ok", parentId: revision?.route.parentNodeId ?? null, children: [],
      owner: importedDraft ? "Синхронизация CRM" : revision?.createdBy ? `ID ${revision.createdBy.slice(0, 8)}` : "CMS", updatedLabel: formatUpdated(item.node.updatedAt), inboundLinks: null, mediaCount: null,
      source: importedDraft ? "CRM" : "CMS", ...(item.source ? { sourceKind: item.source.sourceKind } : {}), importedDraft,
    }
  }

  private editor(detail: CmsNodeDetail, requestedKind?: EditorRecord["kind"]): EditorRecord {
    const revision = editableRevision(detail)
    const kind = requestedKind ?? localKind(detail.node.kind)
    return {
      id: detail.node.id, kind, internalName: revision.title, publicTitle: revision.title, slug: revision.route.path === "/" ? "" : revision.route.slug,
      parent: revision.route.parentNodeId ? `Node ${revision.route.parentNodeId.slice(0, 8)}` : "Корень сайта", parentNodeId: revision.route.parentNodeId, sortOrder: revision.route.sortOrder, hasPublishedRevision: detail.latestPublished !== null, url: revision.route.path,
      status: detail.node.status === "archived" ? "archived" : contentStatus(revision.state), revisionState: revision.state, version: detail.node.version, revision: revision.revision,
      owner: detail.source ? "Синхронизация CRM" : revision.createdBy ? `ID ${revision.createdBy.slice(0, 8)}` : "CMS", source: detail.source ? "CRM" : "CMS", updatedLabel: formatUpdated(detail.node.updatedAt),
      reviewLabel: detail.latestPublished ? `Опубликована версия ${detail.latestPublished.revision}` : "Ещё не опубликовано", seoChecks: seoChecks(revision),
      sections: revision.sections.map((section) => {
        const partnersConfig = partnersDraft(section)
        const whyUsConfig = whyUsDraft(section)
        const partners = section.key === "partners"
        const whyUs = section.key === "why-us"
        const own = section.policy.mode === "override"
        return {
          id: section.id, key: section.key, label: partners ? "Партнёры" : whyUs ? "Why us" : section.key,
          description: `${section.renderer} · schema ${section.schemaVersion}`, mode: section.policy.mode,
          source: partners || whyUs ? own ? "Эта страница" : "Источник наследования" : "Global defaults",
          sourceHref: partners || whyUs ? own ? "?tab=composition" : "/content/tree" : "/globals/sections",
          effectiveTitle: (partners || whyUs) && !own ? "Содержимое источника пока недоступно в предпросмотре" : whyUsConfig?.title ?? partnersConfig?.title ?? section.key,
          ...(partnersConfig ? { partnersConfig } : {}),
          ...(whyUsConfig ? { whyUsConfig } : {}),
        }
      }),
      description: revision.summary ?? "", seoTitle: revision.seo.title, seoDescription: revision.seo.description, indexPolicy: revision.seo.indexPolicy,
      hero: heroFromRevision(revision), importedFromCrm: detail.source !== null,
    }
  }
}

function editableRevision(detail: CmsNodeDetail): CmsNodeRevision { if (!detail.currentRevision) throw new CmsUnavailableError("Editable revision"); return detail.currentRevision }
function mergeSectionModes(sections: CmsSection[], local: EditorRecord["sections"]): CmsSection[] {
  const byId = new Map(local.map((section) => [section.id, section]))
  const result = sections.map((section): CmsSection => {
    const edited = byId.get(section.id)
    const mode = edited?.mode ?? section.policy.mode
    if (mode !== "override") return { ...section, policy: { mode } }
    if (edited?.partnersConfig && isPartnersRenderer(section) && JSON.stringify(edited.partnersConfig) !== JSON.stringify(section.policy.mode === "override" ? partnersDraft(section) : null)) {
      return { ...section, policy: partnersPolicy(edited.partnersConfig) }
    }
    if (edited?.whyUsConfig && isWhyUsRenderer(section) && JSON.stringify(edited.whyUsConfig) !== JSON.stringify(section.policy.mode === "override" ? whyUsDraft(section) : null)) {
      return { ...section, policy: whyUsPolicy(edited.whyUsConfig) }
    }
    return { ...section, policy: section.policy.mode === "override" ? section.policy : { mode: "override", patch: { scalars: {}, objects: {}, keyedArrays: {} } } }
  })
  for (const section of local) {
    if (sections.some((existing) => existing.id === section.id)) continue
    if (section.key === "partners" && section.partnersConfig) {
      if (result.some((existing) => existing.key === "partners")) throw new Error("Секция партнёров уже существует")
      result.push({ id: section.id, key: "partners", renderer: "partners", rendererVersion: "1", schemaVersion: 1,
        order: Math.min(100000, Math.max(0, ...result.map((existing) => existing.order)) + 10),
        policy: section.mode === "override" ? partnersPolicy(section.partnersConfig) : { mode: section.mode },
      })
    }
    if (section.key === "why-us" && section.whyUsConfig) {
      if (result.some((existing) => existing.key === "why-us")) throw new Error("Секция Why us уже существует")
      result.push({ id: section.id, key: "why-us", renderer: "why-us", rendererVersion: "1", schemaVersion: 1,
        order: Math.min(100000, Math.max(0, ...result.map((existing) => existing.order)) + 10),
        policy: section.mode === "override" ? whyUsPolicy(section.whyUsConfig) : { mode: section.mode },
      })
    }
  }
  return result
}

function heroFromRevision(revision: CmsNodeRevision): HeroConfig {
  const config = revision.hero.mode === "override" ? revision.hero.config : null
  const primary = config?.actions.find((action) => action.style === "primary") ?? config?.actions[0]
  const secondary = config?.actions.find((action) => action.style === "secondary")
  const focal = config?.slides[0]?.focalPoint.x ?? 0.5
  return {
    mode: revision.hero.mode, eyebrow: config?.eyebrow ?? "Свистоплясово", title: config?.title ?? revision.title,
    description: config?.subtitle ?? revision.summary ?? "", primaryCtaLabel: primary?.label ?? "Подобрать отдых",
    primaryCtaTarget: primary?.href ?? "#booking", secondaryCtaLabel: secondary?.label ?? "", secondaryCtaTarget: secondary?.href ?? "",
    desktopImage: config?.backgroundAssetId ?? "", mobileImage: config?.foregroundAssetId ?? "",
    overlay: config?.overlay === "none" ? 0 : config?.overlay === "soft" ? 25 : config?.overlay === "strong" ? 70 : 45,
    focalPosition: focal < 0.34 ? "left" : focal > 0.66 ? "right" : "center", alignment: config?.align ?? "left",
  }
}

function heroPolicy(hero: HeroConfig): CmsHeroPolicy {
  if (hero.mode !== "override") return { mode: hero.mode }
  const backgroundAssetId = isUuid(hero.desktopImage) ? hero.desktopImage : null
  const foregroundAssetId = isUuid(hero.mobileImage) ? hero.mobileImage : null
  const actions = [
    ...(hero.primaryCtaLabel && hero.primaryCtaTarget ? [{ id: "00000000-0000-4000-8000-000000000101", label: hero.primaryCtaLabel, href: hero.primaryCtaTarget, target: "_self" as const, style: "primary" as const }] : []),
    ...(hero.secondaryCtaLabel && hero.secondaryCtaTarget ? [{ id: "00000000-0000-4000-8000-000000000102", label: hero.secondaryCtaLabel, href: hero.secondaryCtaTarget, target: "_self" as const, style: "secondary" as const }] : []),
  ]
  return { mode: "override", config: {
    variant: "default", eyebrow: hero.eyebrow || null, title: hero.title, subtitle: hero.description || null,
    backgroundAssetId, foregroundAssetId, background: null, foreground: null,
    overlay: hero.overlay <= 10 ? "none" : hero.overlay <= 35 ? "soft" : hero.overlay >= 60 ? "strong" : "medium",
    align: hero.alignment, actions, slides: [], badge: null, featureCards: [], autoplayMs: null,
  } }
}
function apiKind(kind: EditorRecord["kind"]): CmsPageKind { return kind === "profile" ? "resource_detail" : kind }
function localKind(kind: CmsPageKind): EditorRecord["kind"] { const type = localNodeType(kind); return type === "profile" ? "profile" : type }
function localNodeType(kind: CmsPageKind): ContentNode["type"] { if (kind === "home" || kind === "landing" || kind === "category" || kind === "article") return kind; if (kind.endsWith("_detail") || kind === "program_occurrence") return "profile"; if (kind.endsWith("_listing")) return "category"; return "landing" }
function contentStatus(state?: string): ContentStatus { return state === "review" || state === "approved" ? "review" : state === "scheduled" ? "scheduled" : state === "published" ? "published" : state === "archived" ? "archived" : state === "draft" ? "draft" : "failed" }
function seoChecks(revision: CmsNodeRevision) { const warnings = Number(revision.seo.title.length > 60) + Number(revision.seo.description.length > 160); return { passed: 4 - warnings, warnings, blockers: 0 } }
function operationMeta() { const id = globalThis.crypto?.randomUUID?.() ?? fallbackUuid(); return { operationId: id, idempotencyKey: `cms-${id}` } }
function fallbackUuid() { return `00000000-0000-4000-8000-${Date.now().toString().padStart(12, "0").slice(-12)}` }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) }
function formatUpdated(value: string) { return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short" }).format(new Date(value)) }
function formatBytes(value: number) { if (value < 1024) return `${value} B`; if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`; return `${(value / 1024 / 1024).toFixed(1)} MB` }
function mediaView(asset: WireMediaAsset, usages: Array<{ ownerType: string; ownerId: string; pointer: string; published: boolean }> = []): import("@admin/entities/cms").MediaAsset {
  const status = asset.state === "failed" ? "error" : asset.state === "processing" ? "converting" : asset.state
  const preview = asset.variants.filter((variant) => variant.format === "webp").sort((left, right) => (left.width ?? 0) - (right.width ?? 0))[0]
  return {
    id: asset.id, version: asset.version, title: asset.title, filename: asset.originalFilename, status,
    progress: status === "ready" || status === "archived" ? 100 : status === "error" ? 0 : 55,
    dimensions: asset.width && asset.height ? `${asset.width}×${asset.height}` : "—", size: formatBytes(asset.byteSize),
    usageCount: asset.usageCount, publishedUsage: asset.publishedUsage, alt: asset.alt ?? "", license: asset.license ?? "Не указана",
    dominant: "#66705a", ...(preview ? { previewUrl: preview.url } : {}), variants: asset.variants, usages,
  }
}
function mapMutationError(error: unknown) { if (error instanceof AdminApiError && error.rawCode === "VERSION_CONFLICT") return new CmsConflictError(Number(error.details.serverVersion ?? 0), error.requestId); return error }
function blankEditor(kind: EditorRecord["kind"]): EditorRecord { return { id: "new", kind, internalName: "Без названия", publicTitle: "Новая страница", slug: "new-page", parent: "Корень сайта", parentNodeId: null, sortOrder: 10, hasPublishedRevision: false, url: "/new-page", status: "draft", version: 1, revision: 0, owner: "Текущий пользователь", source: "CMS", updatedLabel: "Не сохранено", reviewLabel: "Не опубликовано", seoChecks: { passed: 0, warnings: 2, blockers: 0 }, sections: [], hero: { mode: "inherit", eyebrow: "Свистоплясово", title: "Новая страница", description: "", primaryCtaLabel: "Подобрать отдых", primaryCtaTarget: "#booking", secondaryCtaLabel: "", secondaryCtaTarget: "", desktopImage: "", mobileImage: "", overlay: 45, focalPosition: "center", alignment: "left" }, description: "", seoTitle: "Новая страница", seoDescription: "Добавьте описание страницы для поисковых систем.", indexPolicy: "noindex_follow" } }

function sameEditorContent(left: EditorRecord, right: EditorRecord) {
  return JSON.stringify({ title: left.publicTitle, summary: left.description, hero: left.hero, sections: left.sections.map(({ id, mode, partnersConfig, whyUsConfig }) => ({ id, mode, partnersConfig, whyUsConfig })), seoTitle: left.seoTitle, seoDescription: left.seoDescription, indexPolicy: left.indexPolicy }) === JSON.stringify({ title: right.publicTitle, summary: right.description, hero: right.hero, sections: right.sections.map(({ id, mode, partnersConfig, whyUsConfig }) => ({ id, mode, partnersConfig, whyUsConfig })), seoTitle: right.seoTitle, seoDescription: right.seoDescription, indexPolicy: right.indexPolicy })
}

type WireNavigationItem = CmsSiteSettingsValue["headerNavigation"][number]
type WireNavigationChild = WireNavigationItem["children"][number]
type WireNavigationLeaf = WireNavigationChild["children"][number]
type WireNavigationAny = WireNavigationItem | WireNavigationChild | WireNavigationLeaf

function navigationFromDetail(detail: CmsSiteSettingsDetail): PublicNavigation {
  const revision = detail.draft ?? detail.published
  if (!revision) throw new CmsUnavailableError("Настройки сайта")
  return {
    version: detail.version, status: detail.draft ? "draft" : "published", updatedLabel: formatUpdated(revision.createdAt),
    header: revision.value.headerNavigation.map(fromWireNavigation), mobile: revision.value.mobileNavigation.map(fromWireNavigation),
    footer: revision.value.footerNavigation.map(fromWireNavigation),
  }
}

function navigationValues(value: PublicNavigation, detail: CmsSiteSettingsDetail): CmsSiteSettingsValue {
  const base = detail.draft?.value ?? detail.published?.value
  if (!base) throw new CmsUnavailableError("Настройки сайта")
  return { ...base, headerNavigation: value.header.map(toWireItem), mobileNavigation: value.mobile.map(toWireItem), footerNavigation: value.footer.map(toWireItem) }
}

function fromWireNavigation(item: WireNavigationAny): PublicNavigationItem {
  return {
    id: item.id, label: item.label,
    href: item.link.kind === "external" ? item.link.url : `${item.link.path}${item.link.anchor ? `#${item.link.anchor}` : ""}`,
    icon: item.icon ?? "link", color: item.color ?? "#5f6368", visible: item.enabled,
    children: item.children.map(fromWireNavigation),
  }
}

function toWireItem(item: PublicNavigationItem): WireNavigationItem {
  return { ...wireBase(item), children: item.children.slice(0, 30).map(toWireChild) }
}
function toWireChild(item: PublicNavigationItem): WireNavigationChild {
  return { ...wireBase(item), children: item.children.slice(0, 30).map(toWireLeaf) }
}
function toWireLeaf(item: PublicNavigationItem): WireNavigationLeaf { return { ...wireBase(item), children: [] } }
function wireBase(item: PublicNavigationItem) {
  return { id: isUuid(item.id) ? item.id : uuidForNavigation(), label: item.label, link: hrefToLink(item.href), target: "_self" as const, icon: item.icon || null, color: item.color || null, visibleOn: "all" as const, enabled: item.visible }
}
function hrefToLink(href: string): WireNavigationAny["link"] {
  if (/^https?:\/\//i.test(href)) return { kind: "external", url: href }
  const [rawPath, rawAnchor] = href.split("#", 2)
  const path = rawPath?.startsWith("/") ? rawPath : "/"
  return rawAnchor ? { kind: "internal", path, anchor: rawAnchor } : { kind: "internal", path }
}
function uuidForNavigation() { return globalThis.crypto?.randomUUID?.() ?? fallbackUuid() }

const sessionResponseParser = {
  safeParse(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => key !== "user")) return { success: false as const, error: { issues: [{ message: "Expected strict session envelope" }] } }
    const parsed = SessionUserSchema.safeParse((value as { user?: unknown }).user)
    return parsed.success ? { success: true as const, data: { user: parsed.data } } : { success: false as const, error: { issues: parsed.error.issues } }
  },
}

export const fixtureCmsRepository: CmsRepository = new FixtureCmsRepository()
export const cmsRepository: CmsRepository = cmsDataMode === "fixtures" ? fixtureCmsRepository : new ApiCmsRepository()
