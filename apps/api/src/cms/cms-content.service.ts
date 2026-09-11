import { createHash, randomUUID } from "node:crypto"

import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common"
import { DataSource, In, type EntityManager } from "typeorm"

import {
  canonicalPublicPath,
  CmsContentOutboxEventSchema,
  CmsNodeRevisionSchema,
  IdSchema,
  type CmsContentOutboxEvent,
  type CmsNodeArchive,
  type CmsNodeCreate,
  type CmsNodeDetail,
  type CmsNodeIdentity,
  type CmsNodeListQuery,
  type CmsNodeListResponse,
  type CmsNodeMutation,
  type CmsNodeRevision,
  type CmsNodeRevisionMetadata,
  type CmsNodeTransition,
  type SessionUser,
} from "@crm/contracts"
import { ChangeLogEntity, CmsNodeEntity, CmsNodeRevisionEntity, CmsSourceLinkEntity, IdempotencyKeyEntity, OutboxEventEntity } from "@crm/db"

type NodeCursor = { updatedAt: string; id: string }
type RevisionContent = Pick<CmsNodeRevision, "route" | "title" | "summary" | "sections" | "seo" | "relations" | "schemaVersion"> & { hero?: CmsNodeRevision["hero"] }

@Injectable()
export class CmsContentService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async list(query: CmsNodeListQuery, actor: SessionUser): Promise<CmsNodeListResponse> {
    this.assert(actor, "canViewContent")
    const cursor = query.cursor ? decodeCursor(query.cursor) : null
    const builder = this.dataSource.getRepository(CmsNodeEntity).createQueryBuilder("node")
    if (query.kind) builder.andWhere("node.kind = :kind", { kind: query.kind })
    if (query.status) builder.andWhere("node.status = :status", { status: query.status })
    if (query.q) {
      builder.andWhere(`EXISTS (
        SELECT 1 FROM cms_node_revisions revision
        WHERE revision.node_id = node.id
          AND revision.id = (
            SELECT latest.id FROM cms_node_revisions latest
            WHERE latest.node_id = node.id
            ORDER BY latest.revision DESC LIMIT 1
          )
          AND (LOWER(revision.title) LIKE :search ESCAPE '\\' OR LOWER(revision.path) LIKE :search ESCAPE '\\')
      )`, { search: `%${escapeLike(query.q.toLocaleLowerCase("ru-RU"))}%` })
    }
    if (cursor) {
      builder.andWhere("(node.updated_at, node.id) < (:cursorUpdatedAt, :cursorId)", {
        cursorUpdatedAt: cursor.updatedAt,
        cursorId: cursor.id,
      })
    }
    const rows = await builder.orderBy("node.updated_at", "DESC").addOrderBy("node.id", "DESC").take(query.limit + 1).getMany()
    const page = rows.slice(0, query.limit)
    const items = await Promise.all(page.map(async (node) => ({
      node: this.node(node),
      currentRevision: this.metadata(await this.findCurrentRevision(this.dataSource.manager, node.id)),
      latestPublished: this.metadata(await this.findLatestPublished(this.dataSource.manager, node.id)),
      source: await this.source(this.dataSource.manager, node.id),
    })))
    return {
      items,
      nextCursor: rows.length > query.limit && page.length > 0
        ? encodeCursor({ updatedAt: page.at(-1)!.updatedAt.toISOString(), id: page.at(-1)!.id })
        : null,
    }
  }

  async get(id: string, actor: SessionUser): Promise<CmsNodeDetail> {
    this.assert(actor, "canViewContent")
    return this.detail(this.dataSource.manager, await this.findNode(this.dataSource.manager, id))
  }

  async create(input: CmsNodeCreate, actor: SessionUser, requestId: string): Promise<CmsNodeDetail> {
    this.assert(actor, "canEditContent")
    return this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = "cms-node:create"
      const requestHash = mutationHash(input)
      const replay = await this.replay(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return replay
      await this.assertParent(manager, input.route.parentNodeId)
      await this.assertPlacement(manager, input.route, input.kind)
      const nodeId = randomUUID()
      if (input.route.parentNodeId === nodeId) throw this.invalidParent()
      const now = new Date()
      const node = await manager.save(manager.create(CmsNodeEntity, {
        id: nodeId,
        kind: input.kind,
        status: "active",
        createdBy: actor.id,
        updatedBy: actor.id,
        archivedAt: null,
      }))
      const content: RevisionContent = {
        route: input.route,
        title: input.title,
        summary: input.summary,
        hero: input.hero,
        sections: input.sections,
        seo: input.seo,
        relations: input.relations,
        schemaVersion: input.schemaVersion,
      }
      const revision = await this.saveRevision(manager, node.id, 1, "draft", content, actor.id, now)
      const response = await this.detail(manager, node, revision)
      await this.recordMutation(manager, node, revision, "created", "cms.content.node.created", actor.id, requestId, {
        revisionId: revision.id,
        contentHash: revision.contentHash,
        path: revision.path,
      })
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, requestHash, response, 201)
      return response
    })
  }

  async update(id: string, input: CmsNodeMutation, actor: SessionUser, requestId: string): Promise<CmsNodeDetail> {
    this.assert(actor, "canEditContent")
    return this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = `cms-node:${id}:update`
      const requestHash = mutationHash(input)
      const replay = await this.replay(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return replay
      const currentNode = await this.findNode(manager, id)
      this.assertActive(currentNode)
      if (currentNode.version !== input.expectedVersion) throw this.versionConflict(currentNode)
      const current = await manager.getRepository(CmsNodeRevisionEntity).findOne({ where: { nodeId: id, state: In(["draft", "published"]) }, order: { revision: "DESC" } })
      if (!current) throw new ConflictException({ code: "CMS_DRAFT_REQUIRED", message: "Для этого материала нет версии, доступной для редактирования" })
      const currentDto = this.revision(current)
      const content: RevisionContent = {
        route: input.route ?? currentDto.route,
        title: input.title ?? currentDto.title,
        summary: input.summary === undefined ? currentDto.summary : input.summary,
        hero: input.hero ?? currentDto.hero,
        sections: input.sections ?? currentDto.sections,
        seo: input.seo ?? currentDto.seo,
        relations: input.relations ?? currentDto.relations,
        schemaVersion: currentDto.schemaVersion,
      }
      await this.assertParent(manager, content.route.parentNodeId, id)
      await this.assertPlacement(manager, content.route, currentNode.kind)
      await this.assertRouteChangeAllowed(manager, id, currentDto.route, content.route)
      const updatedNode = await this.bumpNode(manager, currentNode, input.expectedVersion, actor.id)
      const nextRevision = await this.nextRevision(manager, id)
      if (current.state === "draft") {
        const superseded = await manager.getRepository(CmsNodeRevisionEntity).update({ id: current.id, state: "draft" }, { state: "superseded" })
        if (superseded.affected !== 1) throw this.versionConflict(currentNode)
      }
      const revision = await this.saveRevision(manager, id, nextRevision, "draft", content, actor.id, new Date())
      const response = await this.detail(manager, updatedNode, revision)
      await this.recordMutation(manager, updatedNode, revision, "revision_created", "cms.content.revision.created", actor.id, requestId, {
        supersededRevisionId: current.id,
        beforeContentHash: current.contentHash,
        afterContentHash: revision.contentHash,
      })
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    })
  }

  submitReview(id: string, input: CmsNodeTransition, actor: SessionUser, requestId: string) {
    this.assert(actor, "canEditContent")
    return this.transition(id, input, actor, requestId, "draft", "review", "submitted", "cms.content.revision.submitted")
  }

  returnToDraft(id: string, input: CmsNodeTransition, actor: SessionUser, requestId: string) {
    this.assert(actor, "canReviewContent")
    return this.transition(id, input, actor, requestId, "review", "draft", "returned", "cms.content.revision.returned")
  }

  approve(id: string, input: CmsNodeTransition, actor: SessionUser, requestId: string) {
    this.assert(actor, "canReviewContent")
    return this.transition(id, input, actor, requestId, "review", "approved", "approved", "cms.content.revision.approved")
  }

  async archive(id: string, input: CmsNodeArchive, actor: SessionUser, requestId: string): Promise<CmsNodeDetail> {
    this.assert(actor, "canEditContent")
    return this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = `cms-node:${id}:archive`
      const requestHash = mutationHash(input)
      const replay = await this.replay(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return replay
      const current = await this.findNode(manager, id)
      this.assertActive(current)
      const now = new Date()
      const result = await manager.createQueryBuilder().update(CmsNodeEntity).set({
        status: "archived",
        archivedAt: now,
        updatedBy: actor.id,
        updatedAt: now,
        version: () => '"version" + 1',
      }).where("id = :id AND version = :version AND status = 'active'", { id, version: input.expectedVersion }).execute()
      if (result.affected !== 1) throw this.versionConflict(current)
      const updated = await manager.findOneByOrFail(CmsNodeEntity, { id })
      const revision = await this.findCurrentRevision(manager, id)
      const response = await this.detail(manager, updated, revision)
      await this.recordMutation(manager, updated, revision, "archived", "cms.content.node.archived", actor.id, requestId, { previousStatus: current.status })
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    })
  }

  private async transition(
    id: string,
    input: CmsNodeTransition,
    actor: SessionUser,
    requestId: string,
    from: "draft" | "review",
    to: "draft" | "review" | "approved",
    action: "submitted" | "returned" | "approved",
    eventType: "cms.content.revision.submitted" | "cms.content.revision.returned" | "cms.content.revision.approved",
  ): Promise<CmsNodeDetail> {
    return this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = `cms-node:${id}:${action}`
      const requestHash = mutationHash(input)
      const replay = await this.replay(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return replay
      const currentNode = await this.findNode(manager, id)
      this.assertActive(currentNode)
      const revision = await manager.getRepository(CmsNodeRevisionEntity).findOne({ where: { nodeId: id, state: from }, order: { revision: "DESC" } })
      if (!revision) throw new ConflictException({ code: "INVALID_STATE_TRANSITION", message: `Нет версии в состоянии ${from} для этого перехода` })
      const updatedNode = await this.bumpNode(manager, currentNode, input.expectedVersion, actor.id)
      const changed = await manager.getRepository(CmsNodeRevisionEntity).update({ id: revision.id, state: from }, { state: to })
      if (changed.affected !== 1) throw this.versionConflict(currentNode)
      revision.state = to
      const response = await this.detail(manager, updatedNode, revision)
      await this.recordMutation(manager, updatedNode, revision, action, eventType, actor.id, requestId, {
        from,
        to,
        contentHash: revision.contentHash,
      })
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    })
  }

  private async detail(manager: EntityManager, node: CmsNodeEntity, current?: CmsNodeRevisionEntity | null): Promise<CmsNodeDetail> {
    const working = current === undefined ? await this.findCurrentRevision(manager, node.id) : current
    return {
      node: this.node(node),
      currentRevision: working ? this.revision(working) : null,
      latestPublished: this.metadata(await this.findLatestPublished(manager, node.id)),
      source: await this.source(manager, node.id),
    }
  }

  private node(row: CmsNodeEntity): CmsNodeIdentity {
    return { id: row.id, kind: row.kind as CmsNodeIdentity["kind"], status: row.status as CmsNodeIdentity["status"], createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), version: row.version }
  }

  private revision(row: CmsNodeRevisionEntity): CmsNodeRevision {
    return CmsNodeRevisionSchema.parse({
      id: row.id,
      nodeId: row.nodeId,
      revision: row.revision,
      state: row.state,
      route: { path: row.path, slug: row.slug, parentNodeId: row.parentNodeId, sortOrder: row.sortOrder },
      title: row.title,
      summary: row.summary,
      hero: row.hero,
      sections: row.sections,
      seo: row.seo,
      relations: row.relations,
      schemaVersion: row.schemaVersion,
      contentHash: row.contentHash,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
    })
  }

  private metadata(row: CmsNodeRevisionEntity | null): CmsNodeRevisionMetadata | null {
    if (!row) return null
    const revision = this.revision(row)
    return { id: revision.id, nodeId: revision.nodeId, revision: revision.revision, state: revision.state, route: revision.route, title: revision.title, contentHash: revision.contentHash, createdBy: revision.createdBy, createdAt: revision.createdAt }
  }

  private async saveRevision(manager: EntityManager, nodeId: string, revisionNumber: number, state: string, content: RevisionContent, actorId: string, createdAt: Date) {
    const contentHash = revisionContentHash(content)
    const parsed = CmsNodeRevisionSchema.parse({
      id: randomUUID(), nodeId, revision: revisionNumber, state, ...content, contentHash, createdBy: actorId, createdAt: createdAt.toISOString(),
    })
    return manager.save(manager.create(CmsNodeRevisionEntity, {
      id: parsed.id,
      nodeId,
      revision: revisionNumber,
      state,
      path: parsed.route.path,
      slug: parsed.route.slug,
      parentNodeId: parsed.route.parentNodeId,
      sortOrder: parsed.route.sortOrder,
      title: parsed.title,
      summary: parsed.summary,
      hero: parsed.hero,
      sections: parsed.sections,
      seo: parsed.seo,
      relations: parsed.relations,
      schemaVersion: parsed.schemaVersion,
      contentHash,
      createdBy: actorId,
      createdAt,
    }))
  }

  private async findNode(manager: EntityManager, id: string) {
    const node = await manager.findOneBy(CmsNodeEntity, { id })
    if (!node) throw new NotFoundException({ code: "CMS_NODE_NOT_FOUND", message: "Материал не найден" })
    return node
  }

  private findCurrentRevision(manager: EntityManager, nodeId: string) {
    return manager.getRepository(CmsNodeRevisionEntity).findOne({
      where: { nodeId, state: In(["draft", "review", "approved", "scheduled", "published"]) },
      order: { revision: "DESC" },
    })
  }

  private findLatestPublished(manager: EntityManager, nodeId: string) {
    return manager.getRepository(CmsNodeRevisionEntity).findOne({ where: { nodeId, state: "published" }, order: { revision: "DESC" } })
  }

  private async source(manager: EntityManager, nodeId: string) {
    const repository = manager.getRepository(CmsSourceLinkEntity)
    if (!repository || typeof repository.findOneBy !== "function") return null
    const row = await repository.findOneBy({ nodeId })
    return row ? { sourceKind: row.sourceKind as never, sourceId: row.sourceId, sourceVersion: row.sourceVersion, syncState: "draft" as const, createdAt: row.createdAt.toISOString() } : null
  }

  private async nextRevision(manager: EntityManager, nodeId: string): Promise<number> {
    const raw = await manager.getRepository(CmsNodeRevisionEntity).createQueryBuilder("revision")
      .select("COALESCE(MAX(revision.revision), 0)", "maximum")
      .where("revision.node_id = :nodeId", { nodeId })
      .getRawOne<{ maximum: string | number }>()
    return Number(raw?.maximum ?? 0) + 1
  }

  private async bumpNode(manager: EntityManager, node: CmsNodeEntity, expectedVersion: number, actorId: string) {
    if (node.version !== expectedVersion) throw this.versionConflict(node)
    const result = await manager.createQueryBuilder().update(CmsNodeEntity).set({ updatedBy: actorId, updatedAt: new Date(), version: () => '"version" + 1' })
      .where("id = :id AND version = :version", { id: node.id, version: expectedVersion }).execute()
    if (result.affected !== 1) throw this.versionConflict(node)
    return manager.findOneByOrFail(CmsNodeEntity, { id: node.id })
  }

  private async assertParent(manager: EntityManager, parentNodeId: string | null, nodeId?: string) {
    if (!parentNodeId) return
    if (parentNodeId === nodeId) throw this.invalidParent()
    const parent = await manager.findOneBy(CmsNodeEntity, { id: parentNodeId })
    if (!parent || parent.status === "archived") throw new ConflictException({ code: "CMS_PARENT_INVALID", message: "Родительский материал не найден или архивирован", fieldErrors: { "route.parentNodeId": ["Выберите активный материал"] } })
    if (nodeId) {
      const cycle = await manager.query(`
        WITH RECURSIVE ancestry(node_id) AS (
          VALUES ($1::uuid)
          UNION
          SELECT placement.parent_node_id
          FROM ancestry
          JOIN LATERAL (
            SELECT revision.parent_node_id
            FROM cms_node_revisions revision
            WHERE revision.node_id = ancestry.node_id
              AND revision.state IN ('draft','review','approved','scheduled','published')
            ORDER BY revision.revision DESC
            LIMIT 1
          ) placement ON placement.parent_node_id IS NOT NULL
        )
        SELECT node_id FROM ancestry WHERE node_id = $2::uuid LIMIT 1
      `, [parentNodeId, nodeId]) as Array<{ node_id: string }>
      if (cycle.length > 0) throw new ConflictException({ code: "CMS_PARENT_CYCLE", message: "Выбранный родитель создаёт цикл в дереве", fieldErrors: { "route.parentNodeId": ["Нельзя выбрать дочерний материал"] } })
    }
  }

  private async assertPlacement(manager: EntityManager, route: CmsNodeRevision["route"], kind: string) {
    if (kind === "home") {
      if (route.path !== "/" || route.parentNodeId !== null || route.slug !== "home") throw this.invalidRoute("Главная страница должна иметь URL / и slug home")
      return
    }
    if (route.path === "/") throw this.invalidRoute("URL / зарезервирован для главной страницы")
    let expectedPath = `/${route.slug}`
    if (route.parentNodeId) {
      const parentRevision = await manager.getRepository(CmsNodeRevisionEntity).findOne({
        where: { nodeId: route.parentNodeId, state: In(["draft", "review", "approved", "scheduled", "published"]) },
        order: { revision: "DESC" },
      })
      if (!parentRevision) throw this.invalidRoute("У родительского материала нет активной версии маршрута")
      expectedPath = parentRevision.path === "/" ? `/${route.slug}` : `${parentRevision.path}/${route.slug}`
    }
    if (route.path !== expectedPath) throw this.invalidRoute(`URL должен соответствовать родителю и slug: ${expectedPath}`)
  }

  private async assertRouteChangeAllowed(manager: EntityManager, nodeId: string, current: CmsNodeRevision["route"], next: CmsNodeRevision["route"]) {
    const routeChanged = current.path !== next.path || current.slug !== next.slug || current.parentNodeId !== next.parentNodeId
    if (!routeChanged) return

    const latestPublished = await this.findLatestPublished(manager, nodeId)
    const approvedCanonicalMove = latestPublished && canonicalPublicPath(current.path) === next.path && current.path !== next.path
    if (latestPublished && !approvedCanonicalMove) {
      throw new ConflictException({
        code: "CMS_REDIRECT_REQUIRED",
        message: "URL опубликованного материала нельзя изменить до настройки перенаправления",
        fieldErrors: { "route.path": ["Сначала настройте перенаправление со старого URL"] },
      })
    }

    const children = await manager.query(`
      SELECT child.id
      FROM cms_nodes child
      JOIN LATERAL (
        SELECT revision.parent_node_id
        FROM cms_node_revisions revision
        WHERE revision.node_id = child.id
          AND revision.state IN ('draft','review','approved','scheduled','published')
        ORDER BY revision.revision DESC
        LIMIT 1
      ) placement ON placement.parent_node_id = $1::uuid
      WHERE child.status = 'active'
      LIMIT 1
    `, [nodeId]) as Array<{ id: string }>
    if (children.length > 0) {
      throw new ConflictException({
        code: "CMS_SUBTREE_MOVE_REQUIRED",
        message: "Материал с дочерними страницами можно переносить только атомарно вместе с поддеревом",
        fieldErrors: { "route.parentNodeId": ["Сначала перенесите всё поддерево"] },
      })
    }
  }

  private invalidRoute(message: string) {
    return new ConflictException({ code: "CMS_ROUTE_INVALID", message, fieldErrors: { "route.path": [message] } })
  }

  private invalidParent() {
    return new ConflictException({ code: "CMS_PARENT_INVALID", message: "Материал не может быть родителем самого себя", fieldErrors: { "route.parentNodeId": ["Недопустимый родитель"] } })
  }

  private assertActive(node: CmsNodeEntity) {
    if (node.status === "archived") throw new ConflictException({ code: "CMS_NODE_ARCHIVED", message: "Архивированный материал нельзя изменить" })
  }

  private assert(actor: SessionUser, capability: "canViewContent" | "canEditContent" | "canReviewContent") {
    if (actor.capabilities[capability] !== true) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: `Capability ${capability} is required` })
  }

  private versionConflict(node: CmsNodeEntity) {
    return new ConflictException({ code: "VERSION_CONFLICT", message: "Материал был изменён другим пользователем", details: { entityId: node.id, serverVersion: node.version } })
  }

  private async replay(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string): Promise<CmsNodeDetail | null> {
    const record = await manager.getRepository(IdempotencyKeyEntity).findOne({
      where: [{ scope, operationId }, { scope, idempotencyKey }],
    })
    if (!record) return null
    if (record.idempotencyKey !== idempotencyKey || record.requestHash !== requestHash) {
      throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "operationId уже использован с другими данными" })
    }
    return record.responseBody as CmsNodeDetail | null
  }

  private async remember(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string, response: CmsNodeDetail, responseStatus = 200) {
    await manager.save(manager.create(IdempotencyKeyEntity, { id: randomUUID(), scope, operationId, idempotencyKey, requestHash, responseStatus, responseBody: response, createdAt: new Date() }))
  }

  private async recordMutation(
    manager: EntityManager,
    node: CmsNodeEntity,
    revision: CmsNodeRevisionEntity | null,
    action: string,
    eventType: CmsContentOutboxEvent["eventType"],
    actorId: string,
    requestId: string,
    changes: Record<string, unknown>,
  ) {
    const now = new Date()
    const event = CmsContentOutboxEventSchema.parse({
      eventId: randomUUID(), eventType, occurredAt: now.toISOString(), actorId, requestId,
      nodeId: node.id, nodeVersion: node.version, revisionId: revision?.id ?? null,
      revision: revision?.revision ?? null, state: revision?.state ?? null,
    })
    await manager.save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "cms_node", entityId: node.id, action, actorId, requestId, changes, createdAt: now }))
    await manager.save(manager.create(OutboxEventEntity, {
      id: event.eventId,
      topic: event.eventType,
      aggregateType: "cms_node",
      aggregateId: node.id,
      payload: event,
      availableAt: now,
      processedAt: null,
      attempts: 0,
      createdAt: now,
    }))
  }
}

export function revisionContentHash(content: RevisionContent): string {
  return createHash("sha256").update(stableStringify({ ...content, hero: content.hero ?? { mode: "inherit" } })).digest("hex")
}

export function encodeCursor(cursor: NodeCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")
}

export function decodeCursor(cursor: string): NodeCursor {
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<NodeCursor>
    const id = IdSchema.safeParse(value.id)
    if (typeof value.updatedAt !== "string" || Number.isNaN(Date.parse(value.updatedAt)) || !id.success) throw new Error("invalid")
    return { updatedAt: value.updatedAt, id: id.data }
  } catch {
    throw new BadRequestException({ code: "INVALID_CURSOR", message: "Курсор списка недействителен" })
  }
}

function mutationHash(input: unknown): string {
  return createHash("sha256").update(stableStringify(input)).digest("hex")
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`
  }
  return JSON.stringify(value)
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&")
}
