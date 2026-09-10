import { createHash, randomUUID } from "node:crypto"

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { DataSource, In, IsNull, type EntityManager } from "typeorm"

import {
  CmsReleaseDetailSchema,
  CmsReleaseOutboxEventSchema,
  CmsHeroPolicySchema,
  CmsNodePublishResultSchema,
  CmsSiteSettingsValueSchema,
  CmsSectionSchema,
  CmsPartnersSectionSchema,
  CmsWhyUsSectionSchema,
  CmsHomeSectionSchema,
  isCmsHomeSectionKey,
  PublicReleasePageContentSchema,
  PublicAddOnTermsSchema,
  ReleaseDependencyRefSchema,
  ReleaseManifestSchema,
  type CmsReleaseActivateInput,
  type CmsReleaseBuildInput,
  type CmsReleaseDetail,
  type CmsReleaseOutboxEvent,
  type CmsNodePublish,
  type CmsNodePublishResult,
  type CmsHeroConfig,
  type PublicReleasePageContent,
  type CmsConfigPatch,
  type CmsSection,
  type ReleaseDependencyRef,
  type ReleaseManifest,
  type ReleaseValidationIssue,
  type SessionUser,
} from "@crm/contracts"
import {
  ChangeLogEntity,
  AddonOfferingTermsEntity,
  BusinessCalendarEntity,
  CatalogOfferingEntity,
  CmsActiveReleaseEntity,
  CmsNodeEntity,
  CmsNodeRevisionEntity,
  CmsReleaseEntity,
  CmsReleaseItemEntity,
  CmsPublicProfileEntity,
  CmsSiteSettingsRevisionEntity,
  CmsSourceLinkEntity,
  IdempotencyKeyEntity,
  OutboxEventEntity,
  OfferingBindingEntity,
  PriceBookEntity,
  ResourceEntity,
} from "@crm/db"

import { createPublicAddOnProjectionDependency } from "../offerings/public-addon-projection.js"
import { createPublicVenueProjectionDependency } from "../offerings/public-venue-projection.js"

type Candidate = {
  node: CmsNodeEntity
  revision: CmsNodeRevisionEntity
  sourceKind?: string | null
  safeProjectionDependency?: ReleaseDependencyRef | null
}
type MaterializedRoute = { candidate: Candidate; content: PublicReleasePageContent; dependencies: ReleaseDependencyRef[]; resolvedContentHash: string }
export type MaterializationResult = { routes: MaterializedRoute[]; issues: ReleaseValidationIssue[] }

const blockedOperationalSourceKinds = new Set(["event", "program_occurrence"])
const blockedCatalogSourceKind = "catalog_offering"

