import "reflect-metadata"
import { loadEnvFile } from "node:process"
import { fileURLToPath } from "node:url"
import { assertDemoEnvironment, demoPreflight, DEMO_NAMESPACE, DEMO_PLAN, seedDemoWorkspace } from "./demo-workspace.js"

async function main() {
  try { loadEnvFile(fileURLToPath(new URL("../../../../.env", import.meta.url))) } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
  const arguments_ = process.argv.slice(2)
  if (arguments_.some((argument) => !["--check", "--apply"].includes(argument)) || arguments_.length > 1) throw new Error("Usage: seed:demo [--check | --apply]")
  assertDemoEnvironment(process.env)
  const { default: dataSource } = await import("@crm/db/data-source")
  try {
    await dataSource.initialize()
    const preflight = await demoPreflight(dataSource, process.env)
    if (arguments_[0] !== "--apply") {
      console.log(JSON.stringify({ status: "checked", namespace: DEMO_NAMESPACE, database: preflight.database, schemaAligned: true, plan: DEMO_PLAN, note: "No writes. Use --apply to add the atomic scenario. Existing accounts/calendar/settings remain unchanged." }, null, 2))
      return
    }
    const result = await seedDemoWorkspace(dataSource, process.env)
    console.log(JSON.stringify({ status: result.status, namespace: result.report.namespace, anchorDate: result.report.anchorDate, counts: result.report.counts }, null, 2))
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy()
  }
}

main().catch((error: unknown) => {
  // PostgreSQL errors can carry SQL parameters; never dump credentials or contact payloads.
  console.error(error instanceof Error ? error.message : "Demo seed failed")
  process.exitCode = 1
})
