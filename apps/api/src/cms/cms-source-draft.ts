import { createHash, randomUUID } from "node:crypto"

import type { CmsPageKind, CmsSourceKind } from "@crm/contracts"
import { CatalogOfferingEntity, ChangeLogEntity, CmsNodeEntity, CmsNodeRevisionEntity, CmsSourceLinkEntity, OutboxEventEntity } from "@crm/db"
import type { EntityManager } from "typeorm"

type LegacyCmsSourceKind = Exclude<CmsSourceKind, "catalog_offering">

const kinds: Record<CmsSourceKind, { pageKind: CmsPageKind; pathPart: string }> = {
  resource: { pageKind: "resource_detail", pathPart: "resources" },
  program_template: { pageKind: "program_detail", pathPart: "programs" },
  program_occurrence: { pageKind: "program_occurrence", pathPart: "program-runs" },
  event: { pageKind: "event_detail", pathPart: "events" },
  program_category: { pageKind: "category", pathPart: "program-categories" },
  event_category: { pageKind: "category", pathPart: "event-categories" },
  catalog_offering: { pageKind: "resource_detail", pathPart: "houses" },
}

const internalOperationalSources = new Set<CmsSourceKind>(["program_occurrence", "event"])

/** Transactional, idempotent CRM -> CMS draft projection. It grants no public eligibility. */
export async function ensureCmsSourceDraft(
  manager: EntityManager,
  input: { sourceKind: LegacyCmsSourceKind; sourceId: string; sourceVersion: number; title: string; summary?: string | null; actorId: string; requestId: string },
) {
  if (input.sourceKind === "event") throw new Error("Customer Event CMS drafts are not created; use catalog_offering event-service editorial drafts")
  return createCmsSourceDraft(manager, input)
}

export type LegacyCatalogOfferingPromotionReport = Readonly<{
  status: "eligible" | "missing_legacy_link" | "no_exact_primary" | "ambiguous"
  resourceId: string
  legacyLinkId: string | null
  candidateOfferingIds: string[]
}>

export type LegacyProgramOfferingPromotionReport = Readonly<{
  status: "eligible" | "missing_legacy_link" | "no_exact_primary" | "ambiguous"
  programTemplateId: string
  legacyLinkId: string | null
  candidateOfferingIds: string[]
}>

/** Read-only reconciliation used before a legacy resource link can be promoted. */
export async function inspectLegacyCatalogOfferingPromotion(manager: EntityManager, resourceId: string): Promise<LegacyCatalogOfferingPromotionReport> {
  const legacy = await manager.getRepository(CmsSourceLinkEntity).findOneBy({ sourceKind: "resource", sourceId: resourceId })
  if (!legacy) return { status: "missing_legacy_link", resourceId, legacyLinkId: null, candidateOfferingIds: [] }
  const rows = await manager.query(`
    SELECT offering.id
    FROM catalog_offerings offering
    JOIN offering_bindings binding ON binding.offering_id = offering.id
      AND binding.role = 'primary' AND binding.archived_at IS NULL AND binding.resource_id = $1
    JOIN resources resource ON resource.id = binding.resource_id AND resource.archived_at IS NULL
    WHERE offering.kind = 'house' AND offering.archived_at IS NULL
    ORDER BY offering.id ASC
  `, [resourceId]) as Array<{ id: string }>
  const candidateOfferingIds = rows.map((row) => row.id)
  return {
    status: candidateOfferingIds.length === 1 ? "eligible" : candidateOfferingIds.length === 0 ? "no_exact_primary" : "ambiguous",
    resourceId,
    legacyLinkId: legacy.id,
    candidateOfferingIds,
  }
}