@Injectable()
export class CmsPublicationService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async get(id: string, actor: SessionUser): Promise<CmsReleaseDetail> {
    this.assertView(actor)
    const release = await this.dataSource.getRepository(CmsReleaseEntity).findOneBy({ id })
    if (!release) throw this.notFound()
    return this.detail(this.dataSource.manager, release)
  }

  async publishNode(nodeId: string, input: CmsNodePublish, actor: SessionUser, requestId: string): Promise<CmsNodePublishResult> {
    this.assert(actor)
    return this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = `cms-node:${nodeId}:publish`
      const requestHash = stableHash(input)
      const replay = await this.replayValue<CmsNodePublishResult>(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return CmsNodePublishResultSchema.parse(replay)
      const active = await this.active(manager)
      const node = await manager.getRepository(CmsNodeEntity).findOneBy({ id: nodeId })
      if (!node) throw new NotFoundException({ code: "CMS_NODE_NOT_FOUND", message: "Материал не найден" })
      if (node.status !== "active") throw new ConflictException({ code: "CMS_NODE_ARCHIVED", message: "Архивный материал нельзя опубликовать" })
      if (node.version !== input.expectedVersion) throw new ConflictException({ code: "VERSION_CONFLICT", message: "Материал был изменён другим пользователем", details: { entityId: node.id, serverVersion: node.version } })
      const revision = await manager.getRepository(CmsNodeRevisionEntity).findOne({ where: { nodeId, state: In(["draft", "review", "approved"]) }, order: { revision: "DESC" } })
      if (!revision) throw new ConflictException({ code: "CMS_PUBLISHABLE_DRAFT_REQUIRED", message: "Нет изменений для публикации" })
      if (revision.path.startsWith("/drafts/")) throw new UnprocessableEntityException({ code: "CMS_SOURCE_ROUTE_REQUIRED", message: "Перед публикацией задайте публичный URL вместо служебного /drafts/...", fieldErrors: { "route.path": ["Служебный URL черновика нельзя опубликовать"] } })
      const baseItems = active.releaseId ? await manager.getRepository(CmsReleaseItemEntity).findBy({ releaseId: active.releaseId }) : []
      const revisionIds = [...new Set([...baseItems.map((item) => item.revisionId), revision.id])]
      const revisions = await manager.getRepository(CmsNodeRevisionEntity).findBy({ id: In(revisionIds) })
      const byNode = new Map(revisions.map((item) => [item.nodeId, item]))
      byNode.set(nodeId, revision)
      const nodes = await manager.getRepository(CmsNodeEntity).findBy({ id: In([...byNode.keys()]) })
      if (nodes.length !== byNode.size) throw new ConflictException({ code: "CMS_BASE_RELEASE_INVALID", message: "Опубликованная версия повреждена" })
      const previousRelease = active.releaseId ? await manager.getRepository(CmsReleaseEntity).findOneBy({ id: active.releaseId }) : null
      const candidates = await this.withSourceKinds(manager, nodes.map((item) => ({ node: item, revision: byNode.get(item.id)! })))
      const result = materializeRelease(candidates, await this.siteDefaults(manager, previousRelease?.siteSettingsRevisionId ?? null))
      if (result.issues.some((issue) => issue.severity === "error")) throw new UnprocessableEntityException({ code: "CMS_PUBLICATION_VALIDATION_FAILED", message: "Страница не готова к публикации", details: { issues: result.issues } })
      const now = new Date()
      const releaseId = randomUUID()
      const routes = result.routes.map((route) => ({ path: route.content.path, nodeId: route.candidate.node.id, revisionId: route.candidate.revision.id, resolvedContentHash: route.resolvedContentHash, dependencyRefs: route.dependencies })).sort((a, b) => a.path.localeCompare(b.path))
      const release = await manager.save(manager.create(CmsReleaseEntity, {
        id: releaseId, sequence: await this.nextSequence(manager), state: "published", baseReleaseId: active.releaseId,
        siteSettingsRevisionId: previousRelease?.siteSettingsRevisionId ?? null,
        manifestHash: stableHash({ baseReleaseId: active.releaseId, routes, siteSettingsRevisionId: previousRelease?.siteSettingsRevisionId ?? null }),
        createdBy: actor.id, createdAt: now, publishedAt: now,
      }))
      await manager.save(CmsReleaseItemEntity, result.routes.map((route) => manager.create(CmsReleaseItemEntity, {
        id: randomUUID(), releaseId, path: route.content.path, nodeId: route.candidate.node.id, revisionId: route.candidate.revision.id,
        resolvedContentHash: route.resolvedContentHash, resolvedContent: route.content, dependencies: route.dependencies,
      })))
      const moved = await manager.createQueryBuilder().update(CmsNodeRevisionEntity).set({ state: "published" }).where("id = :id AND state IN (:...states)", { id: revision.id, states: ["draft", "review", "approved"] }).execute()
      if (moved.affected !== 1) throw this.staleRelease()
      const bumped = await manager.createQueryBuilder().update(CmsNodeEntity).set({ version: () => '"version" + 1', updatedBy: actor.id, updatedAt: now }).where("id = :id AND version = :version", { id: node.id, version: input.expectedVersion }).execute()
      if (bumped.affected !== 1) throw this.staleRelease()
      const updatedActive = await this.casActive(manager, active, { ...input, baseReleaseId: active.releaseId, expectedActiveReleaseVersion: active.version }, releaseId, actor.id)
      const updatedNode = await manager.findOneByOrFail(CmsNodeEntity, { id: node.id })
      const response = CmsNodePublishResultSchema.parse({
        node: { id: updatedNode.id, kind: updatedNode.kind, status: updatedNode.status, version: updatedNode.version, createdAt: updatedNode.createdAt.toISOString(), updatedAt: updatedNode.updatedAt.toISOString() },
        publishedRevision: { id: revision.id, nodeId: revision.nodeId, revision: revision.revision, state: "published", route: { path: revision.path, slug: revision.slug, parentNodeId: revision.parentNodeId, sortOrder: revision.sortOrder }, title: revision.title, contentHash: revision.contentHash, createdBy: revision.createdBy, createdAt: revision.createdAt.toISOString() },
        publishedAt: now.toISOString(), publicationId: release.id, publicationVersion: updatedActive.version,
      })
      await this.record(manager, release, "published", "cms.release.published", actor.id, requestId, routes.map((route) => route.path))
      await this.rememberValue(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    })
  }

  async build(input: CmsReleaseBuildInput, actor: SessionUser, requestId: string): Promise<CmsReleaseDetail> {
    this.assert(actor)
    return this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = "cms-release:build"
      const requestHash = stableHash(input)
      const replay = await this.replay(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return replay
      const active = await this.active(manager)
      const candidates = await this.candidates(manager, active.releaseId, input)
      const activeRelease = active.releaseId ? await manager.getRepository(CmsReleaseEntity).findOneBy({ id: active.releaseId }) : null
      const result = materializeRelease(candidates, await this.siteDefaults(manager, activeRelease?.siteSettingsRevisionId ?? null))
      if (result.issues.some((issue) => issue.severity === "error")) {
        throw new UnprocessableEntityException({ code: "CMS_RELEASE_VALIDATION_FAILED", message: "Релиз не прошёл валидацию", details: { issues: result.issues } })
      }
      if (result.routes.length === 0) {
        throw new UnprocessableEntityException({ code: "CMS_RELEASE_VALIDATION_FAILED", message: "Пустой релиз нельзя опубликовать", details: { issues: [{ severity: "error", code: "RELEASE_EMPTY", message: "В релизе должна остаться хотя бы одна страница" }] } })
      }
      const now = new Date()
      const releaseId = randomUUID()
      const sequence = await this.nextSequence(manager)
      const routes = result.routes.map((route) => ({ path: route.content.path, nodeId: route.candidate.node.id, revisionId: route.candidate.revision.id, resolvedContentHash: route.resolvedContentHash, dependencyRefs: route.dependencies }))
        .sort((left, right) => left.path.localeCompare(right.path))
      const manifestHash = stableHash({ baseReleaseId: active.releaseId, routes, siteSettingsRevisionId: activeRelease?.siteSettingsRevisionId ?? null })
      const release = await manager.save(manager.create(CmsReleaseEntity, {
        id: releaseId, sequence, state: "ready", baseReleaseId: active.releaseId, siteSettingsRevisionId: activeRelease?.siteSettingsRevisionId ?? null, manifestHash,
        createdBy: actor.id, createdAt: now, publishedAt: null,
      }))
      await manager.save(CmsReleaseItemEntity, result.routes.map((route) => manager.create(CmsReleaseItemEntity, {
        id: randomUUID(), releaseId, path: route.content.path, nodeId: route.candidate.node.id,
        revisionId: route.candidate.revision.id, resolvedContentHash: route.resolvedContentHash,
        resolvedContent: route.content, dependencies: route.dependencies,
      })))
      const response = await this.detail(manager, release, active)
      await this.record(manager, release, "built", "cms.release.built", actor.id, requestId, routes.map((route) => route.path))
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    })
  }

  async activate(id: string, input: CmsReleaseActivateInput, actor: SessionUser, requestId: string): Promise<CmsReleaseDetail> {
    this.assert(actor)
    return this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = `cms-release:${id}:activate`
      const requestHash = stableHash(input)
      const replay = await this.replay(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return replay
      const release = await this.release(manager, id)
      if (release.state !== "ready" || release.baseReleaseId !== input.baseReleaseId) throw this.staleRelease()
      const active = await this.active(manager)
      this.assertActiveBase(active, input)
      const items = await manager.getRepository(CmsReleaseItemEntity).findBy({ releaseId: id })
      await this.assertActivatable(manager, items)
      const published = await manager.createQueryBuilder().update(CmsReleaseEntity).set({ state: "published", publishedAt: new Date() })
        .where("id = :id AND state = 'ready'", { id }).execute()
      if (published.affected !== 1) throw this.staleRelease()
      const approvedIds = (await manager.getRepository(CmsNodeRevisionEntity).findBy({ id: In(items.map((item) => item.revisionId)) }))
        .filter((revision) => revision.state === "approved").map((revision) => revision.id)
      if (approvedIds.length > 0) {
        const moved = await manager.createQueryBuilder().update(CmsNodeRevisionEntity).set({ state: "published" })
          .where("id IN (:...ids) AND state = 'approved'", { ids: approvedIds }).execute()
        if (moved.affected !== approvedIds.length) throw this.staleRelease()
      }
      const updatedActive = await this.casActive(manager, active, input, id, actor.id)
      const updated = await this.release(manager, id)
      const response = await this.detail(manager, updated, updatedActive)
      await this.record(manager, updated, "published", "cms.release.published", actor.id, requestId, items.map((item) => item.path))
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    })
  }

  async rollback(sourceReleaseId: string, input: CmsReleaseActivateInput, actor: SessionUser, requestId: string): Promise<CmsReleaseDetail> {
    this.assert(actor)
    return this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = `cms-release:${sourceReleaseId}:rollback`
      const requestHash = stableHash(input)
      const replay = await this.replay(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return replay
      const source = await this.release(manager, sourceReleaseId)
      if (source.state !== "published") throw new ConflictException({ code: "CMS_RELEASE_NOT_PUBLISHED", message: "Откатить можно только опубликованный релиз" })
      const active = await this.active(manager)
      this.assertActiveBase(active, input)
      const sourceItems = await manager.getRepository(CmsReleaseItemEntity).findBy({ releaseId: source.id })
      await this.assertActivatable(manager, sourceItems)
      const now = new Date()
      const id = randomUUID()
      const sequence = await this.nextSequence(manager)
      const routes = sourceItems.map((item) => ({ path: item.path, nodeId: item.nodeId, revisionId: item.revisionId, resolvedContentHash: item.resolvedContentHash, dependencyRefs: item.dependencies }))
        .sort((left, right) => left.path.localeCompare(right.path))
      const release = await manager.save(manager.create(CmsReleaseEntity, {
        id, sequence, state: "published", baseReleaseId: active.releaseId,
        siteSettingsRevisionId: source.siteSettingsRevisionId, manifestHash: stableHash({ baseReleaseId: active.releaseId, routes, siteSettingsRevisionId: source.siteSettingsRevisionId }), createdBy: actor.id, createdAt: now, publishedAt: now,
      }))
      await manager.save(CmsReleaseItemEntity, sourceItems.map((item) => manager.create(CmsReleaseItemEntity, {
        id: randomUUID(), releaseId: id, path: item.path, nodeId: item.nodeId, revisionId: item.revisionId,
        resolvedContentHash: item.resolvedContentHash, resolvedContent: item.resolvedContent, dependencies: item.dependencies,
      })))
      const updatedActive = await this.casActive(manager, active, input, id, actor.id)
      const response = await this.detail(manager, release, updatedActive)
      await this.record(manager, release, "rolled_back", "cms.release.rolled_back", actor.id, requestId, sourceItems.map((item) => item.path))
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    })
  }

  private async candidates(manager: EntityManager, activeReleaseId: string | null, input: CmsReleaseBuildInput): Promise<Candidate[]> {
    const baseItems = activeReleaseId ? await manager.getRepository(CmsReleaseItemEntity).findBy({ releaseId: activeReleaseId }) : []
    const baseRevisionIds = baseItems.map((item) => item.revisionId)
    const selected = await manager.getRepository(CmsNodeRevisionEntity).findBy({ id: In(input.revisionIds) })
    const revisions = await manager.getRepository(CmsNodeRevisionEntity).findBy({ id: In([...new Set([...baseRevisionIds, ...input.revisionIds])]) })
    if (selected.length !== input.revisionIds.length) throw new UnprocessableEntityException({ code: "CMS_RELEASE_VALIDATION_FAILED", message: "Не все выбранные версии найдены", details: { issues: [{ severity: "error", code: "REVISION_NOT_FOUND", message: "Одна из выбранных версий не найдена" }] } })
    const selectedById = new Map(selected.map((revision) => [revision.id, revision]))
    for (const id of input.revisionIds) {
      if (selectedById.get(id)?.state !== "approved") throw new UnprocessableEntityException({ code: "CMS_RELEASE_VALIDATION_FAILED", message: "В релиз можно добавить только одобренную версию", details: { issues: [{ severity: "error", code: "REVISION_NOT_APPROVED", message: "Выбранная версия не одобрена" }] } })
    }
    const revisionById = new Map(revisions.map((revision) => [revision.id, revision]))
    const byNode = new Map<string, CmsNodeRevisionEntity>()
    for (const item of baseItems) {
      const revision = revisionById.get(item.revisionId)
      if (!revision || revision.nodeId !== item.nodeId || revision.state !== "published") throw new ConflictException({ code: "CMS_BASE_RELEASE_INVALID", message: "Базовый релиз повреждён" })
      byNode.set(item.nodeId, revision)
    }
    for (const revision of selected) byNode.set(revision.nodeId, revision)
    if (selected.some((revision) => input.removeNodeIds.includes(revision.nodeId))) {
      throw new UnprocessableEntityException({ code: "CMS_RELEASE_VALIDATION_FAILED", message: "Версия не может быть выбрана и удалена одновременно", details: { issues: [{ severity: "error", code: "NODE_SELECTED_AND_REMOVED", message: "Материал нельзя одновременно включить и удалить" }] } })
    }
    if (input.removeNodeIds.length > 0) {
      const removableNodes = await manager.getRepository(CmsNodeEntity).findBy({ id: In(input.removeNodeIds) })
      if (removableNodes.length !== input.removeNodeIds.length) {
        throw new UnprocessableEntityException({ code: "CMS_RELEASE_VALIDATION_FAILED", message: "Не все удаляемые материалы найдены", details: { issues: [{ severity: "error", code: "NODE_NOT_FOUND", message: "Один из удаляемых материалов не найден" }] } })
      }
    }
    for (const nodeId of input.removeNodeIds) byNode.delete(nodeId)
    const nodes = await manager.getRepository(CmsNodeEntity).findBy({ id: In([...byNode.keys()]) })
    const nodesById = new Map(nodes.map((node) => [node.id, node]))
    if (nodesById.size !== byNode.size) throw new ConflictException({ code: "CMS_BASE_RELEASE_INVALID", message: "Релиз ссылается на отсутствующий материал" })
    if (selected.some((revision) => nodesById.get(revision.nodeId)?.status !== "active")) throw new ConflictException({ code: "CMS_NODE_ARCHIVED", message: "Архивную версию нельзя включить в новую публикацию" })
    const candidates = [...byNode.entries()].flatMap(([nodeId, revision]) => {
      const node = nodesById.get(nodeId)
      return node ? [{ node, revision }] : []
    })
    return this.withSourceKinds(manager, candidates)
  }

  private async assertActivatable(manager: EntityManager, items: CmsReleaseItemEntity[]) {
    if (items.length === 0) throw new ConflictException({ code: "CMS_RELEASE_EMPTY", message: "В релизе нет страниц" })
    const sourceLinks = await manager.getRepository(CmsSourceLinkEntity).findBy({ nodeId: In(items.map((item) => item.nodeId)) })
    if (sourceLinks.some((link) => blockedOperationalSourceKinds.has(link.sourceKind))) {
      throw new ConflictException({ code: "CMS_RELEASE_INVALID", message: "Релиз содержит operational Event/ProgramOccurrence без разрешённой публичной проекции" })
    }
    const itemByNode = new Map(items.map((item) => [item.nodeId, item]))
    for (const link of sourceLinks.filter((candidate) => candidate.sourceKind === blockedCatalogSourceKind)) {
      const item = itemByNode.get(link.nodeId)
      if (!item) throw new ConflictException({ code: "CMS_RELEASE_INVALID", message: "Релиз содержит CatalogOffering без страницы" })
      const node = await manager.getRepository(CmsNodeEntity).findOneBy({ id: item.nodeId })
      const revision = await manager.getRepository(CmsNodeRevisionEntity).findOneBy({ id: item.revisionId })
      const expected = node && revision ? await this.safeProjectionDependency(manager, { node, revision }, link) : null
      const dependencies = ReleaseDependencyRefSchema.array().safeParse(item.dependencies)
      const actual = dependencies.success
        ? dependencies.data.find((dependency) => dependency.type === "crm_projection" && dependency.id === link.sourceId)
        : undefined
      if (!expected || !actual || actual.version !== expected.version || actual.contentHash !== expected.contentHash) {
        throw new ConflictException({ code: "CMS_RELEASE_INVALID", message: "Релиз содержит CatalogOffering без закреплённой safe public projection" })
      }
    }
    for (const item of items) {
      const content = PublicReleasePageContentSchema.safeParse(item.resolvedContent)
      const dependencies = ReleaseDependencyRefSchema.array().safeParse(item.dependencies)
      if (!content.success || !dependencies.success || content.data.path !== item.path || stableHash(content.data) !== item.resolvedContentHash) {
        throw new ConflictException({ code: "CMS_RELEASE_INVALID", message: "Релиз требует повторной сборки" })
      }
    }
  }

  private async withSourceKinds(manager: EntityManager, candidates: Array<{ node: CmsNodeEntity; revision: CmsNodeRevisionEntity }>): Promise<Candidate[]> {
    if (candidates.length === 0) return []
    const links = await manager.getRepository(CmsSourceLinkEntity).findBy({ nodeId: In(candidates.map((candidate) => candidate.node.id)) })
    const sourceByNode = new Map(links.map((link) => [link.nodeId, link]))
    const resolved: Candidate[] = []
    for (const candidate of candidates) {
      const link = sourceByNode.get(candidate.node.id)
      resolved.push({
        ...candidate,
        sourceKind: link?.sourceKind ?? null,
        safeProjectionDependency: link?.sourceKind === blockedCatalogSourceKind
          ? await this.safeProjectionDependency(manager, candidate, link)
          : null,
      })
    }
    return resolved
  }

  private async safeProjectionDependency(
    manager: EntityManager,
    candidate: { node: CmsNodeEntity; revision: CmsNodeRevisionEntity },
    link: CmsSourceLinkEntity,
  ): Promise<ReleaseDependencyRef | null> {
    const offering = await manager.getRepository(CatalogOfferingEntity).findOneBy({ id: link.sourceId })
    if (offering?.kind === "venue") return this.safeVenueProjectionDependency(manager, candidate, link)
    return this.safeAddOnProjectionDependency(manager, candidate, link)
  }

  private async safeVenueProjectionDependency(
    manager: EntityManager,
    candidate: { node: CmsNodeEntity; revision: CmsNodeRevisionEntity },
    link: CmsSourceLinkEntity,
  ): Promise<ReleaseDependencyRef | null> {
    const offering = await manager.getRepository(CatalogOfferingEntity).findOneBy({ id: link.sourceId })
    if (!offering || offering.kind !== "venue" || offering.state !== "active" || offering.archivedAt !== null) return null
    if (candidate.node.kind !== "resource_detail" || candidate.node.status !== "active" || candidate.node.archivedAt !== null) return null
    const profile = await manager.getRepository(CmsPublicProfileEntity).findOneBy({ kind: "catalog_offering", entityId: offering.id, nodeId: candidate.node.id })
    if (!profile || profile.archivedAt !== null) return null
    const relations = candidate.revision.relations.filter((relation) => relation.kind === "catalog_offering")
    if (relations.length !== 1 || relations[0]?.entityId !== offering.id) return null
    const bindings = await manager.getRepository(OfferingBindingEntity).find({ where: { offeringId: offering.id, role: "primary", archivedAt: IsNull() } })
    if (bindings.length !== 1 || !bindings[0]!.resourceId) return null
    const resource = await manager.getRepository(ResourceEntity).findOneBy({ id: bindings[0]!.resourceId, archivedAt: IsNull() })
    if (!resource || resource.archivedAt !== null || !["venue", "venues"].includes(resource.kind) || resource.capacityMode !== "fixed" || resource.capacityTotal <= 0) return null
    const calendar = await manager.getRepository(BusinessCalendarEntity).findOneBy({ id: offering.businessCalendarId, state: "active", archivedAt: IsNull() })
    const priceBook = offering.activePriceBookId ? await manager.getRepository(PriceBookEntity).findOneBy({ id: offering.activePriceBookId, offeringId: offering.id, state: "active", archivedAt: IsNull() }) : null
    if (!calendar || !priceBook) return null
    return createPublicVenueProjectionDependency({ offeringId: offering.id, nodeId: candidate.node.id, profileRevisionId: candidate.revision.id })
  }

  private async safeAddOnProjectionDependency(
    manager: EntityManager,
    candidate: { node: CmsNodeEntity; revision: CmsNodeRevisionEntity },
    link: CmsSourceLinkEntity,
  ): Promise<ReleaseDependencyRef | null> {
    const offering = await manager.getRepository(CatalogOfferingEntity).findOneBy({ id: link.sourceId })
    if (!offering || offering.kind !== "addon" || offering.state !== "active" || offering.archivedAt !== null) return null
    if (candidate.node.kind !== "addon_detail" || candidate.node.status !== "active" || candidate.node.archivedAt !== null) return null
    const profile = await manager.getRepository(CmsPublicProfileEntity).findOneBy({
      kind: "catalog_offering", entityId: offering.id, nodeId: candidate.node.id,
    })
    if (!profile || profile.archivedAt !== null) return null
    const relations = candidate.revision.relations.filter((relation) => relation.kind === "catalog_offering")
    if (relations.length !== 1 || relations[0]?.entityId !== offering.id) return null
    const terms = await manager.getRepository(AddonOfferingTermsEntity).findOneBy({ offeringId: offering.id })
    const publicTerms = terms ? PublicAddOnTermsSchema.safeParse({
      serviceType: terms.serviceType,
      standalone: terms.standalone,
      categoryKey: terms.categoryKey,
      quantity: {
        unit: terms.serviceType === "person_service" ? "participants" : "unit",
        minimum: terms.minimumQuantity,
        maximum: terms.maximumQuantity,
        default: terms.defaultQuantity,
        step: terms.quantityStep,
      },
    }) : null
    if (!publicTerms?.success) return null
    return createPublicAddOnProjectionDependency({
      offeringId: offering.id,
      nodeId: candidate.node.id,
      profileRevisionId: candidate.revision.id,
    })
  }

  private async detail(manager: EntityManager, release: CmsReleaseEntity, activeOverride?: CmsActiveReleaseEntity): Promise<CmsReleaseDetail> {
    const items = await manager.getRepository(CmsReleaseItemEntity).findBy({ releaseId: release.id })
    const routes = items.map((item) => ({ path: item.path, nodeId: item.nodeId, revisionId: item.revisionId, resolvedContentHash: item.resolvedContentHash, dependencyRefs: ReleaseDependencyRefSchema.array().parse(item.dependencies) }))
      .sort((left, right) => left.path.localeCompare(right.path))
    const manifest: ReleaseManifest = ReleaseManifestSchema.parse({
      id: release.id, sequence: release.sequence, state: release.state, baseReleaseId: release.baseReleaseId,
      routes, manifestHash: release.manifestHash, createdBy: release.createdBy, createdAt: release.createdAt.toISOString(),
      publishedAt: release.publishedAt?.toISOString() ?? null,
    })
    const active = activeOverride ?? await this.active(manager)
    return CmsReleaseDetailSchema.parse({ manifest, validation: { releaseId: release.id, valid: release.state !== "failed", issues: [], checkedAt: release.createdAt.toISOString() }, activeReleaseId: active.releaseId, activeReleaseVersion: active.version })
  }

  private async active(manager: EntityManager) {
    const active = await manager.getRepository(CmsActiveReleaseEntity).findOneBy({ singletonKey: "public" })
    if (!active) throw new ConflictException({ code: "CMS_ACTIVE_RELEASE_MISSING", message: "Указатель активного релиза не инициализирован" })
    return active
  }

  private async release(manager: EntityManager, id: string) {
    const release = await manager.getRepository(CmsReleaseEntity).findOneBy({ id })
    if (!release) throw this.notFound()
    return release
  }

  private async nextSequence(manager: EntityManager): Promise<number> {
    const raw = await manager.query("SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM cms_releases") as Array<{ next: string | number }>
    return Number(raw[0]?.next ?? 1)
  }

  private async siteDefaults(manager: EntityManager, revisionId: string | null): Promise<{ hero: CmsHeroConfig | null; sections: PublicReleasePageContent["sections"] } | undefined> {
    if (!revisionId) return undefined
    const revision = await manager.getRepository(CmsSiteSettingsRevisionEntity).findOneBy({ id: revisionId })
    if (!revision) throw new ConflictException({ code: "CMS_BASE_RELEASE_INVALID", message: "Базовые настройки публикации не найдены" })
    const value = CmsSiteSettingsValueSchema.parse(revision.value)
    return { hero: value.heroDefault, sections: value.sectionDefaults }
  }

  private assertActiveBase(active: CmsActiveReleaseEntity, input: CmsReleaseActivateInput) {
    if (active.version !== input.expectedActiveReleaseVersion || active.releaseId !== input.baseReleaseId) throw this.staleRelease()
  }

  private async casActive(manager: EntityManager, active: CmsActiveReleaseEntity, input: CmsReleaseActivateInput, releaseId: string, actorId: string) {
    const basePredicate = input.baseReleaseId === null ? "release_id IS NULL" : "release_id = :baseReleaseId"
    const result = await manager.createQueryBuilder().update(CmsActiveReleaseEntity).set({ releaseId, updatedBy: actorId, updatedAt: new Date(), version: () => '"version" + 1' })
      .where(`singleton_key = 'public' AND version = :version AND ${basePredicate}`, { version: input.expectedActiveReleaseVersion, baseReleaseId: input.baseReleaseId ?? undefined }).execute()
    if (result.affected !== 1) throw this.staleRelease()
    return manager.findOneByOrFail(CmsActiveReleaseEntity, { singletonKey: "public" })
  }

  private async replay(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string): Promise<CmsReleaseDetail | null> {
    const row = await manager.getRepository(IdempotencyKeyEntity).findOne({ where: [{ scope, operationId }, { scope, idempotencyKey }] })
    if (!row) return null
    if (row.idempotencyKey !== idempotencyKey || row.requestHash !== requestHash) throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Ключ идемпотентности уже использован с другими данными" })
    return row.responseBody as CmsReleaseDetail
  }

  private async remember(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string, response: CmsReleaseDetail) {
    await manager.save(manager.create(IdempotencyKeyEntity, { id: randomUUID(), scope, operationId, idempotencyKey, requestHash, responseStatus: 200, responseBody: response, createdAt: new Date() }))
  }

  private async replayValue<T>(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string): Promise<T | null> {
    const row = await manager.getRepository(IdempotencyKeyEntity).findOne({ where: [{ scope, operationId }, { scope, idempotencyKey }] })
    if (!row) return null
    if (row.idempotencyKey !== idempotencyKey || row.requestHash !== requestHash) throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Ключ идемпотентности уже использован" })
    return row.responseBody as T
  }

  private async rememberValue(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string, response: unknown) {
    await manager.save(manager.create(IdempotencyKeyEntity, { id: randomUUID(), scope, operationId, idempotencyKey, requestHash, responseStatus: 200, responseBody: response as Record<string, unknown>, createdAt: new Date() }))
  }

  private async record(manager: EntityManager, release: CmsReleaseEntity, action: "built" | "published" | "rolled_back", eventType: CmsReleaseOutboxEvent["eventType"], actorId: string, requestId: string, affectedPaths: string[]) {
    const now = new Date()
    const event = CmsReleaseOutboxEventSchema.parse({ eventId: randomUUID(), eventType, occurredAt: now.toISOString(), actorId, requestId, releaseId: release.id, baseReleaseId: release.baseReleaseId, sequence: release.sequence, affectedPaths })
    await manager.save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "cms_release", entityId: release.id, action, actorId, requestId, changes: { baseReleaseId: release.baseReleaseId, sequence: release.sequence, affectedPaths }, createdAt: now }))
    await manager.save(manager.create(OutboxEventEntity, { id: event.eventId, topic: event.eventType, aggregateType: "cms_release", aggregateId: release.id, payload: event, availableAt: now, processedAt: null, attempts: 0, createdAt: now }))
  }

  private assert(actor: SessionUser) {
    if (actor.capabilities.canPublishContent !== true) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Capability canPublishContent is required" })
  }

  private assertView(actor: SessionUser) {
    if (actor.capabilities.canViewContent !== true) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Capability canViewContent is required" })
  }

  private staleRelease() { return new ConflictException({ code: "CMS_RELEASE_STALE", message: "Активный релиз изменился; соберите или активируйте релиз заново" }) }
  private notFound() { return new NotFoundException({ code: "CMS_RELEASE_NOT_FOUND", message: "Релиз не найден" }) }
}

