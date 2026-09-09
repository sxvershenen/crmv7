import { describe, expect, it, vi } from "vitest"

import type { SessionUser } from "@crm/contracts"
import { ChangeLogEntity, CmsNodeEntity, CmsNodeRevisionEntity, CmsSourceLinkEntity, IdempotencyKeyEntity, OutboxEventEntity } from "@crm/db"
import { roleCapabilities } from "@crm/domain"

import { CmsContentService, decodeCursor, encodeCursor, revisionContentHash } from "./cms-content.service.js"

const actor: SessionUser = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Администратор",
  role: "admin",
  capabilities: roleCapabilities("admin"),
}

const node = {
  id: "22222222-2222-4222-8222-222222222222",
  kind: "landing",
  status: "active",
  version: 3,
  createdAt: new Date("2026-08-31T09:00:00.000Z"),
  updatedAt: new Date("2026-08-31T10:00:00.000Z"),
}

const revision = {
  id: "33333333-3333-4333-8333-333333333333",
  nodeId: node.id,
  revision: 2,
  state: "review",
  path: "/svadby",
  slug: "svadby",
  parentNodeId: null,
  sortOrder: 10,
  title: "Свадьбы",
  summary: null,
  sections: [],
  seo: { title: "Свадьбы", description: "Площадки и сценарии для свадьбы." },
  relations: [],
  schemaVersion: 1,
  contentHash: "a".repeat(64),
  createdBy: actor.id,
  createdAt: new Date("2026-08-31T10:00:00.000Z"),
}

describe("CmsContentService", () => {
  it("reads a node through a mocked persistence boundary", async () => {
    const findOne = vi.fn().mockResolvedValueOnce(revision).mockResolvedValueOnce(null)
    const manager = { findOneBy: vi.fn().mockResolvedValue(node), getRepository: vi.fn().mockReturnValue({ findOne }) }
    const service = new CmsContentService({ manager } as never)
    const result = await service.get(node.id, actor)
    expect(result.node).toMatchObject({ id: node.id, version: 3 })
    expect(result.currentRevision).toMatchObject({ id: revision.id, state: "review" })
    expect(result.latestPublished).toBeNull()
  })

  it("denies CMS reads before touching persistence", async () => {
    const manager = { findOneBy: vi.fn() }
    const service = new CmsContentService({ manager } as never)
    await expect(service.get(node.id, { ...actor, role: "readonly", capabilities: { ...roleCapabilities("readonly"), canViewContent: false } })).rejects.toMatchObject({ response: { code: "PERMISSION_DENIED" } })
    expect(manager.findOneBy).not.toHaveBeenCalled()
  })

  it("uses stable opaque cursors and deterministic content hashes", () => {
    const cursor = { updatedAt: "2026-08-31T10:00:00.000Z", id: node.id }
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor)
    expect(() => decodeCursor("not-a-cursor")).toThrow()
    expect(() => decodeCursor(Buffer.from(JSON.stringify({ ...cursor, id: "-".repeat(36) })).toString("base64url"))).toThrow()
    const base = { route: { path: "/svadby", slug: "svadby", parentNodeId: null, sortOrder: 10 }, title: "Свадьбы", summary: null, sections: [], seo: { title: "Свадьбы", description: "Площадки и сценарии для свадьбы.", indexPolicy: "index_follow" as const, canonical: { mode: "self" as const }, structuredData: [] }, relations: [], schemaVersion: 1 }
    expect(revisionContentHash(base)).toBe(revisionContentHash({ ...base, title: "Свадьбы" }))
  })

  it("changes only lifecycle state when a draft is submitted and emits audit plus outbox atomically", async () => {
    const unchangedSection = { id: "55555555-5555-4555-8555-555555555555", key: "hero", renderer: "hero", rendererVersion: "1", schemaVersion: 1, policy: { mode: "inherit" }, order: 0 }
    const workingRevision = { ...revision, state: "draft", sections: [unchangedSection] }
    const idempotencyRepository = { findOne: vi.fn().mockResolvedValue(null) }
    const revisionRepository = { findOne: vi.fn().mockResolvedValueOnce(workingRevision).mockResolvedValueOnce(null), update: vi.fn().mockResolvedValue({ affected: 1 }) }
    const queryBuilder = {
      update: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue({ affected: 1 }),
    }
    const updatedNode = { ...node, version: 4, updatedAt: new Date("2026-08-31T10:01:00.000Z") }
    const manager = {
      findOneBy: vi.fn().mockResolvedValue(node),
      findOneByOrFail: vi.fn().mockResolvedValue(updatedNode),
      getRepository: vi.fn((entity) => entity === IdempotencyKeyEntity ? idempotencyRepository : entity === CmsNodeRevisionEntity ? revisionRepository : null),
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
      create: vi.fn((_entity, value) => value),
      save: vi.fn(async (value) => value),
    }
    const dataSource = { transaction: vi.fn(async (_level, work) => work(manager)) }
    const service = new CmsContentService(dataSource as never)
    const result = await service.submitReview(node.id, {
      operationId: "44444444-4444-4444-8444-444444444444",
      idempotencyKey: "cms-submit-review-0001",
      expectedVersion: 3,
    }, actor, "request-2")
    expect(revisionRepository.update).toHaveBeenCalledWith({ id: revision.id, state: "draft" }, { state: "review" })
    expect(result.currentRevision).toMatchObject({ state: "review", contentHash: revision.contentHash, sections: [unchangedSection] })
    const persisted = manager.save.mock.calls.map(([value]) => value as Record<string, unknown>)
    expect(persisted.some((value) => value instanceof CmsNodeEntity)).toBe(false)
    expect(persisted.some((value) => value.entityType === "cms_node" && value.action === "submitted")).toBe(true)
    expect(persisted.some((value) => value.topic === "cms.content.revision.submitted" && value.aggregateType === "cms_node")).toBe(true)
    expect(manager.create).toHaveBeenCalledWith(ChangeLogEntity, expect.any(Object))
    expect(manager.create).toHaveBeenCalledWith(OutboxEventEntity, expect.any(Object))
  })

  it("allows a draft leaf route change inside the serializable update transaction", async () => {
    const harness = updateHarness({ current: { ...revision, state: "draft" } })
    const result = await harness.service.update(node.id, mutation({
      route: { path: "/ceremonies", slug: "ceremonies", parentNodeId: null, sortOrder: 10 },
    }), actor, "request-route-leaf")

    expect(result.currentRevision?.route).toEqual({ path: "/ceremonies", slug: "ceremonies", parentNodeId: null, sortOrder: 10 })
    expect(harness.dataSource.transaction).toHaveBeenCalledWith("SERIALIZABLE", expect.any(Function))
    expect(harness.manager.query).toHaveBeenCalledWith(expect.stringContaining("placement.parent_node_id = $1::uuid"), [node.id])
  })

  it("rejects a route change when the node has an active child placement", async () => {
    const harness = updateHarness({ current: { ...revision, state: "draft" }, children: [{ id: "77777777-7777-4777-8777-777777777777" }] })

    await expect(harness.service.update(node.id, mutation({
      route: { path: "/ceremonies", slug: "ceremonies", parentNodeId: null, sortOrder: 10 },
    }), actor, "request-route-subtree")).rejects.toMatchObject({ response: { code: "CMS_SUBTREE_MOVE_REQUIRED" } })
    expect(harness.bumpQuery.execute).not.toHaveBeenCalled()
  })

  it("rejects a published leaf route change until redirect authority exists", async () => {
    const published = { ...revision, state: "published" }
    const harness = updateHarness({ current: published, published })

    await expect(harness.service.update(node.id, mutation({
      route: { path: "/ceremonies", slug: "ceremonies", parentNodeId: null, sortOrder: 10 },
    }), actor, "request-route-published")).rejects.toMatchObject({ response: { code: "CMS_REDIRECT_REQUIRED" } })
    expect(harness.manager.query).not.toHaveBeenCalled()
    expect(harness.bumpQuery.execute).not.toHaveBeenCalled()
  })

  it("keeps content-only editing available for a published path", async () => {
    const published = { ...revision, state: "published" }
    const harness = updateHarness({ current: published, published })
    const result = await harness.service.update(node.id, mutation({ title: "Свадебные церемонии" }), actor, "request-content-published")

    expect(result.currentRevision).toMatchObject({ state: "draft", title: "Свадебные церемонии", route: { path: revision.path } })
    expect(harness.manager.query).not.toHaveBeenCalled()
    expect(harness.bumpQuery.execute).toHaveBeenCalledOnce()
  })

  it("enforces expectedVersion before evaluating route placement guards", async () => {
    const harness = updateHarness({ current: { ...revision, state: "draft" } })

    await expect(harness.service.update(node.id, mutation({
      expectedVersion: 2,
      route: { path: "/ceremonies", slug: "ceremonies", parentNodeId: null, sortOrder: 10 },
    }), actor, "request-route-stale")).rejects.toMatchObject({ response: { code: "VERSION_CONFLICT", details: { serverVersion: 3 } } })
    expect(harness.revisionRepository.findOne).not.toHaveBeenCalled()
    expect(harness.manager.query).not.toHaveBeenCalled()
    expect(harness.bumpQuery.execute).not.toHaveBeenCalled()
  })
})

