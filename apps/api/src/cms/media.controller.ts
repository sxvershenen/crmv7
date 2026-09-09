import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, PayloadTooLargeException, Post, Put, Query, Req } from "@nestjs/common"

import {
  MediaAssetArchiveSchema,
  MediaAssetIdParamsSchema,
  MediaAssetListQuerySchema,
  MediaAssetMetadataMutationSchema,
  MediaUploadIdParamsSchema,
  MediaUploadInitSchema,
  MediaUploadTokenQuerySchema,
  type MediaAssetArchive,
  type MediaAssetListQuery,
  type MediaAssetMetadataMutation,
  type MediaUploadInit,
} from "@crm/contracts"

import { Public } from "../common/public.decorator.js"
import type { AuthenticatedRequest } from "../common/request-context.js"
import { RequireCapabilities } from "../common/require-capability.decorator.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { MediaService } from "./media.service.js"

@Controller("media")
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Get("assets")
  @RequireCapabilities("canViewContent")
  list(@Query(new ZodValidationPipe(MediaAssetListQuerySchema)) query: MediaAssetListQuery, @Req() request: AuthenticatedRequest) {
    return this.media.list(query, request.sessionUser!)
  }

  @Get("assets/:assetId")
  @RequireCapabilities("canViewContent")
  get(@Param(new ZodValidationPipe(MediaAssetIdParamsSchema)) params: { assetId: string }, @Req() request: AuthenticatedRequest) {
    return this.media.get(params.assetId, request.sessionUser!)
  }

  @Post("uploads")
  @RequireCapabilities("canManageMedia")
  init(@Body(new ZodValidationPipe(MediaUploadInitSchema)) input: MediaUploadInit, @Req() request: AuthenticatedRequest) {
    return this.media.initUpload(input, request.sessionUser!, `${request.protocol}://${request.get("host")}`)
  }

  @Public()
  @Put("uploads/:uploadId/content")
  @HttpCode(200)
  async upload(
    @Param(new ZodValidationPipe(MediaUploadIdParamsSchema)) params: { uploadId: string },
    @Query(new ZodValidationPipe(MediaUploadTokenQuerySchema)) query: { token: string },
    @Headers("content-type") contentType: string | undefined,
    @Headers("x-content-sha256") checksum: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const limit = await this.media.uploadByteLimit(params.uploadId, query.token, contentType, checksum)
    return this.media.acceptUpload(params.uploadId, query.token, contentType, checksum, await readRequestBody(request, limit))
  }

  @Patch("assets/:assetId")
  @RequireCapabilities("canManageMedia")
  update(
    @Param(new ZodValidationPipe(MediaAssetIdParamsSchema)) params: { assetId: string },
    @Body(new ZodValidationPipe(MediaAssetMetadataMutationSchema)) input: MediaAssetMetadataMutation,
    @Req() request: AuthenticatedRequest,
  ) { return this.media.updateMetadata(params.assetId, input, request.sessionUser!) }

  @Post("assets/:assetId/archive")
  @HttpCode(200)
  @RequireCapabilities("canManageMedia")
  archive(
    @Param(new ZodValidationPipe(MediaAssetIdParamsSchema)) params: { assetId: string },
    @Body(new ZodValidationPipe(MediaAssetArchiveSchema)) input: MediaAssetArchive,
    @Req() request: AuthenticatedRequest,
  ) { return this.media.archive(params.assetId, input, request.sessionUser!) }
}

async function readRequestBody(request: AuthenticatedRequest, maxBytes: number) {
  const declared = Number(request.header("content-length") ?? "0")
  if (declared > maxBytes) throw new PayloadTooLargeException({ code: "MEDIA_SIZE_LIMIT", message: "Upload exceeds maximum byte size" })
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of request as unknown as AsyncIterable<Buffer | string>) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += value.byteLength
    if (total > maxBytes) throw new PayloadTooLargeException({ code: "MEDIA_SIZE_LIMIT", message: "Upload exceeds maximum byte size" })
    chunks.push(value)
  }
  return Buffer.concat(chunks, total)
}
