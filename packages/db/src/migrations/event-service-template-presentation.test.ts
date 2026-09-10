import { describe, expect, it } from "vitest"

import { EventServiceTemplatePresentation1788124000000 } from "./1788124000000-event-service-template-presentation.js"

describe("EventServiceTemplatePresentation migration", () => {
  it("adds allowlisted presentation fields with safe defaults", async () => {
    const statements: string[] = []
    await new EventServiceTemplatePresentation1788124000000().up({ query: async (sql: string) => { statements.push(sql); return [] } } as never)
    const sql = statements.join("\n")
    expect(sql).toContain("ADD COLUMN icon text NOT NULL DEFAULT 'heart'")
    expect(sql).toContain("ADD COLUMN tone text NOT NULL DEFAULT 'rose'")
    expect(sql).toContain("event_service_templates_icon_check")
    expect(sql).toContain("event_service_templates_tone_check")
  })

  it("rolls back only the additive presentation columns", async () => {
    const statements: string[] = []
    await new EventServiceTemplatePresentation1788124000000().down({ query: async (sql: string) => { statements.push(sql); return [] } } as never)
    const sql = statements.join("\n")
    expect(sql).toContain("DROP COLUMN IF EXISTS icon")
    expect(sql).toContain("DROP COLUMN IF EXISTS tone")
    expect(sql).not.toContain("DROP TABLE")
  })
})
