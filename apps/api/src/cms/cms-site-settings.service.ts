import { createHash, randomUUID } from "node:crypto"

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { DataSource, type EntityManager } from "typeorm"

import {
  CmsMetrikaSettingsDetailSchema,
  CmsMetrikaSettingsRevisionSchema,
  CmsMetrikaSettingsSchema,
  CmsSiteSettingsDetailSchema,
  CmsSiteSettingsRevisionSchema,
  CmsSiteSettingsStoredValueSchema,
  CmsSiteSettingsValueSchema,
  PublicSiteSettingsSchema,
  canonicalPublicPath,
  type CmsMetrikaSettings,
  type CmsMetrikaSettingsDetail,
  type CmsMetrikaSettingsMutation,
  type CmsMetrikaSettingsPublish,
  type CmsSiteSettingsDetail,
  type CmsSiteSettingsMutation,
  type CmsSiteSettingsPublish,
  type CmsSiteSettingsStoredValue,
  type CmsSiteSettingsValue,
  type PublicSiteSettings,
  type SessionUser,
} from "@crm/contracts"
import {
  ChangeLogEntity,
  CmsActiveReleaseEntity,
  CmsReleaseEntity,
  CmsReleaseItemEntity,
  CmsSiteSettingsEntity,
  CmsSiteSettingsRevisionEntity,
  IdempotencyKeyEntity,
  OutboxEventEntity,
} from "@crm/db"

const SETTINGS_ID = "00000000-0000-4000-8000-000000000001"
const DISABLED_METRIKA: CmsMetrikaSettings = { enabled: false, counterId: null }