/** Read-only exact-primary reconciliation for legacy ProgramTemplate drafts. */
export async function inspectLegacyProgramOfferingPromotion(manager: EntityManager, programTemplateId: string): Promise<LegacyProgramOfferingPromotionReport> {
  const legacy = await manager.getRepository(CmsSourceLinkEntity).findOneBy({ sourceKind: "program_template", sourceId: programTemplateId })
  if (!legacy) return { status: "missing_legacy_link", programTemplateId, legacyLinkId: null, candidateOfferingIds: [] }
  const rows = await manager.query(`
    SELECT offering.id
    FROM catalog_offerings offering
    JOIN offering_bindings binding ON binding.offering_id = offering.id
      AND binding.role = 'primary' AND binding.archived_at IS NULL AND binding.program_template_id = $1
    JOIN program_templates template ON template.id = binding.program_template_id AND template.archived_at IS NULL
    WHERE offering.kind = 'program' AND offering.archived_at IS NULL
    ORDER BY offering.id ASC
  `, [programTemplateId]) as Array<{ id: string }>
  const candidateOfferingIds = rows.map((row) => row.id)
  return { status: candidateOfferingIds.length === 1 ? "eligible" : candidateOfferingIds.length === 0 ? "no_exact_primary" : "ambiguous", programTemplateId, legacyLinkId: legacy.id, candidateOfferingIds }
}

/**
 * Transaction-aware canonical offering -> CMS locator helper. Call it inside
 * the same transaction as guided offering creation. It seeds editorial-safe
 * placeholders only and never creates a public profile or projection event.
 */
