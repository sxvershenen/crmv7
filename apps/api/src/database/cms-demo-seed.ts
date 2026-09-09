import { createHash, randomUUID } from "node:crypto"

import {
  CmsNodeEntity,
  CmsNodeRevisionEntity,
  CmsSiteSettingsEntity,
  CmsSiteSettingsRevisionEntity,
  CmsSourceLinkEntity,
} from "@crm/db"
import {
  CmsNodeRevisionSchema,
  CmsSiteSettingsRevisionSchema,
  CmsSiteSettingsValueSchema,
  type CmsHeroPolicy,
  type CmsPageKind,
  type CmsSection,
} from "@crm/contracts"
import type { DataSource } from "typeorm"

import { revisionContentHash } from "../cms/cms-content.service.js"

const SETTINGS_ID = "00000000-0000-4000-8000-000000000001"

type DemoPage = {
  kind: CmsPageKind
  path: string
  slug: string
  title: string
  summary: string
  state: "draft" | "review" | "published"
  parentPath: string | null
  hero: CmsHeroPolicy
  sections: CmsSection[]
  seo: {
    title: string
    description: string
    indexPolicy: "index_follow" | "noindex_follow" | "noindex_nofollow"
    canonical: { mode: "self" }
    structuredData: []
  }
}

/**
 * Development-only CMS content. Existing canonical routes and settings drafts
 * are intentionally read-only: local seed must never take ownership of them.
 */
