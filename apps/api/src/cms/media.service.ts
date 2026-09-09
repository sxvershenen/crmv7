import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException, UnprocessableEntityException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import sharp from "sharp"
import { DataSource } from "typeorm"

import {
  MediaAssetDetailSchema,
  MediaAssetListResponseSchema,
  MediaAssetSchema,
  MediaUploadGrantSchema,
  type MediaAsset,
  type MediaAssetArchive,
  type MediaAssetDetail,
  type MediaAssetListQuery,
  type MediaAssetMetadataMutation,
  type MediaUploadGrant,
  type MediaUploadInit,
  type MediaUsage,
  type SessionUser,
} from "@crm/contracts"
import {
  MediaAssetEntity,
  MediaBlobEntity,
  MediaProcessingJobEntity,
  MediaUploadEntity,
  MediaUsageEntity,
  MediaVariantEntity,
} from "@crm/db"

import { MediaStorageService } from "./media-storage.service.js"

const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"])
const variantWidths = [320, 640, 1280, 2400]

@Injectable()
export class MediaService {
  private readonly maxDecodedPixels: number
  private readonly signingSecret: string | null

  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(ConfigService) config: ConfigService,
    @Inject(MediaStorageService) private readonly storage: MediaStorageService,
  ) {
    this.maxDecodedPixels = config.get<number>("MEDIA_MAX_DECODED_PIXELS", 80_000_000)
    this.signingSecret = config.get<string>("MEDIA_UPLOAD_SIGNING_SECRET")
      ?? (config.get<string>("APP_ENV") === "production" ? null : "development-only-media-upload-secret-change-me")
  }

  async list(query: MediaAssetListQuery, actor: SessionUser) {
    this.assert(actor, "canViewContent")
    const builder = this.dataSource.getRepository(MediaAssetEntity).createQueryBuilder("asset")
    if (query.state) builder.andWhere("asset.state = :state", { state: query.state })
    if (query.q) builder.andWhere("LOWER(asset.title || ' ' || asset.original_filename || ' ' || COALESCE(asset.alt, '')) LIKE :q", { q: `%${escapeLike(query.q.toLocaleLowerCase("ru-RU"))}%` })
    const rows = await builder.orderBy("asset.updated_at", "DESC").addOrderBy("asset.id", "DESC").take(query.limit).getMany()
    return MediaAssetListResponseSchema.parse({ items: await Promise.all(rows.map((row) => this.asset(row))) })
  }

  async get(assetId: string, actor: SessionUser): Promise<MediaAssetDetail> {
    this.assert(actor, "canViewContent")
    const row = await this.findAsset(assetId)
    const usages = await this.refreshUsages(assetId)
    return MediaAssetDetailSchema.parse({ asset: await this.asset(row, usages), usages })
  }

  async initUpload(input: MediaUploadInit, actor: SessionUser, requestOrigin: string): Promise<MediaUploadGrant> {
    this.assert(actor, "canManageMedia")
    if (!this.signingSecret) throw new ServiceUnavailableException({ code: "MEDIA_UPLOAD_NOT_CONFIGURED", message: "Upload signing secret не настроен" })
    if (!imageMimeTypes.has(input.mimeType)) throw new UnprocessableEntityException({ code: "MEDIA_TYPE_NOT_ALLOWED", message: "Разрешены JPEG, PNG, WebP и AVIF; SVG проходит отдельный review pipeline" })
    const filename = normalizeFilename(input.filename)
    const duplicate = await this.dataSource.getRepository(MediaBlobEntity).findOne({ where: { checksumSha256: input.checksumSha256 } })
    if (duplicate) throw new ConflictException({ code: "MEDIA_DUPLICATE", message: "Этот файл уже загружен", details: { assetId: duplicate.assetId } })

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 15 * 60_000)
    const assetId = randomUUID()
    const uploadId = randomUUID()
    const token = this.uploadToken(uploadId, expiresAt)
    await this.dataSource.transaction(async (manager) => {
      await manager.save(manager.create(MediaAssetEntity, {
        id: assetId, kind: "image", state: "uploading", title: filename.replace(/\.[^.]+$/, ""), alt: null,
        caption: null, credit: null, license: null, tags: [], focalPoint: { x: 0.5, y: 0.5 }, originalFilename: filename,
        mimeType: input.mimeType, byteSize: input.byteSize, width: null, height: null, currentBlobId: null,
        createdBy: actor.id, updatedBy: actor.id, archivedAt: null,
      }))
      await manager.save(manager.create(MediaUploadEntity, {
        id: uploadId, assetId, state: "pending", filename, mimeType: input.mimeType, byteSize: input.byteSize,
        checksumSha256: input.checksumSha256, tokenHash: sha256(token), expiresAt, createdBy: actor.id,
        createdAt: now, completedAt: null, errorCode: null, errorMessage: null,
      }))
    })
    const origin = new URL(requestOrigin).origin
    return MediaUploadGrantSchema.parse({
      uploadId,
      uploadUrl: `${origin}/api/admin/v1/media/uploads/${uploadId}/content?token=${encodeURIComponent(token)}`,
      method: "PUT",
      expiresAt: expiresAt.toISOString(),
      requiredHeaders: { "content-type": input.mimeType, "x-content-sha256": input.checksumSha256 },
      maxByteSize: input.byteSize,
    })
  }

  async acceptUpload(uploadId: string, token: string, contentType: string | undefined, checksum: string | undefined, body: Buffer): Promise<MediaAsset> {
    const upload = await this.authorizeUpload(uploadId, token, contentType, checksum)
    if (body.byteLength !== upload.byteSize) return this.reject(upload, "MEDIA_SIZE_MISMATCH", "Размер файла не совпадает с upload grant")
    if (sha256(body) !== upload.checksumSha256) return this.reject(upload, "MEDIA_CHECKSUM_MISMATCH", "Checksum файла не совпадает с upload grant")

    const claimed = await this.dataSource.getRepository(MediaUploadEntity).update({ id: upload.id, state: "pending" }, { state: "processing" })
    if (claimed.affected !== 1) throw new ConflictException({ code: "MEDIA_UPLOAD_ALREADY_USED", message: "Upload grant уже используется" })
    const job = await this.dataSource.getRepository(MediaProcessingJobEntity).save(this.dataSource.getRepository(MediaProcessingJobEntity).create({
      id: randomUUID(), assetId: upload.assetId, uploadId: upload.id, blobId: null, state: "processing", attempts: 1,
      availableAt: new Date(), startedAt: new Date(), finishedAt: null, errorCode: null, errorMessage: null,
    }))

    try {
      assertSafeSignature(body, upload.mimeType)
      if (body.includes(Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE", "ascii"))) throw mediaError("MEDIA_MALWARE_DETECTED", "Файл заблокирован security scan")
      const source = sharp(body, { failOn: "error", limitInputPixels: this.maxDecodedPixels, pages: 1 })
      const metadata = await source.metadata()
      const width = metadata.width ?? 0
      const height = metadata.height ?? 0
      if (!width || !height || width > 20_000 || height > 20_000 || width * height > this.maxDecodedPixels) throw mediaError("MEDIA_DECODE_LIMIT", "Изображение превышает безопасный decoded-pixel limit")

      const blobId = randomUUID()
      const originalKey = `${upload.assetId}/${blobId}/original`
      await this.storage.writePrivate(originalKey, body)
      const generated: Array<{ row: MediaVariantEntity; value: Buffer }> = []
      const widths = [...new Set([...variantWidths.filter((candidate) => candidate <= width), width])].sort((a, b) => a - b)
      for (const targetWidth of widths) {
        for (const format of ["webp", "avif"] as const) {
          const pipeline = sharp(body, { failOn: "error", limitInputPixels: this.maxDecodedPixels, pages: 1 }).rotate().resize({ width: targetWidth, withoutEnlargement: true }).toColourspace("srgb")
          const value = format === "webp" ? await pipeline.webp({ quality: 82 }).toBuffer() : await pipeline.avif({ quality: 55, effort: 4 }).toBuffer()
          const variantMetadata = await sharp(value).metadata()
          const id = randomUUID()
          const storageKey = `${upload.assetId}/${blobId}/${targetWidth}.${format}`
          await this.storage.writePublic(storageKey, value)
          generated.push({ value, row: this.dataSource.getRepository(MediaVariantEntity).create({
            id, assetId: upload.assetId, blobId, format, width: variantMetadata.width!, height: variantMetadata.height!,
            byteSize: value.byteLength, storageKey, contentHash: sha256(value), createdAt: new Date(),
          }) })
        }
      }

      await this.dataSource.transaction(async (manager) => {
        await manager.save(manager.create(MediaBlobEntity, { id: blobId, assetId: upload.assetId, revision: 1, checksumSha256: upload.checksumSha256, mimeType: upload.mimeType, byteSize: body.byteLength, storageKey: originalKey, createdAt: new Date() }))
        await manager.save(generated.map(({ row }) => row))
        await manager.getRepository(MediaAssetEntity).update({ id: upload.assetId, state: "uploading" }, { state: "ready", width, height, currentBlobId: blobId, updatedAt: new Date() })
        await manager.getRepository(MediaUploadEntity).update({ id: upload.id, state: "processing" }, { state: "completed", completedAt: new Date() })
        await manager.getRepository(MediaProcessingJobEntity).update({ id: job.id }, { state: "completed", blobId, finishedAt: new Date() })
      })
      return this.asset(await this.findAsset(upload.assetId))
    } catch (error) {
      const code = error instanceof MediaPipelineError ? error.code : "MEDIA_PROCESSING_FAILED"
      const message = error instanceof Error ? error.message : "Media processing failed"
      await this.failUpload(upload, code, message, "failed", job.id)
      if (error instanceof UnprocessableEntityException) throw error
      throw new UnprocessableEntityException({ code, message })
    }
  }

  async uploadByteLimit(uploadId: string, token: string, contentType: string | undefined, checksum: string | undefined) {
    return (await this.authorizeUpload(uploadId, token, contentType, checksum)).byteSize
  }

  async updateMetadata(assetId: string, input: MediaAssetMetadataMutation, actor: SessionUser) {
    this.assert(actor, "canManageMedia")
    const result = await this.dataSource.getRepository(MediaAssetEntity).createQueryBuilder().update().set({
      title: input.title, alt: input.alt, caption: input.caption, credit: input.credit, license: input.license,
      tags: [...new Set(input.tags)], focalPoint: input.focalPoint, updatedBy: actor.id, updatedAt: new Date(), version: () => '"version" + 1',
    }).where("id = :assetId AND version = :version AND state <> 'archived'", { assetId, version: input.expectedVersion }).execute()
    if (result.affected !== 1) throw new ConflictException({ code: "VERSION_CONFLICT", message: "Asset уже изменён" })
    return this.get(assetId, actor)
  }

  async archive(assetId: string, input: MediaAssetArchive, actor: SessionUser) {
    this.assert(actor, "canManageMedia")
    const usages = await this.refreshUsages(assetId)
    if (usages.some((usage) => usage.published)) throw new ConflictException({ code: "MEDIA_PUBLISHED_USAGE", message: "Asset используется опубликованным контентом; сначала замените или отвяжите его" })
    const result = await this.dataSource.getRepository(MediaAssetEntity).createQueryBuilder().update().set({ state: "archived", archivedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id, version: () => '"version" + 1' }).where("id = :assetId AND version = :version AND state <> 'archived'", { assetId, version: input.expectedVersion }).execute()
    if (result.affected !== 1) throw new ConflictException({ code: "VERSION_CONFLICT", message: "Asset уже изменён" })
    return this.get(assetId, actor)
  }

  async publicVariant(assetId: string, variantId: string) {
    const variant = await this.dataSource.getRepository(MediaVariantEntity).createQueryBuilder("variant")
      .innerJoin(MediaAssetEntity, "asset", "asset.id = variant.asset_id AND asset.current_blob_id = variant.blob_id")
      .where("variant.id = :variantId AND variant.asset_id = :assetId AND asset.state = 'ready'", { variantId, assetId }).getOne()
    if (!variant) throw new NotFoundException({ code: "MEDIA_VARIANT_NOT_FOUND", message: "Media variant не найден" })
    return { value: await this.storage.readPublic(variant.storageKey), format: variant.format, contentHash: variant.contentHash }
  }

  private async asset(row: MediaAssetEntity, knownUsages?: MediaUsage[]): Promise<MediaAsset> {
    const variants = row.currentBlobId ? await this.dataSource.getRepository(MediaVariantEntity).find({ where: { assetId: row.id, blobId: row.currentBlobId }, order: { width: "ASC", format: "ASC" } }) : []
    const usages = knownUsages ?? await this.dataSource.getRepository(MediaUsageEntity).findBy({ assetId: row.id })
    return MediaAssetSchema.parse({
      id: row.id, version: row.version, kind: row.kind, state: row.state, title: row.title, alt: row.alt,
      caption: row.caption, credit: row.credit, license: row.license, tags: row.tags, focalPoint: row.focalPoint,
      originalFilename: row.originalFilename, mimeType: row.mimeType, byteSize: row.byteSize, width: row.width, height: row.height,
      variants: variants.map((variant) => ({ id: variant.id, format: variant.format, width: variant.width, height: variant.height, byteSize: variant.byteSize, url: `/api/public/v1/media/${row.id}/${variant.id}`, contentHash: variant.contentHash })),
      usageCount: usages.length, publishedUsage: usages.some((usage) => usage.published), archivedAt: row.archivedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    })
  }

  private async refreshUsages(assetId: string): Promise<MediaUsage[]> {
    await this.findAsset(assetId)
    const usages: MediaUsage[] = []
    const revisions = await this.dataSource.query<Array<{ id: string; state: string; hero: unknown; sections: unknown }>>(`SELECT id, state, hero, sections FROM cms_node_revisions WHERE hero::text LIKE $1 OR sections::text LIKE $1`, [`%${assetId}%`])
    for (const row of revisions) for (const [field, value] of [["hero", row.hero], ["sections", row.sections]] as const) for (const pointer of assetPointers(value, assetId, `/${field}`)) usages.push({ assetId, ownerType: "cms_revision", ownerId: row.id, pointer, published: row.state === "published" })
    const settings = await this.dataSource.query<Array<{ id: string; state: string; value: unknown }>>(`SELECT id, state, value FROM cms_site_settings_revisions WHERE value::text LIKE $1`, [`%${assetId}%`])
    for (const row of settings) for (const pointer of assetPointers(row.value, assetId, "/value")) usages.push({ assetId, ownerType: "cms_site_settings_revision", ownerId: row.id, pointer, published: row.state === "published" })
    const releases = await this.dataSource.query<Array<{ id: string; state: string; resolved_content: unknown }>>(`SELECT release.id, release.state, item.resolved_content FROM cms_release_items item JOIN cms_releases release ON release.id = item.release_id WHERE item.resolved_content::text LIKE $1`, [`%${assetId}%`])
    for (const row of releases) for (const pointer of assetPointers(row.resolved_content, assetId, "/resolvedContent")) usages.push({ assetId, ownerType: "release", ownerId: row.id, pointer, published: row.state === "published" })
    const deduped = [...new Map(usages.map((usage) => [`${usage.ownerType}:${usage.ownerId}:${usage.pointer}`, usage])).values()]
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(MediaUsageEntity).delete({ assetId })
      if (deduped.length) await manager.save(deduped.map((usage) => manager.create(MediaUsageEntity, { id: randomUUID(), ...usage, detectedAt: new Date() })))
    })
    return deduped
  }

  private async findAsset(id: string) {
    const row = await this.dataSource.getRepository(MediaAssetEntity).findOneBy({ id })
    if (!row) throw new NotFoundException({ code: "MEDIA_ASSET_NOT_FOUND", message: "Asset не найден" })
    return row
  }

  private uploadToken(uploadId: string, expiresAt: Date) { return `${expiresAt.getTime()}.${createHash("sha256").update(`${uploadId}:${expiresAt.getTime()}:${this.signingSecret}`).digest("hex")}.${randomBytes(16).toString("hex")}` }
  private validToken(upload: MediaUploadEntity, token: string) { const expected = Buffer.from(upload.tokenHash, "hex"); const actual = Buffer.from(sha256(token), "hex"); return expected.length === actual.length && timingSafeEqual(expected, actual) }
  private async authorizeUpload(uploadId: string, token: string, contentType: string | undefined, checksum: string | undefined) {
    const upload = await this.dataSource.getRepository(MediaUploadEntity).findOneBy({ id: uploadId })
    if (!upload || !this.validToken(upload, token)) throw new UnauthorizedException({ code: "MEDIA_UPLOAD_TOKEN_INVALID", message: "Upload grant недействителен" })
    if (upload.expiresAt.getTime() < Date.now()) { await this.failUpload(upload, "MEDIA_UPLOAD_EXPIRED", "Upload grant истёк", "expired"); throw new UnauthorizedException({ code: "MEDIA_UPLOAD_EXPIRED", message: "Upload grant истёк" }) }
    if (upload.state !== "pending") throw new ConflictException({ code: "MEDIA_UPLOAD_ALREADY_USED", message: "Upload grant уже использован" })
    if (contentType !== upload.mimeType || checksum !== upload.checksumSha256) throw new UnprocessableEntityException({ code: "MEDIA_UPLOAD_HEADERS_INVALID", message: "Content-Type или checksum не совпадает с upload grant" })
    return upload
  }
  private assert(actor: SessionUser, capability: "canViewContent" | "canManageMedia") { if (actor.capabilities[capability] !== true) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: `Capability ${capability} is required` }) }
  private async reject(upload: MediaUploadEntity, code: string, message: string): Promise<never> { await this.failUpload(upload, code, message, "failed"); throw new UnprocessableEntityException({ code, message }) }
  private async failUpload(upload: MediaUploadEntity, code: string, message: string, state: "failed" | "expired", jobId?: string) {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(MediaUploadEntity).update({ id: upload.id }, { state, errorCode: code, errorMessage: message, completedAt: new Date() })
      await manager.getRepository(MediaAssetEntity).update({ id: upload.assetId }, { state: "failed", updatedAt: new Date() })
      if (jobId) await manager.getRepository(MediaProcessingJobEntity).update({ id: jobId }, { state: "failed", errorCode: code, errorMessage: message, finishedAt: new Date() })
    })
  }
}