export async function ensureCatalogOfferingEditorialDraft(
  manager: EntityManager,
  input: { offeringId: string; actorId: string; requestId: string },
): Promise<{ status: "linked" | "created" | "promoted"; link: CmsSourceLinkEntity } | { status: "report_only"; report: LegacyCatalogOfferingPromotionReport | LegacyProgramOfferingPromotionReport }> {
  const offering = await manager.getRepository(CatalogOfferingEntity).findOneBy({ id: input.offeringId })
  if (!offering || offering.archivedAt !== null) throw new Error(`Active catalog offering ${input.offeringId} was not found`)
  if (offering.kind !== "house" && offering.kind !== "campground" && offering.kind !== "venue" && offering.kind !== "program" && offering.kind !== "event_service") throw new Error(`Catalog offering ${input.offeringId} is not supported by the editorial locator`)

  const links = manager.getRepository(CmsSourceLinkEntity)
  const existing = await links.findOneBy({ sourceKind: "catalog_offering", sourceId: offering.id })
  if (existing) {
    await assertEditorialNode(manager, existing, offering.kind === "program" ? "program_detail" : offering.kind === "event_service" ? "event_detail" : "resource_detail")
    return { status: "linked", link: existing }
  }

  if (offering.kind === "event_service") {
    const primary = await manager.query(`
      SELECT event_service_template_id AS "eventServiceTemplateId"
      FROM offering_bindings
      WHERE offering_id = $1 AND role = 'primary' AND archived_at IS NULL AND event_service_template_id IS NOT NULL
      ORDER BY id ASC
    `, [offering.id]) as Array<{ eventServiceTemplateId: string }>
    if (primary.length !== 1) throw new Error(`Event-service offering ${offering.id} requires one exact primary EventServiceTemplate binding`)
    const link = await createCmsSourceDraft(manager, {
      sourceKind: "catalog_offering", sourceId: offering.id, sourceVersion: offering.version,
      title: offering.operationalName, summary: null, actorId: input.actorId, requestId: input.requestId,
      pathPart: "event-services", pageKind: "event_detail",
    })
    return { status: "created", link }
  }

  const primary = await manager.query(`
    SELECT resource_id AS "resourceId"
    FROM offering_bindings
    WHERE offering_id = $1 AND role = 'primary' AND archived_at IS NULL AND resource_id IS NOT NULL
    ORDER BY id ASC
  `, [offering.id]) as Array<{ resourceId: string }>
  if (offering.kind === "house" && primary.length === 1) {
    const report = await inspectLegacyCatalogOfferingPromotion(manager, primary[0]!.resourceId)
    if (report.status === "eligible" && report.candidateOfferingIds[0] === offering.id && report.legacyLinkId) {
      const legacy = await links.findOneByOrFail({ id: report.legacyLinkId })
      await assertEditorialNode(manager, legacy, "resource_detail")
      const promoted = await manager.createQueryBuilder().update(CmsSourceLinkEntity).set({
        sourceKind: "catalog_offering", sourceId: offering.id, sourceVersion: offering.version,
      }).where("id = :id AND source_kind = 'resource' AND source_id = :resourceId", { id: legacy.id, resourceId: report.resourceId }).execute()
      if (promoted.affected !== 1) throw new Error(`Legacy CMS source link ${legacy.id} changed during promotion`)
      const link = await links.findOneByOrFail({ id: legacy.id })
      await manager.save(manager.create(ChangeLogEntity, {
        id: randomUUID(), entityType: "cms_node", entityId: link.nodeId, action: "catalog_offering_source_promoted",
        actorId: input.actorId, requestId: input.requestId,
        changes: { previousSourceKind: "resource", previousSourceId: report.resourceId, sourceKind: "catalog_offering", sourceId: offering.id, sourceVersion: offering.version },
        createdAt: new Date(),
      }))
      return { status: "promoted", link }
    }
    if (report.status !== "missing_legacy_link") return { status: "report_only", report }
  }


  if (offering.kind === "program") {
    const primary = await manager.query(`
      SELECT program_template_id AS "programTemplateId"
      FROM offering_bindings
      WHERE offering_id = $1 AND role = 'primary' AND archived_at IS NULL AND program_template_id IS NOT NULL
      ORDER BY id ASC
    `, [offering.id]) as Array<{ programTemplateId: string }>
    if (primary.length !== 1) throw new Error(`Program offering ${offering.id} requires one exact primary ProgramTemplate binding`)
    const report = await inspectLegacyProgramOfferingPromotion(manager, primary[0]!.programTemplateId)
    if (report.status === "eligible" && report.candidateOfferingIds[0] === offering.id && report.legacyLinkId) {
      const legacy = await links.findOneByOrFail({ id: report.legacyLinkId })
      await assertEditorialNode(manager, legacy, "program_detail")
      const promoted = await manager.createQueryBuilder().update(CmsSourceLinkEntity).set({ sourceKind: "catalog_offering", sourceId: offering.id, sourceVersion: offering.version })
        .where("id = :id AND source_kind = 'program_template' AND source_id = :programTemplateId", { id: legacy.id, programTemplateId: report.programTemplateId }).execute()
      if (promoted.affected !== 1) throw new Error(`Legacy CMS source link ${legacy.id} changed during promotion`)
      const link = await links.findOneByOrFail({ id: legacy.id })
      await manager.save(manager.create(ChangeLogEntity, {
        id: randomUUID(), entityType: "cms_node", entityId: link.nodeId, action: "catalog_offering_source_promoted",
        actorId: input.actorId, requestId: input.requestId,
        changes: { previousSourceKind: "program_template", previousSourceId: report.programTemplateId, sourceKind: "catalog_offering", sourceId: offering.id, sourceVersion: offering.version }, createdAt: new Date(),
      }))
      return { status: "promoted", link }
    }
    if (report.status !== "missing_legacy_link") return { status: "report_only", report }
  }

  const link = await createCmsSourceDraft(manager, {
    sourceKind: "catalog_offering", sourceId: offering.id, sourceVersion: offering.version,
    title: offering.operationalName, summary: null, actorId: input.actorId, requestId: input.requestId,
    pathPart: offering.kind === "program" ? "programs" : offering.kind === "campground" ? "campgrounds" : offering.kind === "venue" ? "venues" : "houses",
    pageKind: offering.kind === "program" ? "program_detail" : "resource_detail",
    relations: [{ kind: "catalog_offering", entityId: offering.id }],
  })
  return { status: "created", link }
}

