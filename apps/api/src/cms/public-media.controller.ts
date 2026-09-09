import { Controller, Get, Inject, Param, Res } from "@nestjs/common"
import type { Response } from "express"

import { IdSchema } from "@crm/contracts"

import { Public } from "../common/public.decorator.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { MediaService } from "./media.service.js"

const PublicVariantParamsSchema = IdSchema.transform((assetId) => assetId)

@Public()
@Controller("media")
export class PublicMediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Get(":assetId/:variantId")
  async variant(
    @Param("assetId", new ZodValidationPipe(PublicVariantParamsSchema)) assetId: string,
    @Param("variantId", new ZodValidationPipe(PublicVariantParamsSchema)) variantId: string,
    @Res() response: Response,
  ) {
    const variant = await this.media.publicVariant(assetId, variantId)
    response.setHeader("Content-Type", variant.format === "avif" ? "image/avif" : "image/webp")
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable")
    response.setHeader("ETag", `"${variant.contentHash}"`)
    response.setHeader("X-Content-Type-Options", "nosniff")
    return response.status(200).send(variant.value)
  }
}
