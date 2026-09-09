import { describe, expect, it } from "vitest"

import { EventServiceOfferingCore1788123600000 } from "./1788123600000-event-service-offering-core.js"

describe("EventServiceOfferingCore migration", () => {
  it("adds event-service quote pins, exact primary uniqueness and event_detail CMS mapping", async () => {
    const statements: string[] = []
    await new EventServiceOfferingCore1788123600000().up({ query: async (sql: string) => { statements.push(sql); return [] } } as never)
    const sql = statements.join("\n")
    expect(sql).toContain("event_service_template_id uuid REFERENCES event_service_templates(id)")
    expect(sql).toContain("event_service_template_version integer")
    expect(sql).toContain("offering_binding_id uuid REFERENCES offering_bindings(id)")
    expect(sql).toContain("offering_binding_version integer")
    expect(sql).toContain("event_service_preview")
    expect(sql).toContain("offering_bindings_one_live_event_service_primary_idx")
    expect(sql).toContain("event_service primary binding must target an EventServiceTemplate")
    expect(sql).toContain("event_service catalog offering requires an exact primary EventServiceTemplate binding")
    expect(sql).toContain("guard_event_service_offering_binding")
    expect(sql).toContain("offering_quote_snapshots_event_service_immutable_guard")
    expect(sql).toContain("IF TG_OP = 'DELETE' THEN RETURN OLD")
    expect(sql).toContain("CREATE FUNCTION guard_event_service_quote_snapshot()")
    expect(sql).toContain("TG_OP = 'INSERT' AND NOT EXISTS")
    expect(sql).toContain("binding.version = NEW.offering_binding_version")
    expect(sql).toContain("offering.version = NEW.offering_version")
    expect(sql).toContain("template.version = NEW.event_service_template_version")
    expect(sql).toContain("NEW.result_payload->'acceptanceReady' <> 'false'::jsonb")
    expect(sql).toContain("NEW.program_template_id IS NOT NULL OR NEW.program_template_version IS NOT NULL")
    expect(sql).toContain("historical evidence")
    expect(sql).toContain("offering_kind = 'event_service' AND node_kind <> 'event_detail'")
    expect(sql).not.toContain("programTemplateId")
  })

  it("fails closed before dropping event pins or CMS links on rollback", async () => {
    const statements: string[] = []
    await expect(new EventServiceOfferingCore1788123600000().down({ query: async (sql: string) => {
      statements.push(sql)
      if (sql.includes("offering_quote_snapshots WHERE quote_type")) return [{ exists: true }]
      return []
    } } as never)).rejects.toThrow("unsafe")
    const sql = statements.join("\n")
    expect(sql).toContain("offering_quote_snapshots WHERE quote_type = 'event_service_preview'")
    expect(sql).not.toContain("DROP COLUMN IF EXISTS event_service_template_id")
  })

  it("restores the previous program/stay pin guard only when no event data remains", async () => {
    const statements: string[] = []
    await new EventServiceOfferingCore1788123600000().down({ query: async (sql: string) => { statements.push(sql); return [{ exists: false }] } } as never)
    const sql = statements.join("\n")
    expect(sql).toContain("DROP INDEX IF EXISTS offering_bindings_one_live_event_service_primary_idx")
    expect(sql).toContain("quote_type IN ('stay_preview','template_preview','program_registration')")
    expect(sql).toContain("ADD CONSTRAINT offering_quote_snapshots_program_pin_check")
    expect(sql).toContain("DROP COLUMN IF EXISTS event_service_template_id")
    expect(sql).toContain("DROP COLUMN IF EXISTS offering_binding_id")
    expect(sql).toContain("offering_kind NOT IN ('house','campground','addon','program')")
  })
})