function mutation(overrides: Record<string, unknown>) {
  return {
    operationId: "66666666-6666-4666-8666-666666666666",
    idempotencyKey: "cms-node-update-route-0001",
    expectedVersion: 3,
    ...overrides,
  } as never
}

function updateHarness(options: { current: typeof revision; published?: typeof revision | null; children?: Array<{ id: string }> }) {
  const idempotencyRepository = { findOne: vi.fn().mockResolvedValue(null) }
  const sourceRepository = { findOneBy: vi.fn().mockResolvedValue(null) }
  const revisionFinds = options.published === undefined
    ? [options.current, null, null]
    : [options.current, options.published]
  const revisionQuery = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    getRawOne: vi.fn().mockResolvedValue({ maximum: options.current.revision }),
  }
  const revisionRepository = {
    findOne: vi.fn()
      .mockImplementation(() => Promise.resolve(revisionFinds.shift() ?? null)),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: vi.fn().mockReturnValue(revisionQuery),
  }
  const bumpQuery = {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ affected: 1 }),
  }
  const updatedNode = { ...node, version: 4, updatedAt: new Date("2026-08-31T10:01:00.000Z") }
  const manager = {
    findOneBy: vi.fn().mockResolvedValue(node),
    findOneByOrFail: vi.fn().mockResolvedValue(updatedNode),
    getRepository: vi.fn((entity) => {
      if (entity === IdempotencyKeyEntity) return idempotencyRepository
      if (entity === CmsNodeRevisionEntity) return revisionRepository
      if (entity === CmsSourceLinkEntity) return sourceRepository
      throw new Error(`Unexpected repository: ${String(entity)}`)
    }),
    createQueryBuilder: vi.fn().mockReturnValue(bumpQuery),
    query: vi.fn().mockResolvedValue(options.children ?? []),
    create: vi.fn((_entity, value) => value),
    save: vi.fn(async (value) => value),
  }
  const dataSource = { transaction: vi.fn(async (_level, work) => work(manager)) }
  return { service: new CmsContentService(dataSource as never), dataSource, manager, revisionRepository, bumpQuery }
}
