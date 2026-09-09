import "reflect-metadata"

import crmDataSource from "@crm/db/data-source"

import { buildLegacyOfferingBackfillReport, type LegacyProgramForOffering, type LegacyResourceForOffering } from "./legacy-offering-backfill.js"

async function main() {
  await crmDataSource.initialize()
  try {
    const resources = await crmDataSource.query(`
      SELECT resource.id, resource.code, resource.kind, resource.name,
             resource.capacity_mode AS "capacityMode", resource.capacity_total AS "capacityTotal",
             resource.settings, resource.archived_at IS NOT NULL AS archived,
             EXISTS (
               SELECT 1 FROM offering_bindings binding
               WHERE binding.resource_id = resource.id AND binding.archived_at IS NULL
             ) AS "alreadyBound"
      FROM resources resource
      ORDER BY resource.code
    `) as LegacyResourceForOffering[]
    const programs = await crmDataSource.query(`
      SELECT program.id, program.code, program.name,
             program.base_price_amount AS "basePriceAmount", program.currency,
             program.publication, program.archived_at IS NOT NULL AS archived,
             EXISTS (
               SELECT 1 FROM offering_bindings binding
               WHERE binding.program_template_id = program.id AND binding.archived_at IS NULL
             ) AS "alreadyBound"
      FROM program_templates program
      ORDER BY program.code
    `) as LegacyProgramForOffering[]
    const calendarRows = await crmDataSource.query(`
      SELECT count(*)::integer AS count
      FROM business_calendars
      WHERE state = 'active' AND archived_at IS NULL
    `) as Array<{ count: number }>
    const report = buildLegacyOfferingBackfillReport({
      resources, programs,
      activeBusinessCalendarCount: Number(calendarRows[0]?.count ?? 0),
      generatedAt: new Date().toISOString(),
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
