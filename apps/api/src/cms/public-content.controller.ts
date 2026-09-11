import { Controller, Get, Headers, Inject, Query, Res } from "@nestjs/common"
import type { Response } from "express"

import {
  PublicPagePreviewQuerySchema,
  PublicPageResolveQuerySchema,
  type PublicPagePreviewQuery,
  type PublicPageResolveQuery,
} from "@crm/contracts"

import { Public } from "../common/public.decorator.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"
import { PublicContentService } from "./public-content.service.js"

@Public()
@Controller("pages")
export class PublicContentController {
  constructor(@Inject(PublicContentService) private readonly content: PublicContentService) {}

  @Get("resolve")
  async resolve(
    @Query(new ZodValidationPipe(PublicPageResolveQuerySchema)) query: PublicPageResolveQuery,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Res() response: Response,
  ) {
    const page = await this.content.resolve(query)
    this.publicCacheHeaders(response, page.cache.etag, page.cache.maxAgeSeconds, page.cache.staleWhileRevalidateSeconds, page.cache.tags)
    if (ifNoneMatch === page.cache.etag) return response.status(304).send()
    return response.status(200).json(page)
  }

  @Get("manifest")
  async manifest(@Headers("if-none-match") ifNoneMatch: string | undefined, @Res() response: Response) {
    const manifest = await this.content.manifest()
    this.publicCacheHeaders(response, manifest.cache.etag, manifest.cache.maxAgeSeconds, manifest.cache.staleWhileRevalidateSeconds, manifest.cache.tags)
    if (ifNoneMatch === manifest.cache.etag) return response.status(304).send()
    return response.status(200).json(manifest)
  }

  @Get("preview")
  async preview(
    @Query(new ZodValidationPipe(PublicPagePreviewQuerySchema)) query: PublicPagePreviewQuery,
    @Res() response: Response,
  ) {
    const page = await this.content.preview(query)
    response.setHeader("Cache-Control", "private, no-store, max-age=0")
    response.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive")
    response.setHeader("Referrer-Policy", "no-referrer")
    return response.status(200).json(page)
  }

  private publicCacheHeaders(response: Response, etag: string, maxAge: number, staleWhileRevalidate: number, tags: string[]) {
    response.setHeader("ETag", etag)
    response.setHeader("Cache-Control", `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`)
    response.setHeader("Surrogate-Key", tags.join(" "))
  }
}
