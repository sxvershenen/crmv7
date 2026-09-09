import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto"

import { ConfigService } from "@nestjs/config"
import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common"
import { DataSource } from "typeorm"

import {
  CmsPreviewTokenResponseSchema,
  CmsPreviewDocumentSchema,
  CmsSectionSchema,
  PublicPageSchema,
  PublicReleasePageContentSchema,
  ReleaseDependencyRefSchema,
  type CmsPreviewDocument,
  type CmsPreviewTokenIssue,
  type CmsPreviewTokenResponse,
  type PublicPage,
  type PublicPagePreviewQuery,
  type PublicPageResolveQuery,
} from "@crm/contracts"
import {
  ChangeLogEntity,
  CmsNodeEntity,
  CmsNodeRevisionEntity,
} from "@crm/db"

type PreviewClaims = {
  version: 1
  revisionId: string
  contentHash: string
  expiresAt: number
}

const PREVIEWABLE_STATES = new Set(["draft", "review", "approved", "scheduled", "published"])

type PublishedPageRow = {
  releaseId: string
  releaseCreatedAt: Date
  releasePublishedAt: Date | null
  nodeId: string
  revisionId: string
  resolvedContentHash: string
  resolvedContent: unknown
  dependencies: unknown
}

/**
 * Read-only projection for Astro and other public consumers. It is deliberately
 * separate from the CMS authoring service so public calls cannot observe drafts,
 * relations, audit metadata, users, or release work-in-progress.
 */
@Injectable()
export class PublicContentService {
  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async resolve(query: PublicPageResolveQuery): Promise<PublicPage> {
    const rows = await this.dataSource.query(`
      SELECT release.id AS "releaseId", release.created_at AS "releaseCreatedAt",
        release.published_at AS "releasePublishedAt", item.node_id AS "nodeId",
        item.revision_id AS "revisionId", item.resolved_content_hash AS "resolvedContentHash",
        item.resolved_content AS "resolvedContent", item.dependencies AS "dependencies"
      FROM cms_active_release active
      JOIN cms_releases release ON release.id = active.release_id AND release.state = 'published'
      JOIN cms_release_items item ON item.release_id = release.id AND item.path = $1
      JOIN cms_node_revisions revision ON revision.id = item.revision_id
        AND revision.node_id = item.node_id
      WHERE active.singleton_key = 'public'
      LIMIT 1
    `, [query.path]) as PublishedPageRow[]
    const row = rows[0]
    if (!row) throw this.notFound()
    const content = PublicReleasePageContentSchema.safeParse(row.resolvedContent)
    if (!content.success || content.data.path !== query.path || resolvedContentHash(row.resolvedContent) !== row.resolvedContentHash) {
      throw new ServiceUnavailableException({ code: "CMS_RELEASE_INVALID", message: "Опубликованная версия требует повторной публикации" })
    }
    const dependencies = ReleaseDependencyRefSchema.array().max(1000).safeParse(row.dependencies)
    if (!dependencies.success) {
      throw new ServiceUnavailableException({ code: "CMS_RELEASE_INVALID", message: "Опубликованная версия содержит недействительные зависимости" })
    }
    const generatedAt = row.releasePublishedAt ?? row.releaseCreatedAt
    const etagValue = `${row.releaseId}-${row.revisionId}-${row.resolvedContentHash}`
    return PublicPageSchema.parse({
      nodeId: row.nodeId,
      revisionId: row.revisionId,
      releaseId: row.releaseId,
      ...content.data,
      sections: [...content.data.sections].sort((left, right) => left.order - right.order || left.key.localeCompare(right.key)),
      dependencies: dependencies.data,
      generatedAt: generatedAt.toISOString(),
      cache: {
        etag: `"${etagValue}"`,
        maxAgeSeconds: 60,
        staleWhileRevalidateSeconds: 300,
        tags: [`cms-release:${row.releaseId}`, `cms-node:${row.nodeId}`, `cms-revision:${row.revisionId}`],
      },
      freshness: { contentVersion: row.resolvedContentHash, crmProjectionAsOf: null, ready: true },
    })
  }