export function materializeRelease(candidates: Candidate[], siteDefaults?: { hero: CmsHeroConfig | null; sections: PublicReleasePageContent["sections"] }): MaterializationResult {
  const issues: ReleaseValidationIssue[] = []
  const byNode = new Map(candidates.map((candidate) => [candidate.node.id, candidate]))
  const resolved = new Map<string, MaterializedRoute | null>()
  const visiting = new Set<string>()
  const resolve = (candidate: Candidate): MaterializedRoute | null => {
    const cached = resolved.get(candidate.node.id)
    if (cached !== undefined) return cached
    if (visiting.has(candidate.node.id)) { issues.push(issue("CMS_PARENT_CYCLE", "В релизе обнаружен цикл родительских страниц", candidate.revision.path)); resolved.set(candidate.node.id, null); return null }
    visiting.add(candidate.node.id)
    const parent = candidate.revision.parentNodeId ? byNode.get(candidate.revision.parentNodeId) : undefined
    const parentRoute = parent ? resolve(parent) : null
    if (candidate.revision.parentNodeId && !parent) issues.push(issue("CMS_PARENT_NOT_IN_RELEASE", "Родительская страница отсутствует в собираемом релизе", candidate.revision.path))
    if (candidate.revision.parentNodeId && parentRoute) {
      const expected = parentRoute.content.path === "/" ? `/${candidate.revision.slug}` : `${parentRoute.content.path}/${candidate.revision.slug}`
      if (candidate.revision.path !== expected) issues.push(issue("CMS_ROUTE_PARENT_MISMATCH", `URL не соответствует опубликованному родителю: ${expected}`, candidate.revision.path))
    }
    if (candidate.node.kind === "home" && (candidate.revision.path !== "/" || candidate.revision.parentNodeId !== null)) issues.push(issue("CMS_HOME_ROUTE_INVALID", "Главная страница должна иметь URL / без родителя", candidate.revision.path))
    if (candidate.node.kind !== "home" && candidate.revision.path === "/") issues.push(issue("CMS_ROUTE_RESERVED", "URL / зарезервирован для главной страницы", candidate.revision.path))
    if (candidate.revision.path.startsWith("/drafts/")) issues.push(issue("CMS_SOURCE_ROUTE_REQUIRED", "Служебный URL CRM-черновика нельзя опубликовать", candidate.revision.path))
    const blockedOperationalSource = candidate.sourceKind !== null && candidate.sourceKind !== undefined && blockedOperationalSourceKinds.has(candidate.sourceKind)
    if (blockedOperationalSource) {
      issues.push(issue("CMS_OPERATIONAL_SOURCE_PUBLIC_PROFILE_REQUIRED", "Operational Event/ProgramOccurrence нельзя публиковать до появления явной allowlisted public offering/profile projection", candidate.revision.path))
    } else if (candidate.sourceKind === blockedCatalogSourceKind) {
      const safeProjection = candidate.safeProjectionDependency?.type === "crm_projection"
        && ((candidate.node.kind === "addon_detail" && candidate.safeProjectionDependency.version === "public.addon-summary.v1")
          || (candidate.node.kind === "resource_detail" && candidate.safeProjectionDependency.version === "public.venue-summary.v1"))
        && candidate.safeProjectionDependency.contentHash
      if (!safeProjection) issues.push(issue("CMS_CATALOG_OFFERING_SAFE_PROJECTION_REQUIRED", "Предложение нельзя публиковать до появления exact public profile/relation и закреплённой safe public projection", candidate.revision.path))
    } else if (candidate.revision.relations.length > 0) {
      issues.push(issue("CRM_PROJECTION_UNRESOLVED", "Связи с CRM не имеют закреплённой публичной проекции", candidate.revision.path))
    }
    const heroPolicy = CmsHeroPolicySchema.safeParse(candidate.revision.hero ?? { mode: "disabled" })
    let hero = parentRoute ? parentRoute.content.hero : siteDefaults?.hero ?? null
    if (!heroPolicy.success) issues.push(issue("CMS_HERO_INVALID", "Hero не соответствует шаблону", candidate.revision.path))
    else if (heroPolicy.data.mode === "disabled") hero = null
    else if (heroPolicy.data.mode === "override") hero = heroPolicy.data.config
    else if (!parentRoute && siteDefaults === undefined) issues.push(issue("CMS_HERO_BASE_MISSING", "Для наследуемого hero не найден родительский или глобальный шаблон", candidate.revision.path))
    if (hero) validateHeroMedia(hero, candidate.revision.path, issues)
    const parentSections = parentRoute
      ? new Map(parentRoute.content.sections.map((section) => [section.key, section]))
      : new Map((siteDefaults?.sections ?? []).map((section) => [section.key, clone(section)]))
    const own = new Map<string, CmsSection>()
    for (const raw of candidate.revision.sections) {
      const parsed = CmsSectionSchema.safeParse(raw)
      if (!parsed.success) { issues.push(issue("CMS_SECTION_INVALID", "Секция не соответствует опубликованному контракту", candidate.revision.path)); continue }
      if (own.has(parsed.data.key)) { issues.push(issue("CMS_SECTION_DUPLICATE", `Секция ${parsed.data.key} повторяется`, candidate.revision.path)); continue }
      own.set(parsed.data.key, parsed.data)
    }
    for (const section of own.values()) {
      const inherited = parentSections.get(section.key)
      if (section.policy.mode === "disabled") { parentSections.delete(section.key); continue }
      if (section.policy.mode === "inherit") {
        if (!inherited) { issues.push(issue("CMS_INHERITANCE_BASE_MISSING", `Для секции ${section.key} отсутствует явная база родителя/site/page type`, candidate.revision.path)); continue }
        if (inherited.renderer !== section.renderer || inherited.rendererVersion !== section.rendererVersion) { issues.push(issue("CMS_INHERITANCE_RENDERER_MISMATCH", `Нельзя наследовать конфигурацию секции ${section.key} от другого renderer`, candidate.revision.path)); continue }
        parentSections.set(section.key, { id: section.id, key: section.key, renderer: section.renderer, rendererVersion: section.rendererVersion, schemaVersion: section.schemaVersion, order: section.order, config: clone(inherited.config), ...(section.analyticsActionId ? { analyticsActionId: section.analyticsActionId } : {}) })
        continue
      }
      const config = applyPatch(inherited?.config ?? {}, section.policy.patch, candidate.revision.path, issues)
      parentSections.set(section.key, { id: section.id, key: section.key, renderer: section.renderer, rendererVersion: section.rendererVersion, schemaVersion: section.schemaVersion, order: section.order, config: config as never, ...(section.analyticsActionId ? { analyticsActionId: section.analyticsActionId } : {}) })
    }
    for (const section of parentSections.values()) {
      if ((section.key === "partners" || section.renderer === "partners") && !CmsPartnersSectionSchema.safeParse(section).success) {
        issues.push(issue("CMS_PARTNERS_SECTION_INVALID", "Проверьте заголовок, список партнёров и версию секции", candidate.revision.path))
      }
      if ((section.key === "why-us" || section.renderer === "why-us") && !CmsWhyUsSectionSchema.safeParse(section).success) {
        issues.push(issue("CMS_WHY_US_SECTION_INVALID", "Проверьте заголовок, факты, командный блок и версию секции", candidate.revision.path))
      }
      if (isCmsHomeSectionKey(section.key) && !CmsHomeSectionSchema.safeParse(section).success) {
        issues.push(issue("CMS_HOMEPAGE_SECTION_INVALID", "Проверьте редакционные поля и версию секции главной", candidate.revision.path))
      }
    }
    visiting.delete(candidate.node.id)
    const content = PublicReleasePageContentSchema.parse({ kind: candidate.node.kind, path: candidate.revision.path, title: candidate.revision.title, summary: candidate.revision.summary, hero, sections: [...parentSections.values()].sort((left, right) => left.order - right.order || left.key.localeCompare(right.key)), seo: candidate.revision.seo })
    const ownDependency: ReleaseDependencyRef = { type: "node_revision", id: candidate.revision.id, version: String(candidate.revision.revision), contentHash: candidate.revision.contentHash }
    const dependencies = normalizeDependencies([
      ...(parentRoute?.dependencies ?? []),
      ownDependency,
      ...(candidate.safeProjectionDependency ? [candidate.safeProjectionDependency] : []),
    ])
    const route = { candidate, content, dependencies, resolvedContentHash: stableHash(content) }
    resolved.set(candidate.node.id, route)
    return route
  }
  const routes = candidates.map(resolve).filter((route): route is MaterializedRoute => route !== null)
  const paths = new Map<string, MaterializedRoute>()
  for (const route of routes) {
    if (paths.has(route.content.path)) issues.push(issue("CMS_RELEASE_PATH_CONFLICT", "В релизе два материала используют один URL", route.content.path))
    paths.set(route.content.path, route)
  }
  if (routes.filter((route) => route.content.kind === "home").length > 1) issues.push(issue("CMS_HOME_DUPLICATE", "В релизе может быть только одна главная страница"))
  return { routes, issues }
}