@Injectable()
export class CmsSiteSettingsService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async get(actor: SessionUser): Promise<CmsSiteSettingsDetail> {
    this.assert(actor, "canViewContent")
    return this.detail(this.dataSource.manager)
  }

  async getMetrika(actor: SessionUser): Promise<CmsMetrikaSettingsDetail> {
    this.assert(actor, "canManageIntegrations")
    return this.metrikaDetail(this.dataSource.manager)
  }

  async update(input: CmsSiteSettingsMutation, actor: SessionUser, requestId: string): Promise<CmsSiteSettingsDetail> {
    this.assert(actor, "canEditContent")
    return this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = "cms-site-settings:update"
      const requestHash = hash(input)
      const replay = await this.replay<CmsSiteSettingsDetail>(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return replay

      const settings = await this.settings(manager)
      if (settings.version !== input.expectedVersion) throw this.versionConflict(settings.version)

      const currentDraft = await this.draftRevision(manager)
      const base = currentDraft ? parseStoredValue(currentDraft.value) : await this.activeOrLatestPublishedValue(manager)
      const value = CmsSiteSettingsStoredValueSchema.parse({
        ...CmsSiteSettingsValueSchema.parse(input.value),
        analytics: { metrika: base?.analytics.metrika ?? DISABLED_METRIKA },
      })

      if (currentDraft) await this.supersede(manager, currentDraft.id)
      const revision = await this.createRevision(manager, value, "draft", actor.id)
      await this.bumpVersion(manager, input.expectedVersion, actor.id)

      const response = await this.detail(manager)
      await this.record(manager, "updated", actor.id, requestId, { revision: revision.revision, contentHash: revision.contentHash })
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    })
  }

  async updateMetrika(input: CmsMetrikaSettingsMutation, actor: SessionUser, requestId: string): Promise<CmsMetrikaSettingsDetail> {
    this.assert(actor, "canManageIntegrations")
    return this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = "cms-site-settings:metrika:update"
      const requestHash = hash(input)
      const replay = await this.replay<CmsMetrikaSettingsDetail>(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return replay

      const settings = await this.settings(manager)
      if (settings.version !== input.expectedVersion) throw this.versionConflict(settings.version)

      const currentDraft = await this.draftRevision(manager)
      const base = currentDraft ? parseStoredValue(currentDraft.value) : await this.activeOrLatestPublishedValue(manager)
      if (!base) throw this.settingsBaseRequired()
      const metrika = CmsMetrikaSettingsSchema.parse(input.value)

      if (same(base.analytics.metrika, metrika)) {
        const response = await this.metrikaDetail(manager)
        await this.remember(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
        return response
      }

      if (currentDraft) await this.supersede(manager, currentDraft.id)
      const revision = await this.createRevision(manager, { ...base, analytics: { metrika } }, "draft", actor.id)
      await this.bumpVersion(manager, input.expectedVersion, actor.id)

      const response = await this.metrikaDetail(manager)
      await this.record(manager, "metrika_updated", actor.id, requestId, {
        revision: revision.revision,
        contentHash: revision.contentHash,
        metrika,
      })
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    })
  }

  async publish(input: CmsSiteSettingsPublish, actor: SessionUser, requestId: string): Promise<CmsSiteSettingsDetail> {
    this.assert(actor, "canPublishContent")
    return this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = "cms-site-settings:publish"
      const requestHash = hash(input)
      const replay = await this.replay<CmsSiteSettingsDetail>(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return replay

      const settings = await this.settings(manager)
      if (settings.version !== input.expectedVersion) throw this.versionConflict(settings.version)
      const draft = await this.draftRevision(manager)
      if (!draft) throw new ConflictException({ code: "CMS_SITE_SETTINGS_DRAFT_REQUIRED", message: "Нет изменений для публикации" })

      const draftValue = parseStoredValue(draft.value)
      if (draftValue.heroDefault && hasUnresolvedHeroMedia(draftValue.heroDefault)) {
        throw new UnprocessableEntityException({ code: "CMS_MEDIA_NOT_RESOLVED", message: "Hero ссылается на media без готовых public WebP/AVIF вариантов" })
      }

      const active = await this.activePublication(manager)
      if (active.row.releaseId) {
        const rows = await manager.query<Array<{ path: string }>>(`SELECT path FROM cms_release_items WHERE release_id = $1`, [active.row.releaseId])
        if (rows.length > 0) {
          const missing = unpublishedNavigationTargets(draftValue, rows.map((row) => row.path))
          if (missing.length > 0) throw new UnprocessableEntityException({
            code: "CMS_NAVIGATION_TARGET_UNPUBLISHED",
            message: `Ссылки меню ведут на неопубликованные страницы: ${missing.map((target) => target.path).join(", ")}`,
            details: { targets: missing },
          })
        }
      }
      const publicMetrika = active.value?.analytics.metrika ?? DISABLED_METRIKA
      let publishedRevision = draft

      if (!same(draftValue.analytics.metrika, publicMetrika)) {
        await this.supersede(manager, draft.id)
        publishedRevision = await this.createRevision(manager, { ...draftValue, analytics: { metrika: publicMetrika } }, "published", actor.id)
        await this.createRevision(manager, draftValue, "draft", actor.id)
      } else {
        const moved = await manager.createQueryBuilder().update(CmsSiteSettingsRevisionEntity).set({ state: "published" }).where("id = :id AND state = 'draft'", { id: draft.id }).execute()
        if (moved.affected !== 1) throw new ConflictException({ code: "VERSION_CONFLICT", message: "Настройки уже изменены" })
      }

      const publication = await this.activateSettingsRevision(manager, active.row, publishedRevision.id, actor.id)
      await this.bumpVersion(manager, input.expectedVersion, actor.id)

      const response = await this.detail(manager)
      await this.record(manager, "published", actor.id, requestId, {
        revisionId: publishedRevision.id,
        releaseId: publication.releaseId,
        affectedPaths: publication.affectedPaths,
      })
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    })
  }

  async publishMetrika(input: CmsMetrikaSettingsPublish, actor: SessionUser, requestId: string): Promise<CmsMetrikaSettingsDetail> {
    this.assert(actor, "canManageIntegrations")
    return this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = "cms-site-settings:metrika:publish"
      const requestHash = hash(input)
      const replay = await this.replay<CmsMetrikaSettingsDetail>(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return replay

      const settings = await this.settings(manager)
      if (settings.version !== input.expectedVersion) throw this.versionConflict(settings.version)
      const draft = await this.draftRevision(manager)
      if (!draft) throw this.metrikaDraftRequired()

      const active = await this.activePublication(manager)
      if (!active.value) throw this.publishedBaseRequired()
      const draftValue = parseStoredValue(draft.value)
      if (same(draftValue.analytics.metrika, active.value.analytics.metrika)) throw this.metrikaDraftRequired()

      const publishedValue = CmsSiteSettingsStoredValueSchema.parse({ ...active.value, analytics: { metrika: draftValue.analytics.metrika } })
      let publishedRevision = draft
      if (same(siteValue(draftValue), siteValue(active.value))) {
        const moved = await manager.createQueryBuilder().update(CmsSiteSettingsRevisionEntity).set({ state: "published" }).where("id = :id AND state = 'draft'", { id: draft.id }).execute()
        if (moved.affected !== 1) throw new ConflictException({ code: "VERSION_CONFLICT", message: "Настройки уже изменены" })
      } else {
        publishedRevision = await this.createRevision(manager, publishedValue, "published", actor.id)
      }

      const publication = await this.activateSettingsRevision(manager, active.row, publishedRevision.id, actor.id)
      await this.bumpVersion(manager, input.expectedVersion, actor.id)

      const response = await this.metrikaDetail(manager)
      await this.record(manager, "metrika_published", actor.id, requestId, {
        revisionId: publishedRevision.id,
        releaseId: publication.releaseId,
        affectedPaths: publication.affectedPaths,
        metrika: publishedValue.analytics.metrika,
      })
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    })
  }

  async publicSnapshot(): Promise<PublicSiteSettings> {
    const rows = await this.dataSource.query(`SELECT release.id AS "releaseId", release.published_at AS "publishedAt", revision.id AS "revisionId", revision.content_hash AS "contentHash", revision.value AS value
      FROM cms_active_release active JOIN cms_releases release ON release.id = active.release_id AND release.state = 'published'
      JOIN cms_site_settings_revisions revision ON revision.id = release.site_settings_revision_id
      WHERE active.singleton_key = 'public' LIMIT 1`) as Array<{ releaseId: string; publishedAt: Date; revisionId: string; contentHash: string; value: unknown }>
    const row = rows[0]
    if (!row) throw new NotFoundException({ code: "NOT_FOUND", message: "Настройки сайта ещё не опубликованы" })
    return PublicSiteSettingsSchema.parse({
      releaseId: row.releaseId,
      revisionId: row.revisionId,
      contentVersion: row.contentHash,
      publishedAt: row.publishedAt.toISOString(),
      value: parseStoredValue(row.value),
    })
  }

  private async settings(manager: EntityManager) {
    const row = await manager.findOneBy(CmsSiteSettingsEntity, { id: SETTINGS_ID })
    if (!row) throw new ConflictException({ code: "CMS_SITE_SETTINGS_MISSING", message: "Настройки сайта не инициализированы" })
    return row
  }

  private async detail(manager: EntityManager): Promise<CmsSiteSettingsDetail> {
    const settings = await this.settings(manager)
    const { draft, published } = await this.latestRevisions(manager)
    const draftValue = draft ? parseStoredValue(draft.value) : null
    const publishedValue = published ? parseStoredValue(published.value) : null
    const visibleDraft = draft && (!publishedValue || !same(siteValue(draftValue!), siteValue(publishedValue))) ? siteRevision(draft, draftValue!) : null
    return CmsSiteSettingsDetailSchema.parse({
      id: settings.id,
      version: settings.version,
      draft: visibleDraft,
      published: published && publishedValue ? siteRevision(published, publishedValue) : null,
    })
  }

  private async metrikaDetail(manager: EntityManager): Promise<CmsMetrikaSettingsDetail> {
    const settings = await this.settings(manager)
    const draft = await this.draftRevision(manager)
    const active = await this.activePublication(manager)
    const draftValue = draft ? parseStoredValue(draft.value) : null
    const publishedValue = active.value
    const visibleDraft = draft && (!publishedValue || !same(draftValue!.analytics.metrika, publishedValue.analytics.metrika)) ? metrikaRevision(draft, draftValue!.analytics.metrika) : null
    return CmsMetrikaSettingsDetailSchema.parse({
      id: settings.id,
      version: settings.version,
      draft: visibleDraft,
      published: active.revision && publishedValue ? metrikaRevision(active.revision, publishedValue.analytics.metrika) : null,
    })
  }

  private async latestRevisions(manager: EntityManager) {
    const rows = await manager.getRepository(CmsSiteSettingsRevisionEntity).find({
      where: [{ settingsId: SETTINGS_ID, state: "draft" }, { settingsId: SETTINGS_ID, state: "published" }],
      order: { revision: "DESC" },
    })
    return {
      draft: rows.find((item) => item.state === "draft") ?? null,
      published: rows.find((item) => item.state === "published") ?? null,
    }
  }

  private async draftRevision(manager: EntityManager) {
    return manager.getRepository(CmsSiteSettingsRevisionEntity).findOne({ where: { settingsId: SETTINGS_ID, state: "draft" }, order: { revision: "DESC" } })
  }

  private async activeOrLatestPublishedValue(manager: EntityManager): Promise<CmsSiteSettingsStoredValue | null> {
    const active = await this.activePublication(manager)
    if (active.value) return active.value
    const { published } = await this.latestRevisions(manager)
    return published ? parseStoredValue(published.value) : null
  }

  private async activePublication(manager: EntityManager): Promise<{
    row: CmsActiveReleaseEntity
    release: CmsReleaseEntity | null
    revision: CmsSiteSettingsRevisionEntity | null
    value: CmsSiteSettingsStoredValue | null
  }> {
    const row = await manager.findOneByOrFail(CmsActiveReleaseEntity, { singletonKey: "public" })
    if (!row.releaseId) return { row, release: null, revision: null, value: null }
    const release = await manager.findOneBy(CmsReleaseEntity, { id: row.releaseId })
    if (!release || release.state !== "published") throw new ConflictException({ code: "CMS_ACTIVE_RELEASE_INVALID", message: "Активная публикация недоступна" })
    if (!release.siteSettingsRevisionId) return { row, release, revision: null, value: null }
    const revision = await manager.findOneBy(CmsSiteSettingsRevisionEntity, { id: release.siteSettingsRevisionId })
    if (!revision) throw new ConflictException({ code: "CMS_ACTIVE_RELEASE_INVALID", message: "Настройки активной публикации недоступны" })
    return { row, release, revision, value: parseStoredValue(revision.value) }
  }

  private async createRevision(manager: EntityManager, value: CmsSiteSettingsStoredValue, state: "draft" | "published", actorId: string) {
    const parsed = CmsSiteSettingsStoredValueSchema.parse(value)
    const raw = await manager.query(`SELECT COALESCE(MAX(revision), 0) + 1 AS next FROM cms_site_settings_revisions WHERE settings_id = $1`, [SETTINGS_ID]) as Array<{ next: number | string }>
    const revision = manager.create(CmsSiteSettingsRevisionEntity, {
      id: randomUUID(),
      settingsId: SETTINGS_ID,
      revision: Number(raw[0]?.next ?? 1),
      state,
      value: parsed,
      contentHash: hash(parsed),
      createdBy: actorId,
      createdAt: new Date(),
    })
    return manager.save(revision)
  }

  private async supersede(manager: EntityManager, id: string) {
    const changed = await manager.getRepository(CmsSiteSettingsRevisionEntity).update({ id, state: "draft" }, { state: "superseded" })
    if (changed.affected !== 1) throw new ConflictException({ code: "VERSION_CONFLICT", message: "Настройки уже изменены" })
  }

  private async activateSettingsRevision(manager: EntityManager, active: CmsActiveReleaseEntity, revisionId: string, actorId: string) {
    const baseItems = active.releaseId ? await manager.getRepository(CmsReleaseItemEntity).findBy({ releaseId: active.releaseId }) : []
    const routes = baseItems
      .map((item) => ({ path: item.path, nodeId: item.nodeId, revisionId: item.revisionId, resolvedContentHash: item.resolvedContentHash }))
      .sort((left, right) => left.path.localeCompare(right.path))
    const sequenceRows = await manager.query(`SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM cms_releases`) as Array<{ next: number | string }>
    const now = new Date()
    const releaseId = randomUUID()
    const release = await manager.save(manager.create(CmsReleaseEntity, {
      id: releaseId,
      sequence: Number(sequenceRows[0]?.next ?? 1),
      state: "published",
      baseReleaseId: active.releaseId,
      siteSettingsRevisionId: revisionId,
      manifestHash: hash({ baseReleaseId: active.releaseId, siteSettingsRevisionId: revisionId, routes }),
      createdBy: actorId,
      createdAt: now,
      publishedAt: now,
    }))
    if (baseItems.length) {
      await manager.save(CmsReleaseItemEntity, baseItems.map((item) => manager.create(CmsReleaseItemEntity, {
        id: randomUUID(),
        releaseId,
        path: item.path,
        nodeId: item.nodeId,
        revisionId: item.revisionId,
        resolvedContentHash: item.resolvedContentHash,
        resolvedContent: item.resolvedContent,
        dependencies: item.dependencies,
      })))
    }

    const basePredicate = active.releaseId === null ? "release_id IS NULL" : "release_id = :baseReleaseId"
    const activated = await manager.createQueryBuilder().update(CmsActiveReleaseEntity).set({
      releaseId,
      version: () => '"version" + 1',
      updatedBy: actorId,
      updatedAt: now,
    }).where(`singleton_key = 'public' AND version = :version AND ${basePredicate}`, {
      version: active.version,
      baseReleaseId: active.releaseId ?? undefined,
    }).execute()
    if (activated.affected !== 1) throw new ConflictException({ code: "CMS_PUBLICATION_STALE", message: "Сайт уже изменился; повторите публикацию" })
    return { releaseId: release.id, affectedPaths: routes.map((route) => route.path) }
  }

  private async bumpVersion(manager: EntityManager, expectedVersion: number, actorId: string) {
    const changed = await manager.createQueryBuilder().update(CmsSiteSettingsEntity).set({
      version: () => '"version" + 1',
      updatedBy: actorId,
      updatedAt: new Date(),
    }).where("id = :id AND version = :version", { id: SETTINGS_ID, version: expectedVersion }).execute()
    if (changed.affected !== 1) throw this.versionConflict(expectedVersion)
  }

  private assert(actor: SessionUser, capability: "canViewContent" | "canEditContent" | "canPublishContent" | "canManageIntegrations") {
    if (actor.capabilities[capability] !== true) {
      throw new ForbiddenException({ code: "PERMISSION_DENIED", message: `Capability ${capability} is required` })
    }
  }

  private versionConflict(version: number) {
    return new ConflictException({ code: "VERSION_CONFLICT", message: "Настройки были изменены другим пользователем", details: { serverVersion: version } })
  }

  private publishedBaseRequired() {
    return new ConflictException({ code: "CMS_METRIKA_PUBLISHED_BASE_REQUIRED", message: "Сначала опубликуйте базовые настройки сайта" })
  }

  private settingsBaseRequired() {
    return new ConflictException({ code: "CMS_METRIKA_SETTINGS_BASE_REQUIRED", message: "Сначала сохраните базовые настройки сайта" })
  }

  private metrikaDraftRequired() {
    return new ConflictException({ code: "CMS_METRIKA_SETTINGS_DRAFT_REQUIRED", message: "Нет изменений Яндекс Метрики для публикации" })
  }

  private async replay<T>(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string): Promise<T | null> {
    const row = await manager.getRepository(IdempotencyKeyEntity).findOne({ where: [{ scope, operationId }, { scope, idempotencyKey }] })
    if (!row) return null
    if (row.idempotencyKey !== idempotencyKey || row.requestHash !== requestHash) {
      throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Ключ идемпотентности уже использован" })
    }
    return row.responseBody as T
  }

  private async remember(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string, response: Record<string, unknown>) {
    await manager.save(manager.create(IdempotencyKeyEntity, {
      id: randomUUID(),
      scope,
      operationId,
      idempotencyKey,
      requestHash,
      responseStatus: 200,
      responseBody: response,
      createdAt: new Date(),
    }))
  }

  private async record(manager: EntityManager, action: string, actorId: string, requestId: string, changes: Record<string, unknown>) {
    const now = new Date()
    await manager.save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "cms_site_settings", entityId: SETTINGS_ID, action, actorId, requestId, changes, createdAt: now }))
    await manager.save(manager.create(OutboxEventEntity, {
      id: randomUUID(),
      topic: `cms.site_settings.${action}`,
      aggregateType: "cms_site_settings",
      aggregateId: SETTINGS_ID,
      payload: { settingsId: SETTINGS_ID, ...changes },
      availableAt: now,
      processedAt: null,
      attempts: 0,
      createdAt: now,
    }))
  }
}