  async issuePreview(revisionId: string, input: CmsPreviewTokenIssue, actorId: string, requestId: string): Promise<CmsPreviewTokenResponse> {
    const secret = this.previewSecret()
    const { node, revision } = await this.revisionWithNode(revisionId)
    if (node.status !== "active" || node.archivedAt || !PREVIEWABLE_STATES.has(revision.state)) throw this.notFound()
    const expiresAt = new Date(Date.now() + Math.min(input.ttlSeconds, 3600) * 1000)
    const token = signPreviewToken({ version: 1, revisionId: revision.id, contentHash: revision.contentHash, expiresAt: expiresAt.getTime() }, secret)
    await this.dataSource.getRepository(ChangeLogEntity).save({
      id: randomUUID(), entityType: "cms_node_revision", entityId: revision.id, action: "preview_token_issued",
      actorId, requestId, changes: { nodeId: node.id, expiresAt: expiresAt.toISOString() }, createdAt: new Date(),
    })
    return CmsPreviewTokenResponseSchema.parse({ token, expiresAt: expiresAt.toISOString(), previewPath: revision.path })
  }

  async preview(query: PublicPagePreviewQuery): Promise<CmsPreviewDocument> {
    const claims = verifyPreviewToken(query.token, this.previewSecret())
    if (!claims) throw this.notFound()
    const { node, revision } = await this.revisionWithNode(claims.revisionId)
    if (node.status !== "active" || node.archivedAt || !PREVIEWABLE_STATES.has(revision.state) || revision.contentHash !== claims.contentHash) throw this.notFound()
    return CmsPreviewDocumentSchema.parse({
      nodeId: node.id,
      revisionId: revision.id,
      kind: node.kind,
      path: revision.path,
      title: revision.title,
      summary: revision.summary,
      hero: revision.hero,
      sections: revision.sections.map((section) => CmsSectionSchema.parse(section)).sort((left, right) => left.order - right.order || left.key.localeCompare(right.key)),
      seo: { ...revision.seo, indexPolicy: "noindex_nofollow" },
      renderable: false,
      blockingIssues: ["CMS_INHERITANCE_NOT_MATERIALIZED"],
      generatedAt: new Date().toISOString(),
    })
  }

  private async revisionWithNode(revisionId: string) {
    const revision = await this.dataSource.getRepository(CmsNodeRevisionEntity).findOneBy({ id: revisionId })
    if (!revision) throw this.notFound()
    const node = await this.dataSource.getRepository(CmsNodeEntity).findOneBy({ id: revision.nodeId })
    if (!node) throw this.notFound()
    return { node, revision }
  }

  private previewSecret(): string {
    const secret = this.config.get<string>("CMS_PREVIEW_SIGNING_SECRET")
    if (!secret || secret.length < 32) {
      throw new ServiceUnavailableException({ code: "CMS_PREVIEW_UNAVAILABLE", message: "Preview не настроен" })
    }
    return secret
  }

  private notFound() {
    return new NotFoundException({ code: "NOT_FOUND", message: "Опубликованная страница не найдена" })
  }
}

export function resolvedContentHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex")
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`
  }
  return JSON.stringify(value)
}

export function signPreviewToken(claims: PreviewClaims, secret: string): string {
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url")
  const signature = createHmac("sha256", secret).update(payload).digest("base64url")
  return `${payload}.${signature}`
}

export function verifyPreviewToken(token: string, secret: string): PreviewClaims | null {
  const [payload, signature, extra] = token.split(".")
  if (!payload || !signature || extra) return null
  const expected = createHmac("sha256", secret).update(payload).digest()
  let actual: Buffer
  try {
    actual = Buffer.from(signature, "base64url")
  } catch {
    return null
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<PreviewClaims>
    const expiresAt = parsed.expiresAt
    if (
      parsed.version !== 1 || typeof parsed.revisionId !== "string" || !/^[0-9a-f-]{36}$/i.test(parsed.revisionId) ||
      typeof parsed.contentHash !== "string" || !/^[a-f0-9]{64}$/.test(parsed.contentHash) ||
      typeof expiresAt !== "number" || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()
    ) return null
    return parsed as PreviewClaims
  } catch {
    return null
  }
}