function applyPatch(base: Record<string, unknown>, patch: CmsConfigPatch, route: string, issues: ReleaseValidationIssue[]) {
  const config = clone(base)
  for (const [key, change] of Object.entries(patch.scalars)) {
    if (change.operation === "replace") config[key] = clone(change.value)
    else delete config[key]
  }
  for (const [key, merge] of Object.entries(patch.objects)) {
    const existing = config[key]
    if (existing !== undefined && (!existing || typeof existing !== "object" || Array.isArray(existing))) { issues.push(issue("CMS_PATCH_OBJECT_CONFLICT", `Поле ${key} нельзя объединить как объект`, route)); continue }
    const value = existing && typeof existing === "object" ? clone(existing as Record<string, unknown>) : {}
    for (const [field, change] of Object.entries(merge.values)) {
      if (change.operation === "replace") value[field] = clone(change.value)
      else delete value[field]
    }
    config[key] = value
  }
  for (const [key, operations] of Object.entries(patch.keyedArrays)) {
    const existing = config[key]
    if (existing !== undefined && !Array.isArray(existing)) { issues.push(issue("CMS_PATCH_ARRAY_CONFLICT", `Поле ${key} нельзя обработать как keyed array`, route)); continue }
    const entries = new Map<string, Record<string, unknown>>()
    const order: string[] = []
    for (const item of (existing ?? []) as unknown[]) {
      if (!item || typeof item !== "object" || Array.isArray(item) || typeof (item as Record<string, unknown>).key !== "string" || !((item as Record<string, unknown>).value) || typeof (item as Record<string, unknown>).value !== "object") { issues.push(issue("CMS_PATCH_ARRAY_SHAPE_INVALID", `Keyed array ${key} не имеет materialized формы`, route)); continue }
      const entry = item as { key: string; value: Record<string, unknown> }; entries.set(entry.key, clone(entry.value)); order.push(entry.key)
    }
    for (const operation of operations) {
      if (operation.operation === "insert") { if (entries.has(operation.key)) { issues.push(issue("CMS_PATCH_ARRAY_KEY_CONFLICT", `Ключ ${operation.key} уже существует`, route)); continue }; entries.set(operation.key, clone(operation.value)); insertAfter(order, operation.key, operation.afterKey, route, issues) }
      if (operation.operation === "update") { const value = entries.get(operation.key); if (!value) { issues.push(issue("CMS_PATCH_ARRAY_KEY_MISSING", `Ключ ${operation.key} не найден`, route)); continue }; for (const [field, change] of Object.entries(operation.patch.values)) { if (change.operation === "replace") value[field] = clone(change.value); else delete value[field] } }
      if (operation.operation === "remove") { if (!entries.delete(operation.key)) { issues.push(issue("CMS_PATCH_ARRAY_KEY_MISSING", `Ключ ${operation.key} не найден`, route)); continue }; order.splice(order.indexOf(operation.key), 1) }
      if (operation.operation === "move") { if (!entries.has(operation.key)) { issues.push(issue("CMS_PATCH_ARRAY_KEY_MISSING", `Ключ ${operation.key} не найден`, route)); continue }; order.splice(order.indexOf(operation.key), 1); insertAfter(order, operation.key, operation.afterKey, route, issues) }
    }
    config[key] = order.map((entryKey) => ({ key: entryKey, value: entries.get(entryKey)! }))
  }
  return config
}