export async function seedCmsDemoData(
  dataSource: DataSource,
  actorId: string,
  resourceId: string,
  resourceVersion: number,
): Promise<{ nodeIds: string[]; settingsRevisionId: string | null }> {
  if (process.env.APP_ENV === "production") return { nodeIds: [], settingsRevisionId: null }
  const pages: DemoPage[] = [
    page({ kind: "home", path: "/", slug: "home", title: "Свистоплясово — отдых за городом", summary: "Домики, природа и тёплые программы для отдыха недалеко от города.", state: "published", parentPath: null, indexPolicy: "index_follow", heroTitle: "Отдых, который начинается с тишины", section: textSection("welcome", "Добро пожаловать в Свистоплясово — место для спокойных выходных, семейных поездок и встреч с друзьями.") }),
    page({ kind: "resource_listing", path: "/houses", slug: "houses", title: "Домики для отдыха", summary: "Выберите домик под компанию, сезон и свой ритм отдыха.", state: "published", parentPath: "/", indexPolicy: "index_follow", heroTitle: "Домики среди сосен", section: listingSection() }),
    page({ kind: "resource_detail", path: "/houses/sosna", slug: "sosna", title: "Дом «Сосна»", summary: "Уютный домик для семьи или компании до шести гостей.", state: "review", parentPath: "/houses", indexPolicy: "noindex_follow", heroTitle: "Дом «Сосна»", section: textSection("details", "Тёплый деревянный домик для размеренного отдыха на природе. Актуальные цены и доступность приходят из CRM.") }),
    page({ kind: "landing", path: "/family", slug: "family", title: "Семейный отдых", summary: "Пространство для выходных, которые удобно прожить вместе.", state: "draft", parentPath: "/", indexPolicy: "noindex_follow", heroTitle: "Выходные всей семьёй", section: textSection("family", "Маршрут для семейного дня: домик, прогулка, костёр и программа без спешки.") }),
    page({ kind: "program_detail", path: "/programs/family", slug: "family", title: "Программа «Семейный день»", summary: "Два часа совместных впечатлений для детей и взрослых.", state: "review", parentPath: null, indexPolicy: "noindex_follow", heroTitle: "Семейный день", section: textSection("program", "Демонстрационная программа локального окружения: встреча, совместная активность и время для общения.") }),
  ]

  const nodes = dataSource.getRepository(CmsNodeEntity)
  const revisions = dataSource.getRepository(CmsNodeRevisionEntity)
  const links = dataSource.getRepository(CmsSourceLinkEntity)
  const nodeIdsByPath = new Map<string, string>()
  const nodeIds: string[] = []

  for (const definition of pages) {
    const existing = await revisions.findOne({ where: { path: definition.path }, order: { revision: "DESC" } })
    if (existing) {
      validateExistingRevision(existing, definition.path)
      nodeIdsByPath.set(definition.path, existing.nodeId)
      nodeIds.push(existing.nodeId)
      continue
    }

    const parentNodeId = definition.parentPath ? nodeIdsByPath.get(definition.parentPath) ?? null : null
    const nodeId = randomUUID()
    const now = new Date()
    const content = {
      route: { path: definition.path, slug: definition.slug, parentNodeId, sortOrder: definition.path === "/" ? 0 : 10 },
      title: definition.title,
      summary: definition.summary,
      hero: definition.hero,
      sections: definition.sections,
      seo: definition.seo,
      relations: [],
      schemaVersion: 1,
    }
    const parsed = CmsNodeRevisionSchema.parse({
      id: randomUUID(), nodeId, revision: 1, state: definition.state, ...content,
      contentHash: revisionContentHash(content), createdBy: actorId, createdAt: now.toISOString(),
    })
    await nodes.save(nodes.create({ id: nodeId, kind: definition.kind, status: "active", createdBy: actorId, updatedBy: actorId, archivedAt: null }))
    await revisions.save(revisions.create({
      id: parsed.id,
      nodeId,
      revision: parsed.revision,
      state: parsed.state,
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
      contentHash: parsed.contentHash,
      createdBy: parsed.createdBy,
      createdAt: now,
    }))
    nodeIdsByPath.set(definition.path, nodeId)
    nodeIds.push(nodeId)

    if (definition.path === "/houses/sosna") {
      const source = await links.findOneBy({ sourceKind: "resource", sourceId: resourceId })
      const sourceNode = await links.findOneBy({ nodeId })
      if (!source && !sourceNode) {
        await links.save(links.create({ id: randomUUID(), sourceKind: "resource", sourceId: resourceId, sourceVersion: resourceVersion, nodeId, syncState: "draft", createdAt: now }))
      } else if (source && source.nodeId !== nodeId) {
        console.warn(`[cms-demo-seed] resource ${resourceId} already linked to CMS node ${source.nodeId}; canonical /houses/sosna remains unlinked`)
      }
    }
  }

  const settings = dataSource.getRepository(CmsSiteSettingsEntity)
  const settingsRow = await settings.findOneBy({ id: SETTINGS_ID })
  if (!settingsRow) throw new Error("CMS site settings singleton is missing; migrations must run before dev seed")
  const settingsRevisions = dataSource.getRepository(CmsSiteSettingsRevisionEntity)
  const currentDraft = await settingsRevisions.findOne({ where: { settingsId: SETTINGS_ID, state: "draft" }, order: { revision: "DESC" } })
  if (currentDraft) {
    validateExistingSettingsRevision(currentDraft)
    return { nodeIds, settingsRevisionId: currentDraft.id }
  }

  const value = CmsSiteSettingsValueSchema.parse({
    siteName: "Свистоплясово",
    headerNavigation: [
      nav("00000000-0000-4000-8000-000000000101", "Проживание", "/houses", "home", [{ id: "00000000-0000-4000-8000-000000000102", label: "Домики", link: { kind: "internal", path: "/houses" }, target: "_self", icon: "building-cottage", color: "#2f6b4f", visibleOn: "all", enabled: true, children: [] }]),
      nav("00000000-0000-4000-8000-000000000103", "Семейный отдых", "/family", "users", []),
    ],
    mobileNavigation: [nav("00000000-0000-4000-8000-000000000104", "Домики", "/houses", "building-cottage", []), nav("00000000-0000-4000-8000-000000000105", "Семейный отдых", "/family", "users", [])],
    footerNavigation: [nav("00000000-0000-4000-8000-000000000106", "Домики", "/houses", "building-cottage", []), nav("00000000-0000-4000-8000-000000000107", "Семейный отдых", "/family", "users", []), nav("00000000-0000-4000-8000-000000000108", "Программы", "/programs/family", "sparkles", [])],
    headerCta: { label: "Подобрать отдых", link: { kind: "internal", path: "/family" }, enabled: true },
    heroDefault: null,
    sectionDefaults: [],
  })
  const raw = await dataSource.query(`SELECT COALESCE(MAX(revision), 0) + 1 AS next FROM cms_site_settings_revisions WHERE settings_id = $1`, [SETTINGS_ID]) as Array<{ next: number | string }>
  const now = new Date()
  const revision = CmsSiteSettingsRevisionSchema.parse({ id: randomUUID(), revision: Number(raw[0]?.next ?? 1), state: "draft", value, contentHash: hash(value), createdBy: actorId, createdAt: now.toISOString() })
  await settingsRevisions.save(settingsRevisions.create({ ...revision, settingsId: SETTINGS_ID, createdAt: now }))
  return { nodeIds, settingsRevisionId: revision.id }
}

