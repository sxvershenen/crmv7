import type { MigrationInterface, QueryRunner } from "typeorm"

/** Gate B: occurrence-bound program quotes, atomic capacity and acceptance guards. */
export class ProgramRegistrationQuoteAcceptance1788123200000 implements MigrationInterface {
  name = "ProgramRegistrationQuoteAcceptance1788123200000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE program_registrations
      ADD COLUMN pricing_mode text NOT NULL DEFAULT 'legacy_unpriced',
      ADD CONSTRAINT program_registrations_pricing_mode_check CHECK (pricing_mode IN ('legacy_unpriced','quote_required'))`)

    await queryRunner.query(`ALTER TABLE offering_quote_snapshots DROP CONSTRAINT offering_quote_snapshots_operational_context_check`)
    await queryRunner.query(`ALTER TABLE offering_quote_snapshots ADD CONSTRAINT offering_quote_snapshots_operational_context_check CHECK (
      operational_context IS NULL OR (
        jsonb_typeof(operational_context) = 'object' AND (
          (operational_context->>'kind' = 'house_stay'
            AND operational_context ?& ARRAY['subjectVersion','primaryResourceId','primaryResourceVersion']
            AND operational_context->>'subjectVersion' ~ '^[1-9][0-9]*$'
            AND operational_context->>'primaryResourceVersion' ~ '^[1-9][0-9]*$'
            AND operational_context->>'primaryResourceId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
          OR (operational_context->>'kind' = 'program_registration'
            AND operational_context ?& ARRAY['subjectVersion','programTemplateId','programTemplateVersion','programOccurrenceId','programOccurrenceVersion']
            AND operational_context->>'subjectVersion' ~ '^[1-9][0-9]*$'
            AND operational_context->>'programTemplateVersion' ~ '^[1-9][0-9]*$'
            AND operational_context->>'programOccurrenceVersion' ~ '^[1-9][0-9]*$'
            AND operational_context->>'programTemplateId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            AND operational_context->>'programOccurrenceId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
        )
      )
    )`)

    await queryRunner.query(`CREATE FUNCTION guard_program_registration_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE target_ids uuid[]; occurrence_row program_occurrences%ROWTYPE; occupied_participants bigint; occupied_registrations bigint;
      BEGIN
        target_ids := ARRAY(SELECT DISTINCT value FROM unnest(ARRAY[NEW.occurrence_id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.occurrence_id ELSE NEW.occurrence_id END]) value ORDER BY value);
        PERFORM 1 FROM program_occurrences WHERE id = ANY(target_ids) ORDER BY id FOR UPDATE;
        IF NEW.archived_at IS NOT NULL OR NEW.status = 'cancelled' THEN RETURN NEW; END IF;
        SELECT * INTO occurrence_row FROM program_occurrences WHERE id = NEW.occurrence_id;
        IF occurrence_row.id IS NULL THEN RAISE EXCEPTION 'program occurrence does not exist' USING ERRCODE = '23503'; END IF;
        IF occurrence_row.status IN ('closed','completed','cancelled')
          AND (TG_OP = 'INSERT' OR OLD.archived_at IS NOT NULL OR OLD.status = 'cancelled' OR OLD.occurrence_id <> NEW.occurrence_id OR OLD.participant_count < NEW.participant_count) THEN
          RAISE EXCEPTION 'program occurrence is closed for capacity increases' USING ERRCODE = '23514';
        END IF;
        SELECT COALESCE(SUM(participant_count),0), COUNT(*) INTO occupied_participants, occupied_registrations
          FROM program_registrations WHERE occurrence_id = NEW.occurrence_id AND id <> NEW.id AND archived_at IS NULL AND status <> 'cancelled';
        IF occupied_participants + NEW.participant_count > occurrence_row.participant_limit OR occupied_registrations + 1 > occurrence_row.registration_limit THEN
          RAISE EXCEPTION 'program occurrence capacity exceeded' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END $$`)
    await queryRunner.query(`CREATE TRIGGER program_registrations_capacity_guard BEFORE INSERT OR UPDATE OF occurrence_id, participant_count, status, archived_at ON program_registrations FOR EACH ROW EXECUTE FUNCTION guard_program_registration_capacity()`)

    await queryRunner.query(`CREATE FUNCTION guard_program_occurrence_capacity_limits() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE occupied_participants bigint; occupied_registrations bigint;
      BEGIN
        SELECT COALESCE(SUM(participant_count),0), COUNT(*) INTO occupied_participants, occupied_registrations
          FROM program_registrations WHERE occurrence_id = NEW.id AND archived_at IS NULL AND status <> 'cancelled';
        IF NEW.participant_limit < occupied_participants OR NEW.registration_limit < occupied_registrations THEN
          RAISE EXCEPTION 'program occurrence limits are below current occupancy' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END $$`)
    await queryRunner.query(`CREATE TRIGGER program_occurrences_capacity_limits_guard BEFORE UPDATE OF participant_limit, registration_limit ON program_occurrences FOR EACH ROW EXECUTE FUNCTION guard_program_occurrence_capacity_limits()`)

    await queryRunner.query(`DROP TRIGGER accepted_offering_quote_links_insert_guard ON accepted_offering_quote_links`)
    await queryRunner.query(`ALTER FUNCTION guard_accepted_offering_quote_link_insert() RENAME TO guard_booking_quote_link_insert`)
    await queryRunner.query(`CREATE TRIGGER accepted_offering_quote_links_booking_guard BEFORE INSERT ON accepted_offering_quote_links FOR EACH ROW WHEN (NEW.booking_item_id IS NOT NULL) EXECUTE FUNCTION guard_booking_quote_link_insert()`)

    await queryRunner.query(`CREATE FUNCTION guard_program_registration_quote_link_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE acceptance_clock timestamptz; snapshot_row offering_quote_snapshots%ROWTYPE; offering_row catalog_offerings%ROWTYPE;
        registration_row program_registrations%ROWTYPE; occurrence_row program_occurrences%ROWTYPE; template_row program_templates%ROWTYPE;
        primary_template_id uuid;
      BEGIN
        SELECT * INTO snapshot_row FROM offering_quote_snapshots WHERE id = NEW.quote_snapshot_id FOR SHARE;
        SELECT * INTO registration_row FROM program_registrations WHERE id = NEW.program_registration_id FOR SHARE;
        SELECT * INTO occurrence_row FROM program_occurrences WHERE id = registration_row.occurrence_id FOR SHARE;
        SELECT * INTO template_row FROM program_templates WHERE id = occurrence_row.template_id FOR SHARE;
        SELECT * INTO offering_row FROM catalog_offerings WHERE id = snapshot_row.offering_id FOR SHARE;
        SELECT program_template_id INTO primary_template_id FROM offering_bindings
          WHERE offering_id = offering_row.id AND role = 'primary' AND archived_at IS NULL FOR SHARE;
        acceptance_clock := clock_timestamp(); NEW.accepted_at := acceptance_clock; NEW.created_at := acceptance_clock;
        IF NOT COALESCE(
          snapshot_row.quote_type = 'program_registration' AND snapshot_row.valid_until > acceptance_clock
          AND snapshot_row.operational_context->>'kind' = 'program_registration'
          AND offering_row.kind = 'program' AND offering_row.state = 'active' AND offering_row.archived_at IS NULL
          AND offering_row.version = snapshot_row.offering_version
          AND offering_row.subject_version = snapshot_row.subject_version
          AND offering_row.pricing_version = snapshot_row.pricing_version
          AND offering_row.addon_assignments_version = snapshot_row.addon_assignments_version
          AND offering_row.active_price_book_id = snapshot_row.price_book_id
          AND offering_row.subject_version::text = snapshot_row.operational_context->>'subjectVersion'
          AND primary_template_id = template_row.id AND template_row.archived_at IS NULL
          AND template_row.id = snapshot_row.program_template_id AND template_row.version = snapshot_row.program_template_version
          AND template_row.id::text = snapshot_row.operational_context->>'programTemplateId'
          AND template_row.version::text = snapshot_row.operational_context->>'programTemplateVersion'
          AND occurrence_row.id::text = snapshot_row.operational_context->>'programOccurrenceId'
          AND occurrence_row.version::text = snapshot_row.operational_context->>'programOccurrenceVersion'
          AND occurrence_row.status = 'open' AND occurrence_row.archived_at IS NULL
          AND registration_row.status = 'confirmed' AND registration_row.archived_at IS NULL AND registration_row.version = NEW.target_version
          AND registration_row.pricing_mode = 'quote_required' AND registration_row.occurrence_id = occurrence_row.id
          AND snapshot_row.request_payload->>'quoteType' = 'program_registration'
          AND snapshot_row.request_payload->>'expectedOccurrenceVersion' = occurrence_row.version::text
          AND snapshot_row.request_payload->>'participants' = registration_row.participant_count::text
          AND jsonb_typeof(snapshot_row.request_payload->'addOns') = 'array'
          AND snapshot_row.result_payload->>'quoteType' = 'program_registration'
          AND snapshot_row.result_payload->>'acceptanceReady' = 'true'
          AND snapshot_row.result_payload->>'quoteId' = snapshot_row.id::text
          AND snapshot_row.result_payload->>'offeringId' = offering_row.id::text
          AND snapshot_row.result_payload->>'programTemplateId' = template_row.id::text
          AND snapshot_row.result_payload->>'programOccurrenceId' = occurrence_row.id::text
          AND snapshot_row.result_payload->>'programOccurrenceVersion' = occurrence_row.version::text
          AND jsonb_typeof(snapshot_row.result_payload#>'{inputs,startsAt}') = 'string'
          AND (snapshot_row.result_payload#>>'{inputs,startsAt}')::timestamptz = occurrence_row.starts_at
          AND jsonb_typeof(snapshot_row.result_payload#>'{inputs,endsAt}') = 'string'
          AND (snapshot_row.result_payload#>>'{inputs,endsAt}')::timestamptz = occurrence_row.ends_at
          AND snapshot_row.result_payload#>>'{inputs,durationMinutes}' = template_row.duration_minutes::text
          AND snapshot_row.result_payload#>>'{inputs,participants}' = registration_row.participant_count::text
          AND snapshot_row.result_payload#>'{inputs,addOns}' = snapshot_row.request_payload->'addOns'
          AND snapshot_row.result_payload#>>'{total,amountMinor}' = registration_row.total_amount::text
          AND snapshot_row.result_payload#>>'{total,currency}' = registration_row.currency
          AND registration_row.discount_amount = 0,
          false
        ) THEN RAISE EXCEPTION 'program quote snapshot and registration are not acceptance-compatible' USING ERRCODE = '23514'; END IF;
        RETURN NEW;
      END $$`)
    await queryRunner.query(`CREATE TRIGGER accepted_offering_quote_links_program_guard BEFORE INSERT ON accepted_offering_quote_links FOR EACH ROW WHEN (NEW.program_registration_id IS NOT NULL) EXECUTE FUNCTION guard_program_registration_quote_link_insert()`)
    await queryRunner.query(`CREATE FUNCTION reject_event_quote_link_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'event quote acceptance is not implemented' USING ERRCODE = '23514'; END $$`)
    await queryRunner.query(`CREATE TRIGGER accepted_offering_quote_links_event_guard BEFORE INSERT ON accepted_offering_quote_links FOR EACH ROW WHEN (NEW.event_id IS NOT NULL) EXECUTE FUNCTION reject_event_quote_link_insert()`)

    await queryRunner.query(`CREATE FUNCTION prevent_accepted_program_registration_quote_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM accepted_offering_quote_links WHERE program_registration_id = OLD.id)
          AND (NEW.occurrence_id, NEW.participant_count, NEW.total_amount, NEW.discount_amount, NEW.currency, NEW.pricing_mode)
            IS DISTINCT FROM (OLD.occurrence_id, OLD.participant_count, OLD.total_amount, OLD.discount_amount, OLD.currency, OLD.pricing_mode) THEN
          RAISE EXCEPTION 'accepted program registration quote fields are immutable' USING ERRCODE = '55000';
        END IF;
        RETURN NEW;
      END $$`)
    await queryRunner.query(`CREATE TRIGGER program_registrations_accepted_quote_immutable_guard BEFORE UPDATE ON program_registrations FOR EACH ROW EXECUTE FUNCTION prevent_accepted_program_registration_quote_mutation()`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS program_registrations_accepted_quote_immutable_guard ON program_registrations`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_accepted_program_registration_quote_mutation()`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS accepted_offering_quote_links_event_guard ON accepted_offering_quote_links`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS reject_event_quote_link_insert()`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS accepted_offering_quote_links_program_guard ON accepted_offering_quote_links`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_program_registration_quote_link_insert()`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS accepted_offering_quote_links_booking_guard ON accepted_offering_quote_links`)
    await queryRunner.query(`ALTER FUNCTION guard_booking_quote_link_insert() RENAME TO guard_accepted_offering_quote_link_insert`)
    await queryRunner.query(`CREATE TRIGGER accepted_offering_quote_links_insert_guard BEFORE INSERT ON accepted_offering_quote_links FOR EACH ROW EXECUTE FUNCTION guard_accepted_offering_quote_link_insert()`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS program_occurrences_capacity_limits_guard ON program_occurrences`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_program_occurrence_capacity_limits()`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS program_registrations_capacity_guard ON program_registrations`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_program_registration_capacity()`)
    await queryRunner.query(`ALTER TABLE offering_quote_snapshots DROP CONSTRAINT offering_quote_snapshots_operational_context_check`)
    await queryRunner.query(`ALTER TABLE offering_quote_snapshots ADD CONSTRAINT offering_quote_snapshots_operational_context_check CHECK (
      operational_context IS NULL OR (jsonb_typeof(operational_context) = 'object' AND operational_context ?& ARRAY['kind','subjectVersion','primaryResourceId','primaryResourceVersion']
        AND operational_context->>'kind' = 'house_stay' AND operational_context->>'subjectVersion' ~ '^[1-9][0-9]*$'
        AND operational_context->>'primaryResourceVersion' ~ '^[1-9][0-9]*$'
        AND operational_context->>'primaryResourceId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')) NOT VALID`)
    await queryRunner.query(`ALTER TABLE program_registrations DROP CONSTRAINT program_registrations_pricing_mode_check`)
    await queryRunner.query(`ALTER TABLE program_registrations DROP COLUMN pricing_mode`)
  }
}