export function unpublishedNavigationTargets(value: CmsSiteSettingsValue, publishedPaths: Iterable<string>): Array<{ label: string; path: string }> {
  const paths = new Set([...publishedPaths].map(canonicalPublicPath))
  const missing = new Map<string, { label: string; path: string }>()
  const check = (label: string, path: string) => {
    if (!paths.has(canonicalPublicPath(path)) && !missing.has(path)) missing.set(path, { label, path })
  }
  const visit = (items: CmsSiteSettingsValue["headerNavigation"]) => {
    for (const item of items) {
      if (!item.enabled) continue
      if (item.link.kind === "internal") check(item.label, item.link.path)
      visit(item.children)
    }
  }
  visit(value.headerNavigation)
  visit(value.mobileNavigation)
  visit(value.footerNavigation)
  if (value.headerCta?.enabled && value.headerCta.link.kind === "internal") check(value.headerCta.label, value.headerCta.link.path)
  return [...missing.values()]
}

function parseStoredValue(value: unknown): CmsSiteSettingsStoredValue {
  return CmsSiteSettingsStoredValueSchema.parse(value)
}

function siteValue(value: CmsSiteSettingsStoredValue): CmsSiteSettingsValue {
  const siteSettings: Record<string, unknown> = { ...value }
  delete siteSettings.analytics
  return CmsSiteSettingsValueSchema.parse(siteSettings)
}