class MediaPipelineError extends Error { constructor(readonly code: string, message: string) { super(message) } }
function mediaError(code: string, message: string) { return new MediaPipelineError(code, message) }
function sha256(value: string | Buffer) { return createHash("sha256").update(value).digest("hex") }
function normalizeFilename(value: string) { const normalized = value.normalize("NFKC").replace(/[\\/\0\r\n]/g, "-").replace(/\s+/g, " ").trim(); if (!normalized || normalized === "." || normalized === "..") throw new UnprocessableEntityException({ code: "MEDIA_FILENAME_INVALID", message: "Filename недействителен" }); return normalized.slice(0, 500) }
function escapeLike(value: string) { return value.replace(/[\\%_]/g, "\\$&") }
function assertSafeSignature(value: Buffer, declared: string) {
  const detected = value[0] === 0xff && value[1] === 0xd8 && value[2] === 0xff ? "image/jpeg"
    : value.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? "image/png"
      : value.subarray(0, 4).toString("ascii") === "RIFF" && value.subarray(8, 12).toString("ascii") === "WEBP" ? "image/webp"
        : value.subarray(4, 8).toString("ascii") === "ftyp" && ["avif", "avis"].includes(value.subarray(8, 12).toString("ascii")) ? "image/avif" : null
  if (!detected || detected !== declared) throw mediaError("MEDIA_MAGIC_MISMATCH", "MIME не совпадает с сигнатурой файла")
}
function assetPointers(value: unknown, assetId: string, path: string): string[] {
  const result: string[] = []
  const visit = (current: unknown, pointer: string) => {
    if (Array.isArray(current)) { current.forEach((item, index) => visit(item, `${pointer}/${index}`)); return }
    if (!current || typeof current !== "object") return
    for (const [key, item] of Object.entries(current as Record<string, unknown>)) {
      const next = `${pointer}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`
      if ((key === "assetId" || key.endsWith("AssetId")) && item === assetId) result.push(next)
      visit(item, next)
    }
  }
  visit(value, path)
  return result
}
