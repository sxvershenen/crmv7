import { Controller, Get, Inject, Query } from "@nestjs/common"
import { CmsHomeOfferingChoiceListSchema, CmsHomeOfferingChoiceQuerySchema, type CmsHomeOfferingChoiceQuery } from "@crm/contracts"
import { CatalogOfferingEntity } from "@crm/db"
import { DataSource } from "typeorm"

import { RequireCapabilities } from "../common/require-capability.decorator.js"
import { ZodValidationPipe } from "../common/zod-validation.pipe.js"

/** CRM is the source of choices; CMS stores only ordered offering IDs. */
@Controller("content/home-offering-choices")
export class CmsHomeOfferingChoicesController {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  @Get()
  @RequireCapabilities("canViewContent")
  async list(@Query(new ZodValidationPipe(CmsHomeOfferingChoiceQuerySchema)) query: CmsHomeOfferingChoiceQuery) {
    const builder = this.dataSource.getRepository(CatalogOfferingEntity).createQueryBuilder("offering")
      .where("offering.kind = :kind", { kind: query.kind === "scheduled_resource" ? "addon" : query.kind })
      .andWhere("offering.state IN (:...states)", { states: ["draft", "active", "paused"] })
      .andWhere("offering.archived_at IS NULL")
      .orderBy("offering.id", "ASC").take(101)
    if (query.kind === "scheduled_resource") builder.innerJoin("addon_offering_terms", "terms", "terms.offering_id = offering.id AND terms.service_type = 'scheduled_resource'")
    if (query.cursor) builder.andWhere("offering.id > :cursor", { cursor: query.cursor })
    const rows = await builder.getMany()
    return CmsHomeOfferingChoiceListSchema.parse({
      items: rows.slice(0, 100).map((row) => ({ offeringId: row.id, title: row.operationalName, state: row.state })),
      nextCursor: rows.length > 100 ? rows[99]?.id ?? null : null,
    })
  }
}