function insertAfter(order: string[], key: string, afterKey: string | null, route: string, issues: ReleaseValidationIssue[]) {
  if (afterKey === null) { order.unshift(key); return }
  const index = order.indexOf(afterKey)
  if (index < 0) { issues.push(issue("CMS_PATCH_ARRAY_ANCHOR_MISSING", `Ключ afterKey ${afterKey} не найден`, route)); order.push(key); return }
  order.splice(index + 1, 0, key)
}

function issue(code: string, message: string, route?: string): ReleaseValidationIssue { return { severity: "error", code, message, ...(route ? { route } : {}) } }
function validateHeroMedia(hero: CmsHeroConfig, route: string, issues: ReleaseValidationIssue[]) {
  const unresolved = (assetId: string | null, media: { assetId: string } | null, field: string) => {
    if (assetId && media?.assetId !== assetId) issues.push(issue("CMS_MEDIA_NOT_RESOLVED", `Hero: для ${field} нет готового public WebP/AVIF варианта`, route))
  }
  unresolved(hero.backgroundAssetId, hero.background, "фона")
  unresolved(hero.foregroundAssetId, hero.foreground, "переднего изображения")
  for (const slide of hero.slides) unresolved(slide.imageAssetId, slide.image, `слайда ${slide.title}`)
  for (const card of hero.featureCards) unresolved(card.imageAssetId, card.image, `карточки ${card.title}`)
}
function normalizeDependencies(dependencies: ReleaseDependencyRef[]): ReleaseDependencyRef[] {
  const deduped = new Map<string, ReleaseDependencyRef>()
  for (const dependency of dependencies) {
    const key = `${dependency.type}:${dependency.id}:${dependency.version}:${dependency.contentHash ?? ""}`
    deduped.set(key, dependency)
  }
  return [...deduped.values()].sort((left, right) => `${left.type}:${left.id}:${left.version}:${left.contentHash ?? ""}`.localeCompare(`${right.type}:${right.id}:${right.version}:${right.contentHash ?? ""}`))
}
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function stableHash(value: unknown): string { return createHash("sha256").update(stableStringify(value)).digest("hex") }
function stableStringify(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`; return JSON.stringify(value) }
