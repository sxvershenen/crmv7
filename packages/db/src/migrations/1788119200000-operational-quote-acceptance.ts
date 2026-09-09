import type { MigrationInterface, QueryRunner } from "typeorm"

/** P4.5B-3: immutable bridge from one accepted quote to one operational target. */
export class OperationalQuoteAcceptance1788119200000 implements MigrationInterface {
  name = "OperationalQuoteAcceptance1788119200000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE offering_quote_snapshots
      ADD COLUMN operational_context jsonb,
      ADD CONSTRAINT offering_quote_snapshots_operational_context_check CHECK (
        operational_context IS NULL OR (
          jsonb_typeof(operational_context) = 'object'
          AND operational_context ?& ARRAY['kind', 'subjectVersion', 'primaryResourceId', 'primaryResourceVersion']
          AND operational_context->>'kind' = 'house_stay'
          AND operational_context->>'subjectVersion' ~ '^[1-9][0-9]*$'
          AND operational_context->>'primaryResourceVersion' ~ '^[1-9][0-9]*$'
          AND operational_context->>'primaryResourceId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        )
      )`)

    await queryRunner.query(`CREATE TABLE accepted_offering_quote_links (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      quote_snapshot_id uuid NOT NULL UNIQUE REFERENCES offering_quote_snapshots(id) ON DELETE RESTRICT,
      booking_item_id uuid REFERENCES booking_items(id) ON DELETE RESTRICT,
      event_id uuid REFERENCES events(id) ON DELETE RESTRICT,
      program_registration_id uuid REFERENCES program_registrations(id) ON DELETE RESTRICT,
      target_version integer NOT NULL,
      accepted_at timestamptz NOT NULL DEFAULT now(),
      accepted_by uuid REFERENCES users(id) ON DELETE RESTRICT,
      operation_id uuid NOT NULL,
      request_id text NOT NULL,
      entry_surface text NOT NULL DEFAULT 'internal',
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT accepted_offering_quote_links_exactly_one_target_check CHECK (
        num_nonnulls(booking_item_id, event_id, program_registration_id) = 1
      ),
      CONSTRAINT accepted_offering_quote_links_target_version_check CHECK (target_version > 0),
      CONSTRAINT accepted_offering_quote_links_request_id_check CHECK (length(btrim(request_id)) > 0),
      CONSTRAINT accepted_offering_quote_links_entry_surface_check CHECK (entry_surface = 'internal')
    )`)
    await queryRunner.query(`CREATE UNIQUE INDEX accepted_offering_quote_links_booking_item_unique
      ON accepted_offering_quote_links(booking_item_id) WHERE booking_item_id IS NOT NULL`)
    await queryRunner.query(`CREATE UNIQUE INDEX accepted_offering_quote_links_event_unique
      ON accepted_offering_quote_links(event_id) WHERE event_id IS NOT NULL`)
    await queryRunner.query(`CREATE UNIQUE INDEX accepted_offering_quote_links_registration_unique
      ON accepted_offering_quote_links(program_registration_id) WHERE program_registration_id IS NOT NULL`)
    await queryRunner.query(`CREATE INDEX accepted_offering_quote_links_operation_idx
      ON accepted_offering_quote_links(operation_id)`)

    await queryRunner.query(`CREATE FUNCTION guard_accepted_offering_quote_link_insert()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        acceptance_clock timestamptz;
        quote_valid_until timestamptz; quote_context jsonb; quote_request jsonb; quote_result jsonb;
        quote_offering_id uuid; offering_kind text; offering_state text; offering_archived_at timestamptz;
        offering_subject_version integer; offering_timezone text;
        primary_resource_id uuid; primary_resource_version integer; primary_resource_archived_at timestamptz;
        booking_item_type text; booking_item_resource_id uuid; booking_item_start_at timestamptz; booking_item_end_at timestamptz;
        booking_item_quantity integer; booking_item_price_amount integer; booking_item_discount_amount integer; booking_item_currency text;
        booking_version integer; booking_status text; booking_item_archived_at timestamptz;
      BEGIN
        IF NEW.event_id IS NOT NULL OR NEW.program_registration_id IS NOT NULL THEN
          RAISE EXCEPTION 'event and program registration quote acceptance is not implemented' USING ERRCODE = '23514';
        END IF;
        IF NEW.booking_item_id IS NULL THEN
          RAISE EXCEPTION 'booking item quote acceptance requires booking_item_id' USING ERRCODE = '23514';
        END IF;

        SELECT
          snapshot.valid_until, snapshot.operational_context, snapshot.request_payload, snapshot.result_payload, snapshot.offering_id,
          offering.kind, offering.state, offering.archived_at, offering.subject_version, offering.timezone,
          resource.id, resource.version, resource.archived_at,
          item.type, item.resource_id, item.start_at, item.end_at, item.quantity, item.price_amount, item.discount_amount, item.currency, item.archived_at,
          booking.version, booking.status
          INTO quote_valid_until, quote_context, quote_request, quote_result, quote_offering_id,
            offering_kind, offering_state, offering_archived_at, offering_subject_version, offering_timezone,
            primary_resource_id, primary_resource_version, primary_resource_archived_at,
            booking_item_type, booking_item_resource_id, booking_item_start_at, booking_item_end_at, booking_item_quantity, booking_item_price_amount, booking_item_discount_amount, booking_item_currency, booking_item_archived_at,
            booking_version, booking_status
          FROM offering_quote_snapshots snapshot
          JOIN catalog_offerings offering ON offering.id = snapshot.offering_id
          JOIN offering_bindings binding ON binding.offering_id = offering.id AND binding.role = 'primary' AND binding.archived_at IS NULL
          JOIN resources resource ON resource.id = binding.resource_id
          JOIN booking_items item ON item.id = NEW.booking_item_id
          JOIN bookings booking ON booking.id = item.booking_id
          WHERE snapshot.id = NEW.quote_snapshot_id
          FOR SHARE OF snapshot, offering, binding, resource, item, booking;

        -- This is intentionally wall clock after every relevant row lock. It
        -- prevents a quote expiring while this trigger waits on a contender.
        acceptance_clock := clock_timestamp();
        NEW.accepted_at := acceptance_clock;
        NEW.created_at := acceptance_clock;

        IF NOT COALESCE(
          quote_valid_until > acceptance_clock
          AND quote_context IS NOT NULL
          AND quote_context->>'kind' = 'house_stay'
          AND offering_kind = 'house' AND offering_state = 'active' AND offering_archived_at IS NULL
          AND offering_subject_version::text = quote_context->>'subjectVersion'
          AND primary_resource_id::text = quote_context->>'primaryResourceId'
          AND primary_resource_version::text = quote_context->>'primaryResourceVersion'
          AND primary_resource_archived_at IS NULL
          AND booking_item_archived_at IS NULL
          AND booking_version = NEW.target_version AND booking_status = 'confirmed'
          AND booking_item_type = 'accommodation'
          AND booking_item_resource_id = primary_resource_id
          AND booking_item_discount_amount = 0
          AND jsonb_typeof(quote_request) = 'object'
          AND jsonb_typeof(quote_request->'offeringId') = 'string'
          AND quote_request->>'offeringId' = quote_offering_id::text
          AND jsonb_typeof(quote_request->'currency') = 'string'
          AND quote_request->>'currency' = booking_item_currency
          AND jsonb_typeof(quote_request->'addOns') = 'array'
          AND quote_request->'addOns' = '[]'::jsonb
          AND jsonb_typeof(quote_request->'period') = 'object'
          AND jsonb_typeof(quote_request#>'{period,type}') = 'string'
          AND quote_request#>>'{period,type}' = 'stay'
          AND jsonb_typeof(quote_request#>'{period,arrivalDate}') = 'string'
          AND quote_request#>>'{period,arrivalDate}' = to_char(booking_item_start_at AT TIME ZONE offering_timezone, 'YYYY-MM-DD')
          AND jsonb_typeof(quote_request#>'{period,departureDate}') = 'string'
          AND quote_request#>>'{period,departureDate}' = to_char(booking_item_end_at AT TIME ZONE offering_timezone, 'YYYY-MM-DD')
          AND jsonb_typeof(quote_request->'quantities') = 'object'
          AND jsonb_typeof(quote_request#>'{quantities,guests}') = 'number'
          AND jsonb_typeof(quote_request#>'{quantities,participants}') = 'null'
          AND jsonb_typeof(quote_request#>'{quantities,units}') = 'number'
          AND quote_request#>>'{quantities,units}' = booking_item_quantity::text
          AND jsonb_typeof(quote_result) = 'object'
          AND jsonb_typeof(quote_result->'immutableSnapshot') = 'boolean'
          AND quote_result->>'immutableSnapshot' = 'true'
          AND jsonb_typeof(quote_result->'offeringId') = 'string'
          AND quote_result->>'offeringId' = quote_offering_id::text
          AND jsonb_typeof(quote_result->'currency') = 'string'
          AND quote_result->>'currency' = booking_item_currency
          AND jsonb_typeof(quote_result->'total') = 'object'
          AND jsonb_typeof(quote_result#>'{total,amountMinor}') = 'number'
          AND quote_result#>>'{total,amountMinor}' = booking_item_price_amount::text
          AND jsonb_typeof(quote_result#>'{total,currency}') = 'string'
          AND quote_result#>>'{total,currency}' = booking_item_currency,
          false
        ) THEN
          RAISE EXCEPTION 'quote snapshot and booking item are not acceptance-compatible' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END
      $$`)
    await queryRunner.query(`CREATE TRIGGER accepted_offering_quote_links_insert_guard
      BEFORE INSERT ON accepted_offering_quote_links
      FOR EACH ROW EXECUTE FUNCTION guard_accepted_offering_quote_link_insert()`)
    await queryRunner.query(`CREATE FUNCTION prevent_accepted_offering_quote_link_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'accepted offering quote links are immutable' USING ERRCODE = '55000';
      END
      $$`)
    await queryRunner.query(`CREATE TRIGGER accepted_offering_quote_links_immutable_guard
      BEFORE UPDATE OR DELETE ON accepted_offering_quote_links
      FOR EACH ROW EXECUTE FUNCTION prevent_accepted_offering_quote_link_mutation()`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS accepted_offering_quote_links_immutable_guard ON accepted_offering_quote_links`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_accepted_offering_quote_link_mutation()`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS accepted_offering_quote_links_insert_guard ON accepted_offering_quote_links`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_accepted_offering_quote_link_insert()`)
    await queryRunner.query(`DROP TABLE IF EXISTS accepted_offering_quote_links`)
    await queryRunner.query(`ALTER TABLE offering_quote_snapshots DROP CONSTRAINT IF EXISTS offering_quote_snapshots_operational_context_check`)
    await queryRunner.query(`ALTER TABLE offering_quote_snapshots DROP COLUMN IF EXISTS operational_context`)
  }
}