async function assertEditorialNode(manager: EntityManager, link: CmsSourceLinkEntity, kind: "resource_detail" | "program_detail" | "event_detail") {
  const node = await manager.getRepository(CmsNodeEntity).findOneBy({ id: link.nodeId })
  if (!node || node.kind !== kind) throw new Error(`CMS source link ${link.id} does not target a ${kind} node`)
}

async function createCmsSourceDraft(
  manager: EntityManager,
  input: { sourceKind: CmsSourceKind; sourceId: string; sourceVersion: number; title: string; summary?: string | null; actorId: string; requestId: string; pathPart?: string; pageKind?: CmsPageKind; relations?: Array<{ kind: "catalog_offering"; entityId: string }> },
) {
  const existing = await manager.getRepository(CmsSourceLinkEntity).findOneBy({ sourceKind: input.sourceKind, sourceId: input.sourceId })
  if (existing) return existing
  const mapping = kinds[input.sourceKind]
  const now = new Date()
  const nodeId = randomUUID()
  const revisionId = randomUUID()
  const path = `/drafts/${input.pathPart ?? mapping.pathPart}/${input.sourceId}`
  const title = input.title.trim().slice(0, 240) || "Новый материал"
  // Occurrence/Event comments are operational notes and may contain customer
  // context or other internal details. Keep the technical CMS link/draft, but
  // never seed those notes into editorial or eventually public fields.
  const summary = internalOperationalSources.has(input.sourceKind) ? null : input.summary?.trim().slice(0, 1000) || null
  const seoDescription = internalOperationalSources.has(input.sourceKind)
    ? "Технический черновик из CRM. Не предназначен для публикации."
    : (summary || `${title}. Черновик из CRM.`).slice(0, 320)
  const content = {
    route: { path, slug: input.sourceId, parentNodeId: null, sortOrder: 0 }, title,
    summary, hero: { mode: "inherit" as const }, sections: [],
    seo: { title: title.slice(0, 70), description: seoDescription, indexPolicy: "noindex_follow", canonical: { mode: "self" }, structuredData: [] },
    relations: input.relations ?? [], schemaVersion: 1,
  }
  const contentHash = hash(content)
  await manager.save(manager.create(CmsNodeEntity, { id: nodeId, kind: input.pageKind ?? mapping.pageKind, status: "active", createdBy: input.actorId, updatedBy: input.actorId, archivedAt: null }))
  await manager.save(manager.create(CmsNodeRevisionEntity, {
    id: revisionId, nodeId, revision: 1, state: "draft", path, slug: input.sourceId, parentNodeId: null, sortOrder: 0,
    title, summary: content.summary, hero: content.hero, sections: [], seo: content.seo, relations: content.relations, schemaVersion: 1, contentHash, createdBy: input.actorId, createdAt: now,
  }))
  const link = await manager.save(manager.create(CmsSourceLinkEntity, {
    id: randomUUID(), sourceKind: input.sourceKind, sourceId: input.sourceId, sourceVersion: input.sourceVersion,
    nodeId, syncState: "draft", createdAt: now,
  }))
  await manager.save(manager.create(ChangeLogEntity, {
    id: randomUUID(), entityType: "cms_node", entityId: nodeId, action: "created_from_crm", actorId: input.actorId, requestId: input.requestId,
    changes: { sourceKind: input.sourceKind, sourceId: input.sourceId, sourceVersion: input.sourceVersion, revisionId }, createdAt: now,
  }))
  await manager.save(manager.create(OutboxEventEntity, {
    id: randomUUID(), topic: "cms.source.draft.created", aggregateType: "cms_node", aggregateId: nodeId,
    payload: { nodeId, revisionId, sourceKind: input.sourceKind, sourceId: input.sourceId, sourceVersion: input.sourceVersion },
    availableAt: now, processedAt: null, attempts: 0, createdAt: now,
  }))
  return link
}

function hash(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex")
}
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`
  return JSON.stringify(value)
}
