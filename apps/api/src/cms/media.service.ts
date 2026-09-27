import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"

import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException, UnprocessableEntityException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import sharp from "sharp"
import { DataSource, LessThanOrEqual } from "typeorm"

import {
  MediaAssetDetailSchema,
  MediaHealthSchema,
  MediaAssetListResponseSchema,
  MediaAssetSchema,
  MediaUploadGrantSchema,
  DateTimeSchema,
  IdSchema,
  type MediaAsset,
  type MediaAssetArchive,
  type MediaAssetDetail,
  type MediaAssetListQuery,
  type MediaAssetUsageQuery,
  type MediaAssetMetadataMutation,
  type MediaReplacementUploadInit,
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

import { mediaError, MediaPipelineError, MediaStorageError } from "./media-processing-error.js"
import { MediaMetricsService } from "./media-metrics.service.js"
import { MediaScannerService } from "./media-scanner.service.js"
import { MediaStorageService } from "./media-storage.service.js"

const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"])
const variantWidths = [320, 640, 1280, 2400]
const mediaCursorTimestamp = "date_trunc('milliseconds', asset.updated_at)"

@Injectable()
export class MediaService {
  private readonly maxDecodedPixels: number
  private readonly signingSecret: string | null
  private readonly maxProcessingAttempts: number
  private readonly processingRetryBaseMs: number
  private readonly processingLeaseMs: number
  private readonly cleanupGraceMs: number

  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(ConfigService) config: ConfigService,
    @Inject(MediaStorageService) private readonly storage: MediaStorageService,
    @Inject(MediaScannerService) private readonly scanner: MediaScannerService,
    @Inject(MediaMetricsService) private readonly metrics: MediaMetricsService,
  ) {
    this.maxDecodedPixels = config.get<number>("MEDIA_MAX_DECODED_PIXELS", 80_000_000)
    this.signingSecret = config.get<string>("MEDIA_UPLOAD_SIGNING_SECRET")
      ?? (config.get<string>("APP_ENV") === "production" ? null : "development-only-media-upload-secret-change-me")
    this.maxProcessingAttempts = config.get<number>("MEDIA_PROCESSING_MAX_ATTEMPTS", 5)
    this.processingRetryBaseMs = config.get<number>("MEDIA_PROCESSING_RETRY_BASE_MS", 30_000)
    this.processingLeaseMs = config.get<number>("MEDIA_PROCESSING_LEASE_MS", 5 * 60_000)
    this.cleanupGraceMs = config.get<number>("MEDIA_CLEANUP_GRACE_HOURS", 24) * 60 * 60_000
  }

  async list(query: MediaAssetListQuery, actor: SessionUser) {
    this.assert(actor, "canViewContent")
    const builder = this.dataSource.getRepository(MediaAssetEntity).createQueryBuilder("asset")
    if (query.state) builder.andWhere("asset.state = :state", { state: query.state })
    if (query.q) builder.andWhere("LOWER(asset.title || ' ' || asset.original_filename || ' ' || COALESCE(asset.alt, '')) LIKE :q", { q: `%${escapeLike(query.q.toLocaleLowerCase("ru-RU"))}%` })
    if (query.cursor) {
      const cursor = decodeMediaCursor(query.cursor)
      builder.andWhere(`(${mediaCursorTimestamp} < :beforeUpdatedAt OR (${mediaCursorTimestamp} = :beforeUpdatedAt AND asset.id < :beforeId))`, { beforeUpdatedAt: cursor.updatedAt, beforeId: cursor.id })
    }
    const rows = await builder.orderBy(mediaCursorTimestamp, "DESC").addOrderBy("asset.id", "DESC").take(query.limit + 1).getMany()
    const page = rows.slice(0, query.limit)
    const last = page.at(-1)
    return MediaAssetListResponseSchema.parse({
      items: await Promise.all(page.map((row) => this.asset(row))),
      nextCursor: rows.length > query.limit && last ? encodeMediaCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id }) : null,
    })
  }

  async get(assetId: string, query: MediaAssetUsageQuery, actor: SessionUser): Promise<MediaAssetDetail> {
    this.assert(actor, "canViewContent")
    const row = await this.findAsset(assetId)
    const allUsages = await this.refreshUsages(assetId)
    const matchingUsages = allUsages.filter((usage) => (
      (query.pageId === undefined || usage.pageId === query.pageId)
      && (query.path === undefined || usage.path === query.path)
      && (query.published === undefined || usage.published === query.published)
    ))
    const usages = matchingUsages.slice(0, query.limit)
    return MediaAssetDetailSchema.parse({
      asset: await this.asset(row, allUsages),
      usages,
      usageTotal: matchingUsages.length,
      usagesTruncated: matchingUsages.length > usages.length,
      processing: await this.processingStatus(assetId),
    })
  }

  private async processingStatus(assetId: string) {
    const upload = await this.dataSource.getRepository(MediaUploadEntity).findOne({
      where: { assetId }, order: { createdAt: "DESC", id: "DESC" },
    })
    if (!upload || upload.state === "completed") return null
    const job = await this.dataSource.getRepository(MediaProcessingJobEntity).findOneBy({ uploadId: upload.id })
    const expiredGrant = upload.state === "pending" && upload.expiresAt.getTime() < Date.now()
    const state = job?.state === "queued" ? "queued"
      : job?.state === "processing" ? "processing"
        : expiredGrant || upload.state === "failed" || upload.state === "expired" || job?.state === "failed" || job?.state === "dead_letter" ? "failed" : "uploading"
    const rawCode = job?.errorCode ?? upload.errorCode ?? (expiredGrant ? "MEDIA_UPLOAD_EXPIRED" : null)
    return {
      state,
      purpose: upload.purpose === "replacement" ? "replacement" : "initial",
      attempts: job?.attempts ?? 0,
      nextAttemptAt: state === "queued" ? job!.availableAt.toISOString() : null,
      errorCode: rawCode && /^MEDIA_[A-Z_]+$/.test(rawCode) && rawCode.length <= 120 ? rawCode : null,
    }
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
        id: uploadId, assetId, purpose: "initial", expectedAssetVersion: null, baseBlobId: null,
        state: "pending", filename, mimeType: input.mimeType, byteSize: input.byteSize,
        checksumSha256: input.checksumSha256, tokenHash: sha256(token), expiresAt, createdBy: actor.id,
        createdAt: now, completedAt: null, errorCode: null, errorMessage: null,
      }))
    })
    const origin = new URL(requestOrigin).origin
    return MediaUploadGrantSchema.parse({
      uploadId, assetId,
      uploadUrl: `${origin}/api/admin/v1/media/uploads/${uploadId}/content?token=${encodeURIComponent(token)}`,
      method: "PUT",
      expiresAt: expiresAt.toISOString(),
      requiredHeaders: { "content-type": input.mimeType, "x-content-sha256": input.checksumSha256 },
      maxByteSize: input.byteSize,
    })
  }

  async initReplacement(assetId: string, input: MediaReplacementUploadInit, actor: SessionUser, requestOrigin: string): Promise<MediaUploadGrant> {
    this.assert(actor, "canManageMedia")
    if (!this.signingSecret) throw new ServiceUnavailableException({ code: "MEDIA_UPLOAD_NOT_CONFIGURED", message: "Upload signing secret не настроен" })
    if (!imageMimeTypes.has(input.mimeType)) throw new UnprocessableEntityException({ code: "MEDIA_TYPE_NOT_ALLOWED", message: "Разрешены JPEG, PNG, WebP и AVIF; SVG проходит отдельный review pipeline" })
    const filename = normalizeFilename(input.filename)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 15 * 60_000)
    const uploadId = randomUUID()
    const token = this.uploadToken(uploadId, expiresAt)

    await this.dataSource.transaction(async (manager) => {
      const asset = await manager.getRepository(MediaAssetEntity).createQueryBuilder("asset")
        .setLock("pessimistic_write").where("asset.id = :assetId", { assetId }).getOne()
      if (!asset) throw new NotFoundException({ code: "MEDIA_ASSET_NOT_FOUND", message: "Asset не найден" })
      if (asset.state !== "ready" || !asset.currentBlobId) throw new ConflictException({ code: "MEDIA_REPLACEMENT_NOT_READY", message: "Заменить можно только ready asset" })
      if (asset.version !== input.expectedVersion) throw new ConflictException({ code: "VERSION_CONFLICT", message: "Asset уже изменён" })
      const duplicate = await manager.getRepository(MediaBlobEntity).findOne({ where: { checksumSha256: input.checksumSha256 } })
      if (duplicate) throw new ConflictException({
        code: duplicate.assetId === assetId ? "MEDIA_REPLACEMENT_DUPLICATE" : "MEDIA_DUPLICATE",
        message: duplicate.assetId === assetId ? "Эта версия файла уже есть у asset" : "Этот файл уже загружен",
        details: { assetId: duplicate.assetId },
      })
      await manager.save(manager.create(MediaUploadEntity, {
        id: uploadId, assetId, purpose: "replacement", expectedAssetVersion: input.expectedVersion, baseBlobId: asset.currentBlobId,
        state: "pending", filename, mimeType: input.mimeType, byteSize: input.byteSize,
        checksumSha256: input.checksumSha256, tokenHash: sha256(token), expiresAt, createdBy: actor.id,
        createdAt: now, completedAt: null, stagingKey: null, errorCode: null, errorMessage: null,
      }))
    })
    const origin = new URL(requestOrigin).origin
    return MediaUploadGrantSchema.parse({
      uploadId, assetId,
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

    const stagingKey = `${upload.id}/payload`
    try {
      await this.storage.writeStaging(stagingKey, body, upload.mimeType)
    } catch {
      throw new ServiceUnavailableException({ code: "MEDIA_STAGING_UNAVAILABLE", message: "Не удалось сохранить upload для обработки" })
    }
    const job = await this.dataSource.transaction(async (manager) => {
      const claimed = await manager.getRepository(MediaUploadEntity).update({ id: upload.id, state: "pending" }, { state: "processing" })
      if (claimed.affected !== 1) throw new ConflictException({ code: "MEDIA_UPLOAD_ALREADY_USED", message: "Upload grant уже используется" })
      await manager.getRepository(MediaUploadEntity).update({ id: upload.id }, { stagingKey })
      return manager.save(manager.getRepository(MediaProcessingJobEntity).create({
        id: randomUUID(), assetId: upload.assetId, uploadId: upload.id, blobId: null, state: "queued", attempts: 0,
        availableAt: new Date(), startedAt: null, finishedAt: null, errorCode: null, errorMessage: null,
      }))
    })
    this.metrics.increment("uploadsAccepted")

    await this.processJob(job.id)
    const currentJob = await this.dataSource.getRepository(MediaProcessingJobEntity).findOneBy({ id: job.id })
    if (currentJob?.state === "queued") throw new ServiceUnavailableException({ code: "MEDIA_PROCESSING_QUEUED", message: "Файл принят и ожидает повторной обработки" })
    if (currentJob?.state === "dead_letter") throw new ServiceUnavailableException({ code: "MEDIA_PROCESSING_DEAD_LETTER", message: "Файл передан в очередь ручного разбора" })
    return this.asset(await this.findAsset(upload.assetId))
  }

  async uploadByteLimit(uploadId: string, token: string, contentType: string | undefined, checksum: string | undefined) {
    return (await this.authorizeUpload(uploadId, token, contentType, checksum)).byteSize
  }

  /** Claim and process one queued job. The claim is CAS-safe across API instances. */
  async processJob(jobId: string): Promise<void> {
    const now = new Date()
    const claimed = await this.dataSource.getRepository(MediaProcessingJobEntity).createQueryBuilder().update().set({
      state: "processing", attempts: () => '"attempts" + 1', startedAt: now, finishedAt: null,
    }).where("id = :jobId AND state = 'queued' AND available_at <= :now", { jobId, now }).execute()
    if (claimed.affected !== 1) return

    const job = await this.dataSource.getRepository(MediaProcessingJobEntity).findOneBy({ id: jobId })
    if (!job) return
    const upload = await this.dataSource.getRepository(MediaUploadEntity).findOneBy({ id: job.uploadId })
    if (!upload || !upload.stagingKey) {
      await this.failProcessing(job, upload, mediaError("MEDIA_STAGING_MISSING", "Upload staging object is missing"))
      throw new UnprocessableEntityException({ code: "MEDIA_STAGING_MISSING", message: "Upload staging object is missing" })
    }

    if (upload.purpose === "initial") {
      const started = await this.dataSource.getRepository(MediaAssetEntity).update({ id: job.assetId, state: "uploading" }, { state: "processing", updatedAt: now })
      if (started.affected !== 1) {
        const asset = await this.dataSource.getRepository(MediaAssetEntity).findOneBy({ id: job.assetId })
        if (asset?.state !== "processing" || asset.currentBlobId !== null) {
          const error = mediaError("MEDIA_UPLOAD_STALE", "Asset state changed before initial upload processing")
          await this.failProcessing(job, upload, error)
          throw new ConflictException({ code: error.code, message: error.message })
        }
      }
    }
    try {
      const body = await this.storage.readStaging(upload.stagingKey)
      await this.scanner.scan(body, upload.mimeType)
      assertSafeSignature(body, upload.mimeType)
      if (body.includes(Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE", "ascii"))) throw mediaError("MEDIA_MALWARE_DETECTED", "Файл заблокирован security scan")
      const source = sharp(body, { failOn: "error", limitInputPixels: this.maxDecodedPixels, pages: 1 })
      let metadata
      try {
        metadata = await source.metadata()
      } catch {
        throw mediaError("MEDIA_DECODE_FAILED", "Изображение не удалось декодировать")
      }
      const width = metadata.width ?? 0
      const height = metadata.height ?? 0
      if (!width || !height || width > 20_000 || height > 20_000 || width * height > this.maxDecodedPixels) throw mediaError("MEDIA_DECODE_LIMIT", "Изображение превышает безопасный decoded-pixel limit")

      const blobId = randomUUID()
      const originalKey = `${upload.assetId}/${blobId}/original`
      await this.storage.writePrivate(originalKey, body, upload.mimeType)
      const generated: MediaVariantEntity[] = []
      const widths = [...new Set([...variantWidths.filter((candidate) => candidate <= width), width])].sort((a, b) => a - b)
      for (const targetWidth of widths) {
        for (const format of ["webp", "avif"] as const) {
          let value: Buffer
          try {
            const pipeline = sharp(body, { failOn: "error", limitInputPixels: this.maxDecodedPixels, pages: 1 }).rotate().resize({ width: targetWidth, withoutEnlargement: true }).toColourspace("srgb")
            value = format === "webp" ? await pipeline.webp({ quality: 82 }).toBuffer() : await pipeline.avif({ quality: 55, effort: 4 }).toBuffer()
          } catch {
            throw mediaError("MEDIA_PROCESSING_FAILED", "Не удалось создать public media variant")
          }
          const variantMetadata = await sharp(value).metadata()
          const storageKey = `${upload.assetId}/${blobId}/${targetWidth}.${format}`
          await this.storage.writePublic(storageKey, value, format === "avif" ? "image/avif" : "image/webp")
          generated.push(this.dataSource.getRepository(MediaVariantEntity).create({
            id: randomUUID(), assetId: upload.assetId, blobId, format, width: variantMetadata.width!, height: variantMetadata.height!,
            byteSize: value.byteLength, storageKey, contentHash: sha256(value), createdAt: new Date(),
          }))
        }
      }

      await this.dataSource.transaction(async (manager) => {
        const asset = await manager.getRepository(MediaAssetEntity).createQueryBuilder("asset")
          .setLock("pessimistic_write").where("asset.id = :assetId", { assetId: upload.assetId }).getOne()
        if (!asset) throw mediaError("MEDIA_UPLOAD_STALE", "Asset was removed before media processing completed")
        if (upload.purpose === "replacement") {
          if (asset.state !== "ready" || asset.version !== upload.expectedAssetVersion || asset.currentBlobId !== upload.baseBlobId) {
            throw mediaError("MEDIA_REPLACEMENT_STALE", "Asset changed after the replacement upload grant was issued")
          }
        } else if (asset.state !== "processing" || asset.currentBlobId !== null) {
          throw mediaError("MEDIA_UPLOAD_STALE", "Asset changed before initial upload processing completed")
        }
        const revisionRows = await manager.query<Array<{ revision: number }>>(
          `SELECT COALESCE(MAX(revision), 0)::int + 1 AS revision FROM media_blobs WHERE asset_id = $1`,
          [upload.assetId],
        )
        const revision = revisionRows[0]?.revision
        if (!revision) throw mediaError("MEDIA_PROCESSING_FAILED", "Could not allocate the next media blob revision")
        await manager.save(manager.create(MediaBlobEntity, { id: blobId, assetId: upload.assetId, revision, checksumSha256: upload.checksumSha256, mimeType: upload.mimeType, byteSize: body.byteLength, storageKey: originalKey, createdAt: new Date() }))
        await manager.save(generated)
        const replacementFields = upload.purpose === "replacement" ? {
          originalFilename: upload.filename,
          mimeType: upload.mimeType,
          byteSize: upload.byteSize,
          updatedBy: upload.createdBy,
          version: () => '"version" + 1',
        } : {}
        const switched = await manager.getRepository(MediaAssetEntity).createQueryBuilder().update().set({
          state: "ready", width, height, currentBlobId: blobId, updatedAt: new Date(), ...replacementFields,
        }).where(
          upload.purpose === "replacement"
            ? "id = :assetId AND state = 'ready' AND version = :expectedVersion AND current_blob_id = :baseBlobId"
            : "id = :assetId AND state = 'processing' AND current_blob_id IS NULL",
          { assetId: upload.assetId, expectedVersion: upload.expectedAssetVersion, baseBlobId: upload.baseBlobId },
        ).execute()
        if (switched.affected !== 1) throw mediaError(
          upload.purpose === "replacement" ? "MEDIA_REPLACEMENT_STALE" : "MEDIA_UPLOAD_STALE",
          upload.purpose === "replacement" ? "Asset changed before replacement activation" : "Asset changed before upload activation",
        )
        await manager.getRepository(MediaUploadEntity).update({ id: upload.id, state: "processing" }, { state: "completed", stagingKey: null, completedAt: new Date() })
        await manager.getRepository(MediaProcessingJobEntity).update({ id: job.id, state: "processing" }, { state: "completed", blobId, finishedAt: new Date() })
      })
      await this.storage.deleteStaging(upload.stagingKey).catch(() => undefined)
      this.metrics.increment("uploadsReady")
    } catch (error) {
      const pipelineError = error instanceof MediaPipelineError
        ? error
        : error instanceof MediaStorageError
          ? mediaError("MEDIA_STORAGE_UNAVAILABLE", "Media storage temporarily unavailable", true)
          : mediaError("MEDIA_PROCESSING_FAILED", error instanceof Error ? error.message : "Media processing failed")
      await this.failProcessing(job, upload, pipelineError)
      if (pipelineError.code === "MEDIA_REPLACEMENT_STALE" || pipelineError.code === "MEDIA_UPLOAD_STALE") {
        throw new ConflictException({ code: pipelineError.code, message: pipelineError.message })
      }
      if (pipelineError.retryable && job.attempts < this.maxProcessingAttempts) return
      if (pipelineError.retryable) throw new ServiceUnavailableException({ code: "MEDIA_PROCESSING_DEAD_LETTER", message: "Media processing temporarily unavailable" })
      throw new UnprocessableEntityException({ code: pipelineError.code, message: pipelineError.message })
    }
  }

  async processDueJobs(limit = 10) {
    await this.recoverStaleJobs()
    const jobs = await this.dataSource.getRepository(MediaProcessingJobEntity).find({
      where: { state: "queued", availableAt: LessThanOrEqual(new Date()) }, order: { availableAt: "ASC", id: "ASC" }, take: limit,
    })
    for (const job of jobs) await this.processJob(job.id).catch(() => undefined)
  }

  private async recoverStaleJobs() {
    const cutoff = new Date(Date.now() - this.processingLeaseMs)
    const jobs = await this.dataSource.getRepository(MediaProcessingJobEntity).find({
      where: { state: "processing", startedAt: LessThanOrEqual(cutoff) }, order: { startedAt: "ASC", id: "ASC" }, take: 100,
    })
    for (const job of jobs) {
      if (job.attempts < this.maxProcessingAttempts) {
        await this.dataSource.getRepository(MediaProcessingJobEntity).update({ id: job.id, state: "processing" }, {
          state: "queued", availableAt: new Date(), startedAt: null, finishedAt: null,
          errorCode: "MEDIA_PROCESSING_LEASE_EXPIRED", errorMessage: "Processing lease expired; job requeued",
        })
        this.metrics.increment("processingRetries")
        continue
      }
      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(MediaProcessingJobEntity).update({ id: job.id, state: "processing" }, {
          state: "dead_letter", finishedAt: new Date(), errorCode: "MEDIA_PROCESSING_LEASE_EXHAUSTED", errorMessage: "Processing lease expired after the attempt budget",
        })
        await manager.getRepository(MediaUploadEntity).update({ id: job.uploadId, state: "processing" }, { state: "failed", errorCode: "MEDIA_PROCESSING_LEASE_EXHAUSTED", errorMessage: "Processing lease expired after the attempt budget", completedAt: new Date() })
        await manager.getRepository(MediaAssetEntity).update({ id: job.assetId, state: "processing" }, { state: "failed", updatedAt: new Date() })
      })
      this.metrics.increment("processingDeadLetters")
      this.metrics.increment("uploadsFailed")
    }
  }

  async cleanupUnreferencedObjects() {
    const cutoff = new Date(Date.now() - this.cleanupGraceMs)
    const referenced = new Set<string>()
    const terminalStagingKeys = new Map<string, string>()
    const blobs = await this.dataSource.getRepository(MediaBlobEntity).find()
    for (const blob of blobs) referenced.add(`private/${blob.storageKey}`)
    const variants = await this.dataSource.getRepository(MediaVariantEntity).find()
    for (const variant of variants) referenced.add(`public/${variant.storageKey}`)
    const uploads = await this.dataSource.getRepository(MediaUploadEntity).find()
    for (const upload of uploads) {
      if (!upload.stagingKey) continue
      const terminal = ["completed", "failed", "expired"].includes(upload.state) && upload.completedAt !== null && upload.completedAt <= cutoff
      if (terminal) terminalStagingKeys.set(`staging/${upload.stagingKey}`, upload.id)
      else referenced.add(`staging/${upload.stagingKey}`)
    }

    let deleted = 0
    try {
      const seen = new Set<string>()
      for (const object of await this.storage.listObjects()) {
        seen.add(object.key)
        if (!/^(private|public|staging)\//.test(object.key)) continue
        if (referenced.has(object.key) || object.lastModified > cutoff) continue
        try {
          await this.storage.deleteObject(object.key)
          deleted += 1
          const uploadId = terminalStagingKeys.get(object.key)
          if (uploadId) {
            await this.dataSource.getRepository(MediaUploadEntity).update({ id: uploadId }, { stagingKey: null })
            terminalStagingKeys.delete(object.key)
          }
        } catch {
          this.metrics.increment("cleanupFailures")
        }
      }
      for (const [objectKey, uploadId] of terminalStagingKeys) {
        if (seen.has(objectKey) || !objectKey.startsWith("staging/")) continue
        await this.dataSource.getRepository(MediaUploadEntity).update({ id: uploadId }, { stagingKey: null })
      }
      if (deleted) this.metrics.increment("cleanupDeletedObjects", deleted)
    } catch {
      this.metrics.increment("cleanupFailures")
    }
    return { deleted }
  }

  async mediaHealth() {
    const jobs = await this.dataSource.getRepository(MediaProcessingJobEntity).createQueryBuilder("job")
      .select("job.state", "state").addSelect("COUNT(*)", "count").groupBy("job.state").getRawMany<{ state: string; count: string }>()
    return MediaHealthSchema.parse({
      jobs: Object.fromEntries(jobs.map((row) => [row.state, Number(row.count)])),
      metrics: this.metrics.snapshot(),
    })
  }

  async updateMetadata(assetId: string, input: MediaAssetMetadataMutation, actor: SessionUser) {
    this.assert(actor, "canManageMedia")
    const result = await this.dataSource.getRepository(MediaAssetEntity).createQueryBuilder().update().set({
      title: input.title, alt: input.alt, caption: input.caption, credit: input.credit, license: input.license,
      tags: [...new Set(input.tags)], focalPoint: input.focalPoint, updatedBy: actor.id, updatedAt: new Date(), version: () => '"version" + 1',
    }).where("id = :assetId AND version = :version AND state <> 'archived'", { assetId, version: input.expectedVersion }).execute()
    if (result.affected !== 1) throw new ConflictException({ code: "VERSION_CONFLICT", message: "Asset уже изменён" })
    return this.get(assetId, { limit: 100 }, actor)
  }

  async archive(assetId: string, input: MediaAssetArchive, actor: SessionUser) {
    this.assert(actor, "canManageMedia")
    const usages = await this.refreshUsages(assetId)
    if (usages.some((usage) => usage.published)) throw new ConflictException({ code: "MEDIA_PUBLISHED_USAGE", message: "Asset используется опубликованным контентом; сначала замените или отвяжите его" })
    const result = await this.dataSource.getRepository(MediaAssetEntity).createQueryBuilder().update().set({ state: "archived", archivedAt: new Date(), updatedAt: new Date(), updatedBy: actor.id, version: () => '"version" + 1' }).where("id = :assetId AND version = :version AND state <> 'archived'", { assetId, version: input.expectedVersion }).execute()
    if (result.affected !== 1) throw new ConflictException({ code: "VERSION_CONFLICT", message: "Asset уже изменён" })
    return this.get(assetId, { limit: 100 }, actor)
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
      variants: variants.map((variant) => ({ id: variant.id, format: variant.format, width: variant.width, height: variant.height, byteSize: variant.byteSize, url: this.storage.publicUrl(`public/${variant.storageKey}`, `/api/public/v1/media/${row.id}/${variant.id}`), contentHash: variant.contentHash })),
      usageCount: usages.length, publishedUsage: usages.some((usage) => usage.published), archivedAt: row.archivedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    })
  }

  private async refreshUsages(assetId: string): Promise<MediaUsage[]> {
    await this.findAsset(assetId)
    const usages: MediaUsage[] = []
    const revisions = await this.dataSource.query<Array<{ id: string; node_id: string; path: string; state: string; hero: unknown; sections: unknown }>>(`SELECT id, node_id, path, state, hero, sections FROM cms_node_revisions WHERE hero::text LIKE $1 OR sections::text LIKE $1`, [`%${assetId}%`])
    for (const row of revisions) for (const [field, value] of [["hero", row.hero], ["sections", row.sections]] as const) for (const pointer of assetPointers(value, assetId, `/${field}`)) usages.push({ assetId, ownerType: "cms_revision", ownerId: row.id, pageId: row.node_id, path: row.path, pointer, published: row.state === "published" })
    const settings = await this.dataSource.query<Array<{ id: string; state: string; value: unknown }>>(`SELECT id, state, value FROM cms_site_settings_revisions WHERE value::text LIKE $1`, [`%${assetId}%`])
    for (const row of settings) for (const pointer of assetPointers(row.value, assetId, "/value")) usages.push({ assetId, ownerType: "cms_site_settings_revision", ownerId: row.id, pageId: null, path: null, pointer, published: row.state === "published" })
    const releases = await this.dataSource.query<Array<{ id: string; node_id: string; path: string; state: string; resolved_content: unknown }>>(`SELECT release.id, release.state, item.node_id, item.path, item.resolved_content FROM cms_release_items item JOIN cms_releases release ON release.id = item.release_id WHERE item.resolved_content::text LIKE $1`, [`%${assetId}%`])
    for (const row of releases) for (const pointer of assetPointers(row.resolved_content, assetId, "/resolvedContent")) usages.push({ assetId, ownerType: "release", ownerId: row.id, pageId: row.node_id, path: row.path, pointer, published: row.state === "published" })
    const deduped = [...new Map(usages.map((usage) => [`${usage.ownerType}:${usage.ownerId}:${usage.pageId ?? "global"}:${usage.path ?? "global"}:${usage.pointer}`, usage])).values()]
      .sort((left, right) => (left.path ?? "").localeCompare(right.path ?? "") || left.ownerType.localeCompare(right.ownerType) || left.ownerId.localeCompare(right.ownerId) || left.pointer.localeCompare(right.pointer))
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
  private async failProcessing(job: MediaProcessingJobEntity, upload: MediaUploadEntity | null, error: MediaPipelineError) {
    const deadLetter = error.retryable && job.attempts >= this.maxProcessingAttempts
    const state = deadLetter ? "dead_letter" : error.retryable ? "queued" : "failed"
    const availableAt = state === "queued" ? new Date(Date.now() + this.processingRetryBaseMs * Math.min(32, 2 ** Math.max(0, job.attempts - 1))) : job.availableAt
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(MediaProcessingJobEntity).update({ id: job.id }, {
        state, availableAt, startedAt: state === "queued" ? null : job.startedAt, errorCode: error.code, errorMessage: error.message, finishedAt: state === "queued" ? null : new Date(),
      })
      if (upload && (state === "failed" || deadLetter)) {
        await manager.getRepository(MediaUploadEntity).update({ id: upload.id }, { state: "failed", errorCode: error.code, errorMessage: error.message, completedAt: new Date() })
      }
      if ((state === "failed" || deadLetter) && upload?.purpose === "initial") await manager.getRepository(MediaAssetEntity).update({ id: job.assetId, state: "processing" }, { state: "failed", updatedAt: new Date() })
    })
    if (error.code.startsWith("MEDIA_SCANNER")) this.metrics.increment("scannerFailures")
    if (state === "queued") this.metrics.increment("processingRetries")
    else {
      this.metrics.increment("uploadsFailed")
      if (deadLetter) this.metrics.increment("processingDeadLetters")
    }
  }
  private async failUpload(upload: MediaUploadEntity, code: string, message: string, state: "failed" | "expired", jobId?: string) {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(MediaUploadEntity).update({ id: upload.id }, { state, errorCode: code, errorMessage: message, completedAt: new Date() })
      if (upload.purpose === "initial") await manager.getRepository(MediaAssetEntity).update({ id: upload.assetId }, { state: "failed", updatedAt: new Date() })
      if (jobId) await manager.getRepository(MediaProcessingJobEntity).update({ id: jobId }, { state: "failed", errorCode: code, errorMessage: message, finishedAt: new Date() })
    })
  }
}
function sha256(value: string | Buffer) { return createHash("sha256").update(value).digest("hex") }
function normalizeFilename(value: string) { const normalized = value.normalize("NFKC").replace(/[\\/\0\r\n]/g, "-").replace(/\s+/g, " ").trim(); if (!normalized || normalized === "." || normalized === "..") throw new UnprocessableEntityException({ code: "MEDIA_FILENAME_INVALID", message: "Filename недействителен" }); return normalized.slice(0, 500) }
type MediaCursor = { updatedAt: string; id: string }

export function encodeMediaCursor(value: MediaCursor) { return Buffer.from(JSON.stringify(value), "utf8").toString("base64url") }
export function decodeMediaCursor(value: string): MediaCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<MediaCursor>
    const updatedAt = DateTimeSchema.safeParse(parsed.updatedAt)
    const id = IdSchema.safeParse(parsed.id)
    if (!updatedAt.success || !id.success) throw new Error("Invalid cursor")
    return { updatedAt: updatedAt.data, id: id.data }
  } catch {
    throw new BadRequestException({ code: "INVALID_CURSOR", message: "Курсор медиатеки недействителен" })
  }
}

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