function siteRevision(row: CmsSiteSettingsRevisionEntity, value: CmsSiteSettingsStoredValue) {
  return CmsSiteSettingsRevisionSchema.parse({
    id: row.id,
    revision: row.revision,
    state: row.state,
    value: siteValue(value),
    contentHash: row.contentHash,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  })
}

function metrikaRevision(row: CmsSiteSettingsRevisionEntity, value: CmsMetrikaSettings) {
  return CmsMetrikaSettingsRevisionSchema.parse({
    id: row.id,
    revision: row.revision,
    state: row.state,
    value,
    contentHash: row.contentHash,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  })
}

function same(left: unknown, right: unknown): boolean {
  return stable(left) === stable(right)
}

function hash(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex")
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

function hasUnresolvedHeroMedia(hero: NonNullable<CmsSiteSettingsValue["heroDefault"]>) {
  const unresolved = (id: string | null | undefined, media: NonNullable<CmsSiteSettingsValue["heroDefault"]>["background"] | undefined) => Boolean(id && (!media || media.assetId !== id || !media.variants.some((variant) => (variant.format === "webp" || variant.format === "avif") && variant.width && variant.height)))
  return unresolved(hero.backgroundAssetId, hero.background)
    || unresolved(hero.mobileBackgroundAssetId, hero.mobileBackground)
    || unresolved(hero.foregroundAssetId, hero.foreground)
    || hero.slides.some((item) => unresolved(item.imageAssetId, item.image))
    || hero.featureCards.some((item) => unresolved(item.imageAssetId, item.image))
}
