import { describe, expect, it } from "vitest"

import { ProgramOfferingCore1788122800000 } from "./1788122800000-program-offering-core.js"

describe("ProgramOfferingCore migration", () => {
  it("adds typed quote pins and a same-offering approved occurrence override guard", async () => {
    const statements: string[] = []
    await new ProgramOfferingCore1788122800000().up({ query: async (sql: string) => { statements.push(sql); return [] } } as never)
    const sql = statements.join("\n")
    expect(sql).toContain("quote_type IN ('stay_preview','template_preview','program_registration')")
    expect(sql).toContain("quote_type IN ('template_preview','program_registration')")
    expect(sql).toContain("binding.program_template_id = NEW.template_id")
    expect(sql).toContain("book.state IN ('active','scheduled')")
    expect(sql).toContain("CREATE UNIQUE INDEX offering_bindings_one_live_program_primary_idx")
    expect(sql).toContain("WHERE role = 'primary' AND program_template_id IS NOT NULL AND archived_at IS NULL")
    expect(sql).toContain("offering_kind NOT IN ('house','campground','addon','program')")
    expect(sql).toContain("offering_kind = 'program' AND node_kind <> 'program_detail'")
    expect(sql).not.toContain("program_registrations ADD")
  })

  it("removes the live primary ProgramTemplate uniqueness guard on rollback", async () => {
    const statements: string[] = []
    await new ProgramOfferingCore1788122800000().down({ query: async (sql: string) => { statements.push(sql); return [] } } as never)
    const sql = statements.join("\n")
    expect(sql).toContain("DROP INDEX IF EXISTS offering_bindings_one_live_program_primary_idx")
    expect(sql).toContain("offering_kind NOT IN ('house','campground','addon')")
    expect(sql).not.toContain("offering_kind NOT IN ('house','campground','addon','program')")
    expect(sql).not.toContain("offering_kind = 'program' AND node_kind <> 'program_detail'")
  })
})