function page(input: Omit<DemoPage, "hero" | "seo" | "sections"> & { indexPolicy: DemoPage["seo"]["indexPolicy"]; heroTitle: string; section: CmsSection }): DemoPage {
  return {
    ...input,
    hero: { mode: "override", config: hero(input.heroTitle) },
    seo: { title: input.title.slice(0, 70), description: input.summary.slice(0, 320), indexPolicy: input.indexPolicy, canonical: { mode: "self" }, structuredData: [] },
    sections: [input.section],
  }
}

function hero(title: string) {
  return { variant: "default" as const, eyebrow: "Свистоплясово", title, subtitle: null, backgroundAssetId: null, foregroundAssetId: null, background: null, foreground: null, overlay: "soft" as const, align: "left" as const, actions: [{ id: randomUUID(), label: "Посмотреть домики", href: "/houses", target: "_self" as const, style: "primary" as const }], slides: [], badge: null, featureCards: [], autoplayMs: null }
}

function textSection(key: string, content: string): CmsSection {
  return { id: randomUUID(), key, renderer: "rich-text", rendererVersion: "site-ui@1", schemaVersion: 1, order: 20, policy: { mode: "override", patch: { scalars: { content: { operation: "replace", value: content } }, objects: {}, keyedArrays: {} } } }
}

function listingSection(): CmsSection {
  const definition = {
    id: randomUUID(), entityKind: "resource" as const, filters: [{ id: "capacity", label: "Гостей", field: "capacity", source: "crm_public_projection" as const, valueType: "number" as const, operators: ["gte"] as ["gte"], control: "range" as const, urlKey: "guests", normalization: "integer" as const, indexPolicy: "canonical_to_base" as const }],
    sorts: [{ id: "title", label: "По названию", field: "title", direction: "asc" as const, source: "cms" as const }], defaultSortId: "title", pageSize: 12,
  }
  return { id: randomUUID(), key: "catalog", renderer: "listing", rendererVersion: "site-ui@1", schemaVersion: 1, order: 20, policy: { mode: "override", patch: { scalars: { definition: { operation: "replace", value: definition } }, objects: {}, keyedArrays: {} } } }
}

function nav(id: string, label: string, path: string, icon: string, children: Array<Record<string, unknown>>) {
  return { id, label, link: { kind: "internal" as const, path }, target: "_self" as const, icon, color: "#2f6b4f", visibleOn: "all" as const, enabled: true, children }
}

function validateExistingRevision(row: CmsNodeRevisionEntity, path: string) {
  const result = CmsNodeRevisionSchema.safeParse({ id: row.id, nodeId: row.nodeId, revision: row.revision, state: row.state, route: { path: row.path, slug: row.slug, parentNodeId: row.parentNodeId, sortOrder: row.sortOrder }, title: row.title, summary: row.summary, hero: row.hero, sections: row.sections, seo: row.seo, relations: row.relations, schemaVersion: row.schemaVersion, contentHash: row.contentHash, createdBy: row.createdBy, createdAt: row.createdAt.toISOString() })
  if (!result.success) console.warn(`[cms-demo-seed] canonical ${path} exists but is not valid under current CMS contract; leaving it untouched`)
}

function validateExistingSettingsRevision(row: CmsSiteSettingsRevisionEntity) {
  const result = CmsSiteSettingsRevisionSchema.safeParse({ id: row.id, revision: row.revision, state: row.state, value: row.value, contentHash: row.contentHash, createdBy: row.createdBy, createdAt: row.createdAt.toISOString() })
  if (!result.success) console.warn("[cms-demo-seed] existing CMS settings draft is not valid under current contract; leaving it untouched")
}

function hash(value: unknown) { return createHash("sha256").update(stableStringify(value)).digest("hex") }
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`
  return JSON.stringify(value)
}
