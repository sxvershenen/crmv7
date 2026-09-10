import type { MigrationInterface, QueryRunner } from "typeorm"

/** Customer orders are separate from editorial event-service categories. */
export class EventOrderAcceptance1788124400000 implements MigrationInterface {
  name = "EventOrderAcceptance1788124400000"

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE events
      ADD COLUMN pricing_mode text NOT NULL DEFAULT 'legacy_manual',
      ADD COLUMN commercial_offering_id uuid REFERENCES catalog_offerings(id) ON DELETE RESTRICT,
      ADD COLUMN rate_plan_key text,
      ADD COLUMN addon_selections jsonb NOT NULL DEFAULT '[]',
      ADD COLUMN resource_selections jsonb NOT NULL DEFAULT '[]',
      ADD COLUMN accepted_quote jsonb,
      ADD CONSTRAINT events_commercial_shape CHECK (
        (pricing_mode = 'legacy_manual' AND commercial_offering_id IS NULL AND rate_plan_key IS NULL AND addon_selections = '[]' AND resource_selections = '[]')
        OR (pricing_mode = 'quote_required' AND commercial_offering_id IS NOT NULL AND jsonb_typeof(addon_selections) = 'array' AND jsonb_typeof(resource_selections) = 'array'))`)
    // Preserve previous guards verbatim for every pre-existing quote kind.
    for (const name of ["offering_quote_snapshots_type_check", "offering_quote_snapshots_subject_pin_check", "offering_quote_snapshots_operational_context_check"]) {
      const rows = await runner.query(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'offering_quote_snapshots'::regclass AND conname = $1`, [name]) as Array<{ definition: string }>
      const expression = rows[0]!.definition.replace(/^CHECK\s*\(/, "").replace(/\)$/, "")
      await runner.query(`ALTER TABLE offering_quote_snapshots DROP CONSTRAINT ${name}, ADD CONSTRAINT ${name} CHECK (quote_type = 'event_order' OR (${expression}))`)
    }
    await runner.query(`ALTER TABLE offering_quote_snapshots ADD CONSTRAINT offering_quote_snapshots_event_order_shape CHECK (
      quote_type <> 'event_order' OR COALESCE(subject_version > 0 AND event_service_template_id IS NOT NULL
        AND event_service_template_version > 0 AND offering_binding_id IS NOT NULL AND offering_binding_version > 0
        AND program_template_id IS NULL AND program_template_version IS NULL
        AND operational_context->>'kind' = 'event_order'
        AND operational_context->>'eventVersion' ~ '^[1-9][0-9]*$'
        AND operational_context->>'eventId' ~ '^[0-9a-f-]{36}$', false))`)

    await runner.query(`CREATE FUNCTION guard_event_order_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE e events%ROWTYPE;
      BEGIN
        IF TG_OP <> 'INSERT' THEN
          IF OLD.quote_type = 'event_order' OR (TG_OP = 'UPDATE' AND NEW.quote_type = 'event_order') THEN
            RAISE EXCEPTION 'event order snapshots are immutable' USING ERRCODE = '55000';
          END IF;
          IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
          RETURN NEW;
        END IF;
        IF NEW.quote_type <> 'event_order' THEN RETURN NEW; END IF;
        SELECT * INTO e FROM events WHERE id = (NEW.operational_context->>'eventId')::uuid FOR SHARE;
        IF NOT COALESCE(e.pricing_mode = 'quote_required' AND e.status IN ('inquiry','planning') AND e.archived_at IS NULL
          AND NEW.offering_id = e.commercial_offering_id
          AND NEW.operational_context->>'eventVersion' = e.version::text
          AND NEW.operational_context->>'subjectVersion' = NEW.subject_version::text
          AND NEW.operational_context->>'eventServiceTemplateId' = NEW.event_service_template_id::text
          AND NEW.operational_context->>'eventServiceTemplateVersion' = NEW.event_service_template_version::text
          AND NEW.operational_context->>'offeringBindingId' = NEW.offering_binding_id::text
          AND NEW.operational_context->>'offeringBindingVersion' = NEW.offering_binding_version::text
          AND NEW.request_payload->>'quoteType' = 'event_order'
          AND NEW.request_payload->>'expectedEventVersion' = e.version::text
          AND NEW.result_payload->>'quoteType' = 'event_order'
          AND NEW.result_payload->'acceptanceReady' = 'true'::jsonb
          AND NEW.result_payload->'immutableSnapshot' = 'true'::jsonb
          AND NEW.result_payload->>'eventId' = e.id::text AND NEW.result_payload->>'eventVersion' = e.version::text
          AND NEW.result_payload->>'quoteId' = NEW.id::text AND NEW.result_payload->>'offeringId' = NEW.offering_id::text
          AND NEW.result_payload->>'eventServiceTemplateId' = NEW.event_service_template_id::text
          AND NEW.result_payload#>>'{inputs,guests}' = e.guest_count::text
          AND (NEW.result_payload#>>'{inputs,startsAt}')::timestamptz = e.starts_at
          AND (NEW.result_payload#>>'{inputs,endsAt}')::timestamptz = e.ends_at
          AND NEW.result_payload#>>'{inputs,ratePlanKey}' = e.rate_plan_key
          AND NEW.result_payload#>'{inputs,addOns}' = e.addon_selections
          AND NEW.result_payload#>'{inputs,resourceSelections}' = e.resource_selections
          AND NEW.result_payload->>'currency' = e.currency
          AND NEW.result_payload#>>'{total,currency}' = e.currency
          AND NEW.result_payload->'provenance' = NEW.provenance
          AND NEW.provenance->>'offeringVersion' = NEW.offering_version::text
          AND NEW.provenance->>'subjectVersion' = NEW.subject_version::text
          AND NEW.provenance->>'eventServiceTemplateVersion' = NEW.event_service_template_version::text
          AND NEW.provenance->>'offeringBindingId' = NEW.offering_binding_id::text
          AND NEW.provenance->>'offeringBindingVersion' = NEW.offering_binding_version::text
          AND NEW.provenance->>'pricingVersion' = NEW.pricing_version::text
          AND NEW.provenance->>'addOnsVersion' = NEW.addon_assignments_version::text
          AND NEW.provenance->>'priceBookId' = NEW.price_book_id::text
          AND NEW.provenance->>'priceBookVersion' = NEW.price_book_version::text
          AND NEW.provenance->>'businessCalendarId' = NEW.business_calendar_id::text
          AND NEW.provenance->>'businessCalendarVersion' = NEW.business_calendar_version::text
          AND NEW.provenance->>'businessCalendarSourceVersion' = NEW.business_calendar_source_version
          AND jsonb_typeof(NEW.provenance->'addOns') = 'array'
          AND jsonb_typeof(NEW.operational_context->'resourcePins') = 'array'
          AND jsonb_array_length(NEW.operational_context->'resourcePins') = jsonb_array_length(e.resource_selections)
          AND (SELECT count(DISTINCT value->>'resourceId') FROM jsonb_array_elements(NEW.operational_context->'resourcePins')) = jsonb_array_length(e.resource_selections)
          AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(e.resource_selections) selected WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.operational_context->'resourcePins') pin WHERE pin->>'resourceId' = selected->>'resourceId'))
          AND NEW.request_payload->'addOns' = e.addon_selections AND NEW.request_payload->'resourceSelections' = e.resource_selections
          AND NEW.request_payload->>'eventId' = e.id::text AND NEW.request_payload->>'ratePlanKey' = e.rate_plan_key, false)
        THEN RAISE EXCEPTION 'event order snapshot pins or composition mismatch' USING ERRCODE = '23514'; END IF;
        RETURN NEW;
      END $$`)
    await runner.query(`CREATE TRIGGER offering_quote_snapshots_event_order_guard BEFORE INSERT OR UPDATE OR DELETE ON offering_quote_snapshots FOR EACH ROW EXECUTE FUNCTION guard_event_order_snapshot()`)

    await runner.query(`CREATE FUNCTION assert_event_order_quote_current(quote_id uuid) RETURNS void LANGUAGE plpgsql AS $$
      DECLARE q offering_quote_snapshots%ROWTYPE; o catalog_offerings%ROWTYPE; b offering_bindings%ROWTYPE;
        t event_service_templates%ROWTYPE; book price_books%ROWTYPE; cal business_calendars%ROWTYPE;
        addon jsonb; line jsonb; pin jsonb; acceptance_clock timestamptz;
      BEGIN
        SELECT * INTO q FROM offering_quote_snapshots WHERE id = quote_id FOR SHARE;
        IF q.id IS NULL OR q.quote_type <> 'event_order' THEN RAISE EXCEPTION 'event order quote required' USING ERRCODE = '23514'; END IF;
        PERFORM 1 FROM catalog_offerings WHERE id = q.offering_id OR id IN (SELECT (value->>'addOnOfferingId')::uuid FROM jsonb_array_elements(q.provenance->'addOns')) ORDER BY id FOR SHARE;
        SELECT * INTO o FROM catalog_offerings WHERE id = q.offering_id;
        SELECT * INTO b FROM offering_bindings WHERE id = q.offering_binding_id FOR SHARE;
        SELECT * INTO t FROM event_service_templates WHERE id = q.event_service_template_id FOR SHARE;
        PERFORM 1 FROM price_books WHERE id = q.price_book_id OR id IN (SELECT (value->>'priceBookId')::uuid FROM jsonb_array_elements(q.provenance->'addOns')) ORDER BY id FOR SHARE;
        PERFORM 1 FROM business_calendars WHERE id = q.business_calendar_id OR id IN (SELECT (value->>'businessCalendarId')::uuid FROM jsonb_array_elements(q.provenance->'addOns')) ORDER BY id FOR SHARE;
        PERFORM 1 FROM offering_addon_assignments WHERE offering_id = q.offering_id ORDER BY id FOR SHARE;
        PERFORM 1 FROM resources WHERE id IN (SELECT (value->>'resourceId')::uuid FROM jsonb_array_elements(q.operational_context->'resourcePins'))
          OR id IN (SELECT resource_id FROM resource_allocations WHERE source_type = 'event' AND source_id = (q.operational_context->>'eventId')::uuid AND archived_at IS NULL AND status IN ('active','tentative')) ORDER BY id FOR UPDATE;
        SELECT * INTO book FROM price_books WHERE id = q.price_book_id;
        SELECT * INTO cal FROM business_calendars WHERE id = q.business_calendar_id;
        IF NOT COALESCE(o.kind = 'event_service' AND o.state = 'active' AND o.archived_at IS NULL
          AND o.version = q.offering_version AND o.subject_version = q.subject_version AND o.pricing_version = q.pricing_version
          AND o.addon_assignments_version = q.addon_assignments_version AND o.active_price_book_id = q.price_book_id
          AND b.offering_id = o.id AND b.role = 'primary' AND b.archived_at IS NULL AND b.version = q.offering_binding_version
          AND b.event_service_template_id = t.id AND t.archived_at IS NULL AND t.version = q.event_service_template_version
          AND book.offering_id = o.id AND book.version = q.price_book_version AND book.state = 'active' AND book.archived_at IS NULL
          AND cal.id = o.business_calendar_id AND cal.version = q.business_calendar_version AND cal.state = 'active' AND cal.archived_at IS NULL
          AND cal.source_version = q.business_calendar_source_version
          AND (q.provenance->>'preparationStartsAt')::timestamptz = (q.result_payload#>>'{inputs,startsAt}')::timestamptz - make_interval(mins => t.preparation_before_minutes)
          AND (q.provenance->>'preparationEndsAt')::timestamptz = (q.result_payload#>>'{inputs,endsAt}')::timestamptz + make_interval(mins => t.preparation_after_minutes), false)
        THEN RAISE EXCEPTION 'event quote context changed' USING ERRCODE = '23514'; END IF;
        PERFORM 1 FROM business_calendar_dates WHERE id = (q.provenance->>'businessCalendarDateId')::uuid FOR SHARE;
        IF NOT EXISTS (SELECT 1 FROM business_calendar_dates WHERE id = (q.provenance->>'businessCalendarDateId')::uuid AND version::text = q.provenance->>'businessCalendarDateVersion' AND calendar_id = cal.id AND archived_at IS NULL)
          OR EXISTS (SELECT 1 FROM business_calendar_date_overrides WHERE calendar_id = cal.id AND local_date::text = q.result_payload#>>'{inputs,serviceDate}' AND state = 'active' AND archived_at IS NULL AND (id::text IS DISTINCT FROM q.provenance->>'businessCalendarDateOverrideId' OR version::text IS DISTINCT FROM q.provenance->>'businessCalendarDateOverrideVersion'))
          OR (q.provenance->>'businessCalendarDateOverrideId' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM business_calendar_date_overrides WHERE id::text = q.provenance->>'businessCalendarDateOverrideId' AND state = 'active' AND archived_at IS NULL))
        THEN RAISE EXCEPTION 'event quote calendar changed' USING ERRCODE = '23514'; END IF;
        FOR addon IN SELECT value FROM jsonb_array_elements(q.provenance->'addOns') LOOP
          IF NOT EXISTS (SELECT 1 FROM offering_addon_assignments a JOIN catalog_offerings ao ON ao.id = a.addon_offering_id JOIN price_books p ON p.id = ao.active_price_book_id JOIN business_calendars c ON c.id = ao.business_calendar_id
            WHERE a.id::text = addon->>'assignmentId' AND a.version::text = addon->>'assignmentVersion' AND a.offering_id = o.id AND a.enabled AND a.archived_at IS NULL
              AND ao.id::text = addon->>'addOnOfferingId' AND ao.version::text = addon->>'offeringVersion' AND ao.pricing_version::text = addon->>'pricingVersion' AND ao.state = 'active' AND ao.archived_at IS NULL
              AND p.id::text = addon->>'priceBookId' AND p.version::text = addon->>'priceBookVersion' AND p.state = 'active' AND p.archived_at IS NULL
              AND c.id::text = addon->>'businessCalendarId' AND c.version::text = addon->>'businessCalendarVersion' AND c.state = 'active' AND c.archived_at IS NULL)
          THEN RAISE EXCEPTION 'event quote addon changed' USING ERRCODE = '23514'; END IF;
        END LOOP;
        FOR line IN SELECT value FROM jsonb_array_elements(q.result_payload->'lines') LOOP
          PERFORM 1 FROM rate_plans WHERE id = (line->>'ratePlanId')::uuid FOR SHARE;
          IF NOT EXISTS (SELECT 1 FROM rate_plans WHERE id = (line->>'ratePlanId')::uuid AND version::text = line->>'ratePlanVersion' AND archived_at IS NULL)
          THEN RAISE EXCEPTION 'event quote rate changed' USING ERRCODE = '23514'; END IF;
          IF line->>'matchedRuleId' IS NOT NULL THEN
            PERFORM 1 FROM price_rules WHERE id = (line->>'matchedRuleId')::uuid FOR SHARE;
            IF NOT EXISTS (SELECT 1 FROM price_rules WHERE id = (line->>'matchedRuleId')::uuid AND version::text = line->>'matchedRuleVersion' AND enabled AND archived_at IS NULL)
            THEN RAISE EXCEPTION 'event quote rule changed' USING ERRCODE = '23514'; END IF;
          END IF;
        END LOOP;
        FOR pin IN SELECT value FROM jsonb_array_elements(q.operational_context->'resourcePins') LOOP
          IF NOT EXISTS (SELECT 1 FROM resources WHERE id::text = pin->>'resourceId' AND version::text = pin->>'version' AND capacity_mode = 'fixed' AND archived_at IS NULL)
          THEN RAISE EXCEPTION 'event resource context changed or unsupported' USING ERRCODE = '23514'; END IF;
        END LOOP;
        acceptance_clock := clock_timestamp();
        IF q.valid_until <= acceptance_clock OR EXISTS (SELECT 1 FROM price_books WHERE state = 'scheduled' AND archived_at IS NULL AND scheduled_activation_at <= acceptance_clock
          AND (offering_id = o.id OR offering_id IN (SELECT (value->>'addOnOfferingId')::uuid FROM jsonb_array_elements(q.provenance->'addOns'))))
        THEN RAISE EXCEPTION 'event quote expired' USING ERRCODE = '23514'; END IF;
      END $$`)

    await runner.query(`CREATE FUNCTION guard_event_order_acceptance() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE e events%ROWTYPE; q offering_quote_snapshots%ROWTYPE;
      BEGIN
        SELECT * INTO e FROM events WHERE id = NEW.event_id FOR UPDATE;
        PERFORM assert_event_order_quote_current(NEW.quote_snapshot_id);
        SELECT * INTO q FROM offering_quote_snapshots WHERE id = NEW.quote_snapshot_id;
        IF NOT COALESCE(e.pricing_mode = 'quote_required' AND e.status = 'booked' AND e.archived_at IS NULL
          AND e.version = NEW.target_version AND e.version = (q.operational_context->>'eventVersion')::integer + 1
          AND e.id::text = q.operational_context->>'eventId' AND e.commercial_offering_id = q.offering_id
          AND e.starts_at = (q.result_payload#>>'{inputs,startsAt}')::timestamptz AND e.ends_at = (q.result_payload#>>'{inputs,endsAt}')::timestamptz
          AND e.guest_count::text = q.result_payload#>>'{inputs,guests}' AND e.rate_plan_key = q.result_payload#>>'{inputs,ratePlanKey}'
          AND e.addon_selections = q.result_payload#>'{inputs,addOns}' AND e.resource_selections = q.result_payload#>'{inputs,resourceSelections}'
          AND e.total_amount::text = q.result_payload#>>'{total,amountMinor}' AND e.currency = q.result_payload#>>'{total,currency}' AND e.accepted_quote = q.result_payload, false)
        THEN RAISE EXCEPTION 'event quote does not match booked event' USING ERRCODE = '23514'; END IF;
        NEW.accepted_at := clock_timestamp(); NEW.created_at := NEW.accepted_at;
        RETURN NEW;
      END $$`)
    await runner.query(`CREATE FUNCTION guard_event_order_snapshot_current() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM assert_event_order_quote_current(NEW.id); RETURN NEW; END $$`)
    await runner.query(`CREATE TRIGGER offering_quote_snapshots_event_order_current_guard AFTER INSERT ON offering_quote_snapshots FOR EACH ROW WHEN (NEW.quote_type = 'event_order') EXECUTE FUNCTION guard_event_order_snapshot_current()`)
    await runner.query(`DROP TRIGGER accepted_offering_quote_links_event_guard ON accepted_offering_quote_links`)
    await runner.query(`CREATE TRIGGER accepted_offering_quote_links_event_guard BEFORE INSERT ON accepted_offering_quote_links FOR EACH ROW WHEN (NEW.event_id IS NOT NULL) EXECUTE FUNCTION guard_event_order_acceptance()`)
    await runner.query(`CREATE FUNCTION guard_event_order_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'INSERT' AND NEW.pricing_mode = 'quote_required' AND NEW.status NOT IN ('inquiry','planning') THEN
          RAISE EXCEPTION 'new commercial event must be a draft' USING ERRCODE = '23514';
        END IF;
        IF TG_OP = 'UPDATE' AND NEW.pricing_mode IS DISTINCT FROM OLD.pricing_mode THEN
          RAISE EXCEPTION 'event pricing mode is immutable' USING ERRCODE = '55000';
        END IF;
        IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM accepted_offering_quote_links WHERE event_id = OLD.id)
          AND (NEW.commercial_offering_id, NEW.rate_plan_key, NEW.addon_selections, NEW.resource_selections, NEW.starts_at, NEW.ends_at, NEW.guest_count, NEW.total_amount, NEW.currency, NEW.pricing_mode, NEW.accepted_quote)
            IS DISTINCT FROM (OLD.commercial_offering_id, OLD.rate_plan_key, OLD.addon_selections, OLD.resource_selections, OLD.starts_at, OLD.ends_at, OLD.guest_count, OLD.total_amount, OLD.currency, OLD.pricing_mode, OLD.accepted_quote)
        THEN RAISE EXCEPTION 'accepted event commercial facts are immutable' USING ERRCODE = '55000'; END IF;
        RETURN NEW;
      END $$`)
    await runner.query(`CREATE TRIGGER events_commercial_mutation_guard BEFORE INSERT OR UPDATE ON events FOR EACH ROW EXECUTE FUNCTION guard_event_order_mutation()`)
    await runner.query(`CREATE FUNCTION validate_event_order_final_state() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE target uuid; e events%ROWTYPE; q offering_quote_snapshots%ROWTYPE; selection jsonb;
      BEGIN
        IF TG_TABLE_NAME = 'events' THEN target := NEW.id;
        ELSIF TG_TABLE_NAME = 'accepted_offering_quote_links' THEN target := NEW.event_id;
        ELSE
          IF TG_OP = 'UPDATE' AND OLD.source_type = 'event'
            AND (NEW.source_type, NEW.source_id, NEW.resource_id) IS DISTINCT FROM (OLD.source_type, OLD.source_id, OLD.resource_id)
            AND EXISTS (SELECT 1 FROM accepted_offering_quote_links WHERE event_id = OLD.source_id)
          THEN RAISE EXCEPTION 'accepted event allocation identity is immutable' USING ERRCODE = '23514'; END IF;
          IF TG_OP = 'DELETE' THEN
            IF OLD.source_type <> 'event' THEN RETURN NULL; END IF; target := OLD.source_id;
          ELSE IF NEW.source_type <> 'event' THEN RETURN NULL; END IF; target := NEW.source_id; END IF;
        END IF;
        SELECT * INTO e FROM events WHERE id = target;
        IF e.pricing_mode IS DISTINCT FROM 'quote_required' THEN RETURN NULL; END IF;
        SELECT s.* INTO q FROM accepted_offering_quote_links l JOIN offering_quote_snapshots s ON s.id = l.quote_snapshot_id WHERE l.event_id = e.id;
        IF e.status IN ('booked','completed') AND q.id IS NULL THEN RAISE EXCEPTION 'priced event requires accepted quote' USING ERRCODE = '23514'; END IF;
        IF (q.id IS NULL AND e.accepted_quote IS NOT NULL) OR (q.id IS NOT NULL AND e.accepted_quote IS DISTINCT FROM q.result_payload) THEN RAISE EXCEPTION 'accepted event snapshot projection mismatch' USING ERRCODE = '23514'; END IF;
        IF e.status = 'booked' AND e.archived_at IS NOT NULL THEN RAISE EXCEPTION 'cancel booked event before archive' USING ERRCODE = '23514'; END IF;
        IF e.status = 'cancelled' AND EXISTS (SELECT 1 FROM resource_allocations WHERE source_type = 'event' AND source_id = e.id AND archived_at IS NULL AND status IN ('active','tentative'))
        THEN RAISE EXCEPTION 'cancelled event still reserves resources' USING ERRCODE = '23514'; END IF;
        IF e.status = 'booked' THEN
          FOR selection IN SELECT value FROM jsonb_array_elements(e.resource_selections) LOOP
            IF (SELECT count(*) FROM resource_allocations WHERE source_type = 'event' AND source_id = e.id AND resource_id::text = selection->>'resourceId'
              AND status = 'active' AND archived_at IS NULL AND exclusive AND quantity = 1 AND capacity_impact = 1
              AND start_at = (q.provenance->>'preparationStartsAt')::timestamptz AND end_at = (q.provenance->>'preparationEndsAt')::timestamptz) <> 1
            THEN RAISE EXCEPTION 'booked event missing exact resource allocation' USING ERRCODE = '23514'; END IF;
          END LOOP;
          IF EXISTS (SELECT 1 FROM resource_allocations a WHERE a.source_type = 'event' AND a.source_id = e.id AND a.status IN ('active','tentative') AND a.archived_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(e.resource_selections) s WHERE s->>'resourceId' = a.resource_id::text))
          THEN RAISE EXCEPTION 'booked event has unquoted resource allocation' USING ERRCODE = '23514'; END IF;
        END IF;
        RETURN NULL;
      END $$`)
    for (const table of ["events", "accepted_offering_quote_links", "resource_allocations"]) {
      await runner.query(`CREATE CONSTRAINT TRIGGER ${table}_event_order_final_guard AFTER INSERT OR UPDATE${table === "resource_allocations" ? " OR DELETE" : ""} ON ${table} DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_event_order_final_state()`)
    }
  }

  async down(runner: QueryRunner): Promise<void> {
    const rows = await runner.query(`SELECT EXISTS (SELECT 1 FROM events WHERE pricing_mode = 'quote_required') OR EXISTS (SELECT 1 FROM offering_quote_snapshots WHERE quote_type = 'event_order') AS unsafe`) as Array<{ unsafe: boolean }>
    if (rows[0]?.unsafe) throw new Error("Event order rollback is unsafe while commercial orders or snapshots exist")
    for (const table of ["events", "accepted_offering_quote_links", "resource_allocations"]) await runner.query(`DROP TRIGGER ${table}_event_order_final_guard ON ${table}`)
    await runner.query(`DROP FUNCTION validate_event_order_final_state()`)
    await runner.query(`DROP TRIGGER events_commercial_mutation_guard ON events`)
    await runner.query(`DROP FUNCTION guard_event_order_mutation()`)
    await runner.query(`DROP TRIGGER accepted_offering_quote_links_event_guard ON accepted_offering_quote_links`)
    await runner.query(`CREATE TRIGGER accepted_offering_quote_links_event_guard BEFORE INSERT ON accepted_offering_quote_links FOR EACH ROW WHEN (NEW.event_id IS NOT NULL) EXECUTE FUNCTION reject_event_quote_link_insert()`)
    await runner.query(`DROP FUNCTION guard_event_order_acceptance()`)
    await runner.query(`DROP TRIGGER offering_quote_snapshots_event_order_current_guard ON offering_quote_snapshots`)
    await runner.query(`DROP FUNCTION guard_event_order_snapshot_current()`)
    await runner.query(`DROP FUNCTION assert_event_order_quote_current(uuid)`)
    await runner.query(`DROP TRIGGER offering_quote_snapshots_event_order_guard ON offering_quote_snapshots`)
    await runner.query(`DROP FUNCTION guard_event_order_snapshot()`)
    await runner.query(`ALTER TABLE offering_quote_snapshots DROP CONSTRAINT offering_quote_snapshots_event_order_shape`)
    // Re-establish the previous accepted kinds; old guarded expressions remain unchanged.
    await runner.query(`ALTER TABLE offering_quote_snapshots DROP CONSTRAINT offering_quote_snapshots_type_check,
      ADD CONSTRAINT offering_quote_snapshots_type_check CHECK (quote_type IN ('stay_preview','template_preview','program_registration','event_service_preview'))`)
    await runner.query(`ALTER TABLE events DROP CONSTRAINT events_commercial_shape, DROP COLUMN accepted_quote, DROP COLUMN resource_selections, DROP COLUMN addon_selections, DROP COLUMN rate_plan_key, DROP COLUMN commercial_offering_id, DROP COLUMN pricing_mode`)
  }
}
