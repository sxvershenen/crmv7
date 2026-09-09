import "reflect-metadata"

import crmDataSource from "@crm/db/data-source"

import { inspectLegacyCatalogOfferingPromotion } from "../cms/cms-source-draft.js"

async function main() {
  await crmDataSource.initialize()
  try {
    const report = await crmDataSource.transaction("REPEATABLE READ", async (manager) => {
      await manager.query("SET TRANSACTION READ ONLY")
      const rows = await manager.query(`
        SELECT source_id AS "resourceId"
        FROM cms_source_links
        WHERE source_kind = 'resource'
        ORDER BY source_id ASC
      `) as Array<{ resourceId: string }>
      const items = []
      for (const row of rows) items.push(await inspectLegacyCatalogOfferingPromotion(manager, row.resourceId))
      return {
        generatedAt: new Date().toISOString(),
        mode: "read_only" as const,
        summary: {
          total: items.length,
          eligible: items.filter((item) => item.status === "eligible").length,
          ambiguous: items.filter((item) => item.status === "ambiguous").length,
          noExactPrimary: items.filter((item) => item.status === "no_exact_primary").length,
        },
        items,
      }
    })
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  } finally {
    await crmDataSource.destroy()
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exitCode = 1
})
