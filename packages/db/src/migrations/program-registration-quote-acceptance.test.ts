import { describe, expect, it } from "vitest"

import { ProgramRegistrationQuoteAcceptance1788123200000 } from "./1788123200000-program-registration-quote-acceptance.js"

describe("ProgramRegistrationQuoteAcceptance migration", () => {
  it("preserves the booking guard and adds occurrence, capacity and immutable acceptance guards", async () => {
    const statements: string[] = []
    await new ProgramRegistrationQuoteAcceptance1788123200000().up({ query: async (sql: string) => { statements.push(sql); return [] } } as never)
    const sql = statements.join("\n")
    expect(sql).toContain("RENAME TO guard_booking_quote_link_insert")
    expect(sql).toContain("accepted_offering_quote_links_booking_guard")
    expect(sql).toContain("accepted_offering_quote_links_program_guard")
    expect(sql).toContain("snapshot_row.quote_type = 'program_registration'")
    expect(sql).toContain("(snapshot_row.result_payload#>>'{inputs,startsAt}')::timestamptz = occurrence_row.starts_at")
    expect(sql).toContain("program_registrations_capacity_guard")
    expect(sql).toContain("id <> NEW.id")
    expect(sql).toContain("program_occurrences_capacity_limits_guard")
    expect(sql).toContain("program_registrations_accepted_quote_immutable_guard")
  })

  it("keeps downgrade possible after program snapshots without deleting them", async () => {
    const statements: string[] = []
    await new ProgramRegistrationQuoteAcceptance1788123200000().down({ query: async (sql: string) => { statements.push(sql); return [] } } as never)
    expect(statements.join("\n")).toContain("offering_quote_snapshots_operational_context_check CHECK")
    expect(statements.join("\n")).toContain("NOT VALID")
  })
})
