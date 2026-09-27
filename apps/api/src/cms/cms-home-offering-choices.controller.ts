import { Controller, Get, Inject, Query } from "@nestjs/common"
import { CmsHomeOfferingChoiceListSchema, CmsHomeOfferingChoiceQuerySchema, type CmsHomeOfferingChoiceQuery } from "@crm/contracts"
import { CatalogOfferingEntity } from "@crm/db"
import { DataSource, In, IsNull, MoreThan } from "typeorm"

import { RequireCapabilities } from "../common/require-capability.decorator.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"

/** CRM is the source of choices; CMS stores only ordered offering IDs. */
@Controller("content/home-offering-choices")
export class CmsHomeOfferingChoicesController {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  @Get()
  @RequireCapabilities("canViewContent")
  async list(@Query(new ZodValidationPipe(CmsHomeOfferingChoiceQuerySchema)) query: CmsHomeOfferingChoiceQuery) {
    const rows = await this.dataSource.getRepository(CatalogOfferingEntity).find({
      where: { kind: query.kind, state: In(["draft", "active", "paused"]), archivedAt: IsNull(), ...(query.cursor ? { id: MoreThan(query.cursor) } : {}) },
      order: { id: "ASC" }, take: 101,
    })
    return CmsHomeOfferingChoiceListSchema.parse({
      items: rows.slice(0, 100).map((row) => ({ offeringId: row.id, title: row.operationalName, state: row.state })),
      nextCursor: rows.length > 100 ? rows[99]?.id ?? null : null,
    })
  }
}
