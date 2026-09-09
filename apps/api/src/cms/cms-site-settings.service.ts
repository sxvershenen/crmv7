import { createHash, randomUUID } from "node:crypto"

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { DataSource, type EntityManager } from "typeorm"

import { CmsSiteSettingsDetailSchema, CmsSiteSettingsRevisionSchema, CmsSiteSettingsValueSchema, PublicSiteSettingsSchema, type CmsSiteSettingsDetail, type CmsSiteSettingsMutation, type CmsSiteSettingsPublish, type PublicSiteSettings, type SessionUser } from "@crm/contracts"
import { ChangeLogEntity, CmsActiveReleaseEntity, CmsReleaseEntity, CmsReleaseItemEntity, CmsSiteSettingsEntity, CmsSiteSettingsRevisionEntity, IdempotencyKeyEntity, OutboxEventEntity } from "@crm/db"

const SETTINGS_ID = "00000000-0000-4000-8000-000000000001"

@Injectable()
export class CmsSiteSettingsService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async get(actor: SessionUser) { this.assert(actor, "canViewContent"); return this.detail(this.dataSource.manager) }

  async update(input: CmsSiteSettingsMutation, actor: SessionUser, requestId: string): Promise<CmsSiteSettingsDetail> {
    this.assert(actor, "canEditContent")
    return this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = "cms-site-settings:update"; const requestHash = hash(input)
      const replay = await this.replay(manager, scope, input.operationId, input.idempotencyKey, requestHash); if (replay) return replay
      const settings = await this.settings(manager)
      if (settings.version !== input.expectedVersion) throw this.versionConflict(settings.version)
      const value = CmsSiteSettingsValueSchema.parse(input.value)
      const currentDraft = await manager.getRepository(CmsSiteSettingsRevisionEntity).findOne({ where: { settingsId: SETTINGS_ID, state: "draft" }, order: { revision: "DESC" } })
      if (currentDraft) await manager.getRepository(CmsSiteSettingsRevisionEntity).update({ id: currentDraft.id, state: "draft" }, { state: "superseded" })
      const raw = await manager.query(`SELECT COALESCE(MAX(revision), 0) + 1 AS next FROM cms_site_settings_revisions WHERE settings_id = $1`, [SETTINGS_ID]) as Array<{ next: number | string }>
      const now = new Date()
      await manager.save(manager.create(CmsSiteSettingsRevisionEntity, { id: randomUUID(), settingsId: SETTINGS_ID, revision: Number(raw[0]?.next ?? 1), state: "draft", value, contentHash: hash(value), createdBy: actor.id, createdAt: now }))
      const changed = await manager.createQueryBuilder().update(CmsSiteSettingsEntity).set({ version: () => '"version" + 1', updatedBy: actor.id, updatedAt: now }).where("id = :id AND version = :version", { id: SETTINGS_ID, version: input.expectedVersion }).execute()
      if (changed.affected !== 1) throw this.versionConflict(settings.version)
      const response = await this.detail(manager)
      await this.record(manager, "updated", actor.id, requestId, { revision: response.draft?.revision, contentHash: response.draft?.contentHash })
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    })
  }

  async publish(input: CmsSiteSettingsPublish, actor: SessionUser, requestId: string): Promise<CmsSiteSettingsDetail> {
    this.assert(actor, "canPublishContent")
    return this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = "cms-site-settings:publish"; const requestHash = hash(input)
      const replay = await this.replay(manager, scope, input.operationId, input.idempotencyKey, requestHash); if (replay) return replay
      const settings = await this.settings(manager)
      if (settings.version !== input.expectedVersion) throw this.versionConflict(settings.version)
      const draft = await manager.getRepository(CmsSiteSettingsRevisionEntity).findOne({ where: { settingsId: SETTINGS_ID, state: "draft" }, order: { revision: "DESC" } })
      if (!draft) throw new ConflictException({ code: "CMS_SITE_SETTINGS_DRAFT_REQUIRED", message: "Нет изменений для публикации" })
      const publishedValue = CmsSiteSettingsValueSchema.parse(draft.value)
      if (publishedValue.heroDefault && hasUnresolvedHeroMedia(publishedValue.heroDefault)) throw new UnprocessableEntityException({ code: "CMS_MEDIA_NOT_RESOLVED", message: "Hero ссылается на media без готовых public WebP/AVIF вариантов" })
      const active = await manager.findOneByOrFail(CmsActiveReleaseEntity, { singletonKey: "public" })
      const baseItems = active.releaseId ? await manager.getRepository(CmsReleaseItemEntity).findBy({ releaseId: active.releaseId }) : []
      const now = new Date(); const releaseId = randomUUID()
      const sequenceRows = await manager.query(`SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM cms_releases`) as Array<{ next: number | string }>
      const routes = baseItems.map((item) => ({ path: item.path, nodeId: item.nodeId, revisionId: item.revisionId, resolvedContentHash: item.resolvedContentHash })).sort((a, b) => a.path.localeCompare(b.path))
      const release = await manager.save(manager.create(CmsReleaseEntity, { id: releaseId, sequence: Number(sequenceRows[0]?.next ?? 1), state: "published", baseReleaseId: active.releaseId, siteSettingsRevisionId: draft.id, manifestHash: hash({ baseReleaseId: active.releaseId, siteSettingsRevisionId: draft.id, routes }), createdBy: actor.id, createdAt: now, publishedAt: now }))
      if (baseItems.length) await manager.save(CmsReleaseItemEntity, baseItems.map((item) => manager.create(CmsReleaseItemEntity, { id: randomUUID(), releaseId, path: item.path, nodeId: item.nodeId, revisionId: item.revisionId, resolvedContentHash: item.resolvedContentHash, resolvedContent: item.resolvedContent, dependencies: item.dependencies })))
      const moved = await manager.createQueryBuilder().update(CmsSiteSettingsRevisionEntity).set({ state: "published" }).where("id = :id AND state = 'draft'", { id: draft.id }).execute()
      if (moved.affected !== 1) throw new ConflictException({ code: "VERSION_CONFLICT", message: "Настройки уже изменены" })
      const basePredicate = active.releaseId === null ? "release_id IS NULL" : "release_id = :baseReleaseId"
      const activated = await manager.createQueryBuilder().update(CmsActiveReleaseEntity).set({ releaseId, version: () => '"version" + 1', updatedBy: actor.id, updatedAt: now }).where(`singleton_key = 'public' AND version = :version AND ${basePredicate}`, { version: active.version, baseReleaseId: active.releaseId ?? undefined }).execute()
      if (activated.affected !== 1) throw new ConflictException({ code: "CMS_PUBLICATION_STALE", message: "Сайт уже изменился; повторите публикацию" })
      const bumped = await manager.createQueryBuilder().update(CmsSiteSettingsEntity).set({ version: () => '"version" + 1', updatedBy: actor.id, updatedAt: now }).where("id = :id AND version = :version", { id: SETTINGS_ID, version: input.expectedVersion }).execute()
      if (bumped.affected !== 1) throw this.versionConflict(settings.version)
      const response = await this.detail(manager)
      await this.record(manager, "published", actor.id, requestId, { revisionId: draft.id, releaseId: release.id, affectedPaths: routes.map((route) => route.path) })
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    })
  }

  async publicSnapshot(): Promise<PublicSiteSettings> {
    const rows = await this.dataSource.query(`SELECT release.id AS "releaseId", release.published_at AS "publishedAt", revision.id AS "revisionId", revision.content_hash AS "contentHash", revision.value AS value
      FROM cms_active_release active JOIN cms_releases release ON release.id = active.release_id AND release.state = 'published'
      JOIN cms_site_settings_revisions revision ON revision.id = release.site_settings_revision_id
      WHERE active.singleton_key = 'public' LIMIT 1`) as Array<{ releaseId: string; publishedAt: Date; revisionId: string; contentHash: string; value: unknown }>
    const row = rows[0]; if (!row) throw new NotFoundException({ code: "NOT_FOUND", message: "Настройки сайта ещё не опубликованы" })
    return PublicSiteSettingsSchema.parse({ releaseId: row.releaseId, revisionId: row.revisionId, contentVersion: row.contentHash, publishedAt: row.publishedAt.toISOString(), value: row.value })
  }

  private async settings(manager: EntityManager) { const row = await manager.findOneBy(CmsSiteSettingsEntity, { id: SETTINGS_ID }); if (!row) throw new ConflictException({ code: "CMS_SITE_SETTINGS_MISSING", message: "Настройки сайта не инициализированы" }); return row }
  private async detail(manager: EntityManager): Promise<CmsSiteSettingsDetail> { const settings = await this.settings(manager); const rows = await manager.getRepository(CmsSiteSettingsRevisionEntity).find({ where: [{ settingsId: SETTINGS_ID, state: "draft" }, { settingsId: SETTINGS_ID, state: "published" }], order: { revision: "DESC" } }); const map = (state: string) => { const row = rows.find((item) => item.state === state); return row ? CmsSiteSettingsRevisionSchema.parse({ id: row.id, revision: row.revision, state: row.state, value: row.value, contentHash: row.contentHash, createdBy: row.createdBy, createdAt: row.createdAt.toISOString() }) : null }; return CmsSiteSettingsDetailSchema.parse({ id: settings.id, version: settings.version, draft: map("draft"), published: map("published") }) }
  private assert(actor: SessionUser, capability: "canViewContent" | "canEditContent" | "canPublishContent") { if (actor.capabilities[capability] !== true) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: `Capability ${capability} is required` }) }
  private versionConflict(version: number) { return new ConflictException({ code: "VERSION_CONFLICT", message: "Настройки были изменены другим пользователем", details: { serverVersion: version } }) }
  private async replay(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string) { const row = await manager.getRepository(IdempotencyKeyEntity).findOne({ where: [{ scope, operationId }, { scope, idempotencyKey }] }); if (!row) return null; if (row.idempotencyKey !== idempotencyKey || row.requestHash !== requestHash) throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Ключ идемпотентности уже использован" }); return row.responseBody as CmsSiteSettingsDetail }
  private async remember(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string, response: CmsSiteSettingsDetail) { await manager.save(manager.create(IdempotencyKeyEntity, { id: randomUUID(), scope, operationId, idempotencyKey, requestHash, responseStatus: 200, responseBody: response, createdAt: new Date() })) }
  private async record(manager: EntityManager, action: string, actorId: string, requestId: string, changes: Record<string, unknown>) { const now = new Date(); await manager.save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "cms_site_settings", entityId: SETTINGS_ID, action, actorId, requestId, changes, createdAt: now })); await manager.save(manager.create(OutboxEventEntity, { id: randomUUID(), topic: `cms.site_settings.${action}`, aggregateType: "cms_site_settings", aggregateId: SETTINGS_ID, payload: { settingsId: SETTINGS_ID, ...changes }, availableAt: now, processedAt: null, attempts: 0, createdAt: now })) }
}

function hash(value: unknown): string { return createHash("sha256").update(stable(value)).digest("hex") }
function stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`; return JSON.stringify(value) }
function hasUnresolvedHeroMedia(hero: { backgroundAssetId: string | null; foregroundAssetId: string | null; background: { assetId: string } | null; foreground: { assetId: string } | null; slides: Array<{ imageAssetId: string; image: { assetId: string } | null }>; featureCards: Array<{ imageAssetId: string; image: { assetId: string } | null }> }) {
  return (hero.backgroundAssetId !== null && hero.background?.assetId !== hero.backgroundAssetId)
    || (hero.foregroundAssetId !== null && hero.foreground?.assetId !== hero.foregroundAssetId)
    || hero.slides.some((item) => item.image?.assetId !== item.imageAssetId)
    || hero.featureCards.some((item) => item.image?.assetId !== item.imageAssetId)
}
