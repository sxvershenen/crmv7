import "reflect-metadata"
import { randomUUID } from "node:crypto"
import { DataSource } from "typeorm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { CapabilityNameSchema, EventOrderQuoteResultSchema, type SessionUser } from "@crm/contracts"
import { databaseEntities, databaseMigrations, assertSafeTestDatabaseConnection, assertSafeTestDatabaseEnvironment, EventEntity, OfferingQuoteSnapshotEntity } from "@crm/db"
import { OperationalQuoteAcceptanceService } from "../src/offerings/operational-quote-acceptance.service.js"
import { ResourcesService } from "../src/resources/resources.service.js"

describe.sequential("Event order transaction and PostgreSQL guards", () => {
  let db: DataSource
  let actor: SessionUser
  const acceptance = new OperationalQuoteAcceptanceService()
  beforeAll(async () => {
    const target = assertSafeTestDatabaseEnvironment(process.env)
    db = await new DataSource({ type: "postgres", url: target.url, entities: databaseEntities, migrations: databaseMigrations }).initialize()
    await assertSafeTestDatabaseConnection(db, target)
    await db.runMigrations()
    actor = { id: randomUUID(), name: "Event test", role: "admin", capabilities: Object.fromEntries(CapabilityNameSchema.options.map((key) => [key, true])) as SessionUser["capabilities"] }
    await db.query("INSERT INTO users(id,email,display_name,password_hash,role) VALUES($1,$2,'Event test','unused','admin')", [actor.id, `${actor.id}@example.test`])
    await db.query(`CREATE OR REPLACE FUNCTION test_event_order_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF current_setting('test.event_fault',true) = TG_TABLE_NAME THEN RAISE EXCEPTION 'event fault injection'; END IF; RETURN NEW; END $$`)
    for (const table of ["accepted_offering_quote_links", "resource_allocations", "outbox_events"]) {
      await db.query(`CREATE TRIGGER test_event_order_fault AFTER INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION test_event_order_fault()`)
    }
  })
  afterAll(async () => {
    if (!db?.isInitialized) return
    for (const table of ["accepted_offering_quote_links", "resource_allocations", "outbox_events"]) await db.query(`DROP TRIGGER IF EXISTS test_event_order_fault ON ${table}`)
    await db.query("DROP FUNCTION IF EXISTS test_event_order_fault()")
    await db.destroy()
  })

  async function fixture(resourceId?: string, ttlMs = 60_000) {
    const id = randomUUID(), offeringId = randomUUID(), templateId = randomUUID(), bindingId = randomUUID(), calendarId = randomUUID(), dateId = randomUUID(), priceBookId = randomUUID(), rateId = randomUUID(), quoteId = randomUUID()
    const date = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    const startsAt = `${date}T12:00:00.000Z`, endsAt = `${date}T16:00:00.000Z`
    const resource = resourceId ?? randomUUID()
    if (!resourceId) await db.query("INSERT INTO resources(id,code,kind,name,capacity_mode,capacity_total) VALUES($1::uuid,$1::text,'venue','Hall','fixed',100)", [resource])
    await db.query("INSERT INTO business_calendars(id,code,name,source_version,state,imported_at,coverage_from,coverage_to_exclusive,content_hash) VALUES($1::uuid,$1::text,'Test','test-v1','draft',now(),$2::date,$2::date+1,repeat('a',64))", [calendarId, date])
    await db.query("INSERT INTO business_calendar_dates(id,calendar_id,local_date,official_class,source_version) VALUES($1,$2,$3,'weekday','test-v1')", [dateId, calendarId, date])
    await db.query("UPDATE business_calendars SET state='active' WHERE id=$1", [calendarId])
    await db.query("INSERT INTO event_service_templates(id,code,format,default_duration_minutes,preparation_before_minutes,preparation_after_minutes) VALUES($1::uuid,$1::text,'wedding',240,60,30)", [templateId])
    await db.query("INSERT INTO catalog_offerings(id,code,kind,operational_name,state,business_calendar_id) VALUES($1::uuid,$1::text,'event_service','Wedding','active',$2)", [offeringId, calendarId])
    await db.query("INSERT INTO offering_bindings(id,offering_id,role,event_service_template_id) VALUES($1,$2,'primary',$3)", [bindingId, offeringId, templateId])
    await db.query("INSERT INTO price_books(id,offering_id,revision,name,state,valid_from,activated_at) VALUES($1,$2,1,'Package','draft',$3,NULL)", [priceBookId, offeringId, date])
    await db.query("INSERT INTO rate_plans(id,price_book_id,rate_key,label,pricing_basis,base_amount_minor,quantity_metric,included_quantity) VALUES($1,$2,'standard','Standard','flat_package',10000,'guests',20)", [rateId, priceBookId])
    await db.query("UPDATE price_books SET state='active',activated_at=now(),version=version+1 WHERE id=$1", [priceBookId])
    await db.query("UPDATE catalog_offerings SET active_price_book_id=$2 WHERE id=$1", [offeringId, priceBookId])
    const selections = [{ resourceId: resource }]
    await db.query("INSERT INTO events(id,code,name,starts_at,ends_at,guest_count,status,pricing_mode,commercial_offering_id,rate_plan_key,resource_selections) VALUES($1::uuid,$1::text,'Customer',$2,$3,20,'planning','quote_required',$4,'standard',$5)", [id, startsAt, endsAt, offeringId, JSON.stringify(selections)])
    const [resourceRow] = await db.query("SELECT version FROM resources WHERE id=$1", [resource]) as Array<{ version: number }>
    const resourcePins = [{ resourceId: resource, version: resourceRow!.version }]
    const calculatedAt = new Date(), validUntil = new Date(calculatedAt.getTime() + ttlMs)
    const result = EventOrderQuoteResultSchema.parse({
      quoteType: "event_order", acceptanceReady: true, quoteId, offeringId, eventServiceTemplateId: templateId, eventId: id, eventVersion: 1,
      calculatedAt: calculatedAt.toISOString(), validUntil: validUntil.toISOString(), leadDays: null, currency: "RUB",
      inputs: { startsAt, endsAt, serviceDate: date, durationMinutes: 240, guests: 20, timezone: "Europe/Moscow", ratePlanKey: "standard", addOns: [], resourceSelections: selections },
      lines: [{ kind: "base", label: "Standard", serviceDate: date, quantity: 1, unitAmount: { amountMinor: 10000, currency: "RUB" }, amount: { amountMinor: 10000, currency: "RUB" }, ratePlanId: rateId, ratePlanVersion: 1, matchedRuleId: null, matchedRuleVersion: null, explanation: "Package" }],
      total: { amountMinor: 10000, currency: "RUB" }, immutableSnapshot: true,
      provenance: { offeringVersion: 1, subjectVersion: 1, eventServiceTemplateVersion: 1, offeringBindingId: bindingId, offeringBindingVersion: 1,
        pricingVersion: 1, addOnsVersion: 1, priceBookId, priceBookVersion: 2, businessCalendarId: calendarId, businessCalendarVersion: 1,
        businessCalendarSourceVersion: "test-v1", businessCalendarDateId: dateId, businessCalendarDateVersion: 1, businessCalendarDateOverrideId: null, businessCalendarDateOverrideVersion: null,
        preparationBeforeMinutes: 60, preparationAfterMinutes: 30, preparationStartsAt: `${date}T11:00:00.000Z`, preparationEndsAt: `${date}T16:30:00.000Z`, matchedRuleIds: [], addOns: [], resourceSelections: resourcePins },
    })
    const snapshot = db.manager.create(OfferingQuoteSnapshotEntity, {
      id: quoteId, quoteType: "event_order", offeringId, offeringVersion: 1, subjectVersion: 1, pricingVersion: 1, addOnAssignmentsVersion: 1,
      eventServiceTemplateId: templateId, eventServiceTemplateVersion: 1, offeringBindingId: bindingId, offeringBindingVersion: 1, programTemplateId: null, programTemplateVersion: null,
      priceBookId, priceBookVersion: 2, businessCalendarId: calendarId, businessCalendarVersion: 1, businessCalendarSourceVersion: "test-v1",
      requestPayload: { quoteType: "event_order", eventId: id, expectedEventVersion: 1, ratePlanKey: "standard", currency: "RUB", addOns: [], resourceSelections: selections },
      resultPayload: result, provenance: result.provenance, operationalContext: { kind: "event_order", eventId: id, eventVersion: 1, subjectVersion: 1, eventServiceTemplateId: templateId, eventServiceTemplateVersion: 1, offeringBindingId: bindingId, offeringBindingVersion: 1, resourcePins },
      calculatedAt, validUntil, operationId: randomUUID(), idempotencyKey: randomUUID(), requestId: randomUUID(), actorId: actor.id, entrySurface: "internal",
    })
    await db.manager.save(snapshot)
    return { id, quoteId, offeringId, resource, result, snapshot, templateId }
  }
  async function confirm(f: Awaited<ReturnType<typeof fixture>>, fault: string | null = null) {
    return db.transaction(async (manager) => {
      const event = await manager.findOneOrFail(EventEntity, { where: { id: f.id }, lock: { mode: "pessimistic_write" } })
      const prepared = await acceptance.prepareEventOrder(manager, event, f.quoteId)
      await manager.query("UPDATE events SET status='booked',version=version+1,total_amount=$2,accepted_quote=$3 WHERE id=$1", [event.id, prepared.result.total.amountMinor, JSON.stringify(prepared.result)])
      if (fault === "status") throw new Error("event fault injection")
      if (fault) await manager.query("SELECT set_config('test.event_fault',$1,true)", [fault])
      const saved = await manager.findOneByOrFail(EventEntity, { id: event.id })
      await acceptance.recordEventOrder(manager, saved, prepared, actor, "event-test", randomUUID())
      return saved
    })
  }
  it("atomically accepts and preserves the snapshot after catalog edits; rejects commercial mutation", async () => {
    const f = await fixture()
    await confirm(f)
    expect(await db.query("SELECT status,total_amount FROM events WHERE id=$1", [f.id])).toEqual([{ status: "booked", total_amount: 10000 }])
    expect((await db.query("SELECT id FROM resource_allocations WHERE source_id=$1 AND status='active'", [f.id])).length).toBe(1)
    await db.query("UPDATE event_service_templates SET version=version+1 WHERE id=$1", [f.templateId])
    expect((await db.manager.findOneByOrFail(EventEntity, { id: f.id })).acceptedQuote).toEqual(f.result)
    await expect(db.query("UPDATE events SET guest_count=21 WHERE id=$1", [f.id])).rejects.toMatchObject({ driverError: { code: "55000" } })
    await expect(db.query("UPDATE offering_quote_snapshots SET valid_until=valid_until+interval '1 hour' WHERE id=$1", [f.quoteId])).rejects.toMatchObject({ driverError: { code: "55000" } })
    await expect(db.query("DELETE FROM resource_allocations WHERE source_id=$1", [f.id])).rejects.toMatchObject({ driverError: { code: "23514" } })
    await expect(db.query("UPDATE resource_allocations SET source_type='resource_block' WHERE source_id=$1", [f.id])).rejects.toMatchObject({ driverError: { code: "23514" } })
  })
  it("rejects direct booked without acceptance and wrong/missing snapshot pins", async () => {
    const f = await fixture()
    await expect(db.query("UPDATE events SET status='booked' WHERE id=$1", [f.id])).rejects.toMatchObject({ driverError: { code: "23514" } })
    const invalid = { ...f.snapshot, id: randomUUID(), eventServiceTemplateVersion: null }
    await expect(db.manager.save(db.manager.create(OfferingQuoteSnapshotEntity, invalid))).rejects.toMatchObject({ driverError: { code: "23514" } })
  })
  it("never accepts an event-service preview and safely refuses core rollback with snapshots", async () => {
    const f = await fixture(), previewId = randomUUID()
    await db.manager.save(db.manager.create(OfferingQuoteSnapshotEntity, { ...f.snapshot, id: previewId, quoteType: "event_service_preview", operationalContext: null,
      requestPayload: { ...f.snapshot.requestPayload, quoteType: "event_service_preview", offeringId: f.offeringId, eventServiceTemplateId: f.templateId },
      resultPayload: { ...f.result, quoteId: previewId, quoteType: "event_service_preview", acceptanceReady: false },
    }))
    const event = await db.manager.findOneByOrFail(EventEntity, { id: f.id })
    await expect(db.transaction((manager) => acceptance.prepareEventOrder(manager, event, previewId))).rejects.toMatchObject({ response: { code: "QUOTE_NOT_ACCEPTANCE_READY" } })
    const Core = databaseMigrations.find((migration) => migration.name === "EventServiceOfferingCore1788123600000")!
    const runner = db.createQueryRunner()
    try { await expect(new Core().down(runner)).rejects.toThrow("rollback is unsafe") } finally { await runner.release() }
    expect(await db.query("SELECT id FROM offering_quote_snapshots WHERE id=$1", [previewId])).toHaveLength(1)
  })
  it.each(["status", "accepted_offering_quote_links", "resource_allocations", "outbox_events"])("rolls back all effects after a fault at %s", async (fault) => {
    const f = await fixture()
    await expect(confirm(f, fault)).rejects.toThrow("event fault injection")
    expect((await db.manager.findOneByOrFail(EventEntity, { id: f.id })).status).toBe("planning")
    for (const table of ["accepted_offering_quote_links", "resource_allocations", "outbox_events"]) {
      const column = table === "accepted_offering_quote_links" ? "event_id" : table === "resource_allocations" ? "source_id" : "aggregate_id"
      expect(await db.query(`SELECT id FROM ${table} WHERE ${column}=$1`, [f.id])).toHaveLength(0)
    }
  })
  it("rejects a quote belonging to another Event and duplicate acceptance", async () => {
    const first = await fixture(), second = await fixture()
    await expect(db.transaction(async (manager) => {
      await manager.query("UPDATE events SET status='booked',version=2,total_amount=10000,accepted_quote=$2 WHERE id=$1", [second.id, JSON.stringify(first.result)])
      await manager.query("INSERT INTO accepted_offering_quote_links(id,quote_snapshot_id,event_id,target_version,operation_id,request_id) VALUES($1,$2,$3,2,$4,'wrong-event')", [randomUUID(), first.quoteId, second.id, randomUUID()])
    })).rejects.toMatchObject({ driverError: { code: "23514" } })
    await confirm(first)
    await expect(db.query("INSERT INTO accepted_offering_quote_links(id,quote_snapshot_id,event_id,target_version,operation_id,request_id) VALUES($1,$2,$3,2,$4,'duplicate')", [randomUUID(), first.quoteId, first.id, randomUUID()])).rejects.toThrow()
  })
  it("failed replacement retains the original allocation", async () => {
    const f = await fixture(), previousResource = randomUUID(), previousAllocation = randomUUID()
    await db.query("INSERT INTO resources(id,code,kind,name,capacity_mode,capacity_total) VALUES($1::uuid,$1::text,'venue','Old hall','fixed',100)", [previousResource])
    await db.query("INSERT INTO resource_allocations(id,resource_id,source_type,source_id,start_at,end_at,quantity,capacity_impact,status,exclusive) VALUES($1,$2,'event',$3,$4,$5,1,1,'active',true)", [previousAllocation, previousResource, f.id, f.result.inputs.startsAt, f.result.inputs.endsAt])
    await db.query("INSERT INTO resource_allocations(id,resource_id,source_type,source_id,start_at,end_at,quantity,capacity_impact,status,exclusive) VALUES($1,$2,'resource_block',$3,$4,$5,1,1,'active',true)", [randomUUID(), f.resource, randomUUID(), f.result.inputs.startsAt, f.result.inputs.endsAt])
    await expect(confirm(f)).rejects.toThrow()
    expect(await db.query("SELECT status,archived_at FROM resource_allocations WHERE id=$1", [previousAllocation])).toEqual([{ status: "active", archived_at: null }])
    expect((await db.manager.findOneByOrFail(EventEntity, { id: f.id })).status).toBe("planning")
    expect(await db.query("SELECT id FROM accepted_offering_quote_links WHERE event_id=$1", [f.id])).toHaveLength(0)
  })
  it("allows only one simultaneous confirmation of the same Event", async () => {
    const f = await fixture()
    const results = await Promise.allSettled([confirm(f), confirm(f)])
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    expect(await db.query("SELECT id FROM accepted_offering_quote_links WHERE event_id=$1", [f.id])).toHaveLength(1)
  })
  it("different categories compete for the same physical resource", async () => {
    const first = await fixture(), second = await fixture(first.resource)
    const results = await Promise.allSettled([confirm(first), confirm(second)])
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    expect(await db.query("SELECT id FROM resource_allocations WHERE resource_id=$1 AND status='active'", [first.resource])).toHaveLength(1)
  })
  it("evaluates expiry after waiting for a catalog lock", async () => {
    const f = await fixture(undefined, 350)
    const locker = db.createQueryRunner()
    await locker.connect(); await locker.startTransaction()
    await locker.query("SELECT id FROM catalog_offerings WHERE id=$1 FOR UPDATE", [f.offeringId])
    const pending = confirm(f).then(() => null, (error: unknown) => error)
    await locker.query("SELECT pg_sleep(0.5)")
    await locker.commitTransaction(); await locker.release()
    expect(await pending).toMatchObject({ response: { code: "QUOTE_EXPIRED" } })
    expect((await db.manager.findOneByOrFail(EventEntity, { id: f.id })).status).toBe("planning")
  })
  it.each(["template", "pricing", "assignments"] as const)("rejects a concurrent %s version change before acceptance", async (kind) => {
    const f = await fixture(), locker = db.createQueryRunner()
    await locker.connect(); await locker.startTransaction()
    const sql = kind === "template" ? "UPDATE event_service_templates SET version=version+1 WHERE id=$1"
      : kind === "pricing" ? "UPDATE catalog_offerings SET pricing_version=pricing_version+1 WHERE id=$1"
        : "UPDATE catalog_offerings SET addon_assignments_version=addon_assignments_version+1 WHERE id=$1"
    await locker.query(sql, [kind === "template" ? f.templateId : f.offeringId])
    const pending = confirm(f).then(() => null, (error: unknown) => error)
    await locker.query("SELECT pg_sleep(0.05)")
    await locker.commitTransaction(); await locker.release()
    expect(await pending).toMatchObject({ response: { code: "QUOTE_CONTEXT_MISMATCH" } })
    expect((await db.manager.findOneByOrFail(EventEntity, { id: f.id })).status).toBe("planning")
  })
  it("cancellation releases resources while retaining accepted facts", async () => {
    const f = await fixture(); await confirm(f)
    await db.transaction(async (manager) => {
      const event = await manager.findOneOrFail(EventEntity, { where: { id: f.id }, lock: { mode: "pessimistic_write" } })
      await manager.query("UPDATE events SET status='cancelled',version=version+1 WHERE id=$1", [f.id])
      await acceptance.releaseEventResources(manager, event, actor, "cancel-test")
    })
    expect(await db.query("SELECT id FROM resource_allocations WHERE source_id=$1 AND status='active'", [f.id])).toHaveLength(0)
    expect(await db.query("SELECT id FROM accepted_offering_quote_links WHERE event_id=$1", [f.id])).toHaveLength(1)
  })
  it("legacy replacement is atomic, versioned and replayable", async () => {
    const f = await fixture(), legacyId = randomUUID(), blockedResource = randomUUID()
    await db.query("INSERT INTO events(id,code,name,starts_at,ends_at) VALUES($1::uuid,$1::text,'Legacy',$2,$3)", [legacyId, f.result.inputs.startsAt, f.result.inputs.endsAt])
    await db.query("INSERT INTO resources(id,code,kind,name,capacity_mode,capacity_total) VALUES($1::uuid,$1::text,'venue','Busy hall','fixed',100)", [blockedResource])
    await db.query("INSERT INTO resource_allocations(id,resource_id,source_type,source_id,start_at,end_at,quantity,capacity_impact,status,exclusive) VALUES($1,$2,'resource_block',$3,$4,$5,1,1,'active',true)", [randomUUID(), blockedResource, randomUUID(), f.result.inputs.startsAt, f.result.inputs.endsAt])
    const service = new ResourcesService(db)
    const allocation = { resourceId: f.resource, startAt: f.result.inputs.startsAt, endAt: f.result.inputs.endsAt, quantity: 1, capacityImpact: 1 }
    const command = { eventId: legacyId, expectedEventVersion: 1, allocations: [allocation], operationId: randomUUID(), idempotencyKey: randomUUID() }
    const first = await service.replaceEventAllocations(command, actor, "legacy-test")
    expect(await service.replaceEventAllocations(command, actor, "lost-response-retry")).toEqual(first)
    expect((await db.manager.findOneByOrFail(EventEntity, { id: legacyId })).version).toBe(2)
    const before = await db.query("SELECT id,status,archived_at FROM resource_allocations WHERE source_id=$1", [legacyId])
    await expect(service.replaceEventAllocations({ ...command, expectedEventVersion: 2, allocations: [{ ...allocation, resourceId: blockedResource }], operationId: randomUUID(), idempotencyKey: randomUUID() }, actor, "replace-failure")).rejects.toThrow()
    expect(await db.query("SELECT id,status,archived_at FROM resource_allocations WHERE source_id=$1", [legacyId])).toEqual(before)
    expect((await db.manager.findOneByOrFail(EventEntity, { id: legacyId })).version).toBe(2)
    await expect(service.replaceEventAllocations({ ...command, allocations: [] }, actor, "changed-payload")).rejects.toMatchObject({ response: { code: "IDEMPOTENCY_CONFLICT" } })
  })
})
