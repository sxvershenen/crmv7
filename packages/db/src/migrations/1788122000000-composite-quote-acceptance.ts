import type { MigrationInterface, QueryRunner } from "typeorm"

/** Accepts the same immutable stay quote that priced the booking item's add-ons. */
export class CompositeQuoteAcceptance1788122000000 implements MigrationInterface {
  name = "CompositeQuoteAcceptance1788122000000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE OR REPLACE FUNCTION guard_accepted_offering_quote_link_insert()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        acceptance_clock timestamptz;
        quote_valid_until timestamptz; quote_context jsonb; quote_request jsonb; quote_result jsonb;
        quote_offering_id uuid; offering_kind text; offering_state text; offering_archived_at timestamptz;
        offering_subject_version integer; offering_timezone text;
        primary_resource_id uuid; primary_resource_version integer; primary_resource_archived_at timestamptz;
        booking_item_type text; booking_item_resource_id uuid; booking_item_start_at timestamptz; booking_item_end_at timestamptz;
        booking_item_quantity integer; booking_item_price_amount integer; booking_item_discount_amount integer; booking_item_currency text;
        booking_item_quote_snapshot_id uuid; booking_item_addon_selections jsonb;
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
          item.type, item.resource_id, item.start_at, item.end_at, item.quantity, item.price_amount, item.discount_amount, item.currency,
          item.quote_snapshot_id, item.addon_selections, item.archived_at,
          booking.version, booking.status
          INTO quote_valid_until, quote_context, quote_request, quote_result, quote_offering_id,
            offering_kind, offering_state, offering_archived_at, offering_subject_version, offering_timezone,
            primary_resource_id, primary_resource_version, primary_resource_archived_at,
            booking_item_type, booking_item_resource_id, booking_item_start_at, booking_item_end_at, booking_item_quantity, booking_item_price_amount, booking_item_discount_amount, booking_item_currency,
            booking_item_quote_snapshot_id, booking_item_addon_selections, booking_item_archived_at,
            booking_version, booking_status
          FROM offering_quote_snapshots snapshot
          JOIN catalog_offerings offering ON offering.id = snapshot.offering_id
          JOIN offering_bindings binding ON binding.offering_id = offering.id AND binding.role = 'primary' AND binding.archived_at IS NULL
          JOIN resources resource ON resource.id = binding.resource_id
          JOIN booking_items item ON item.id = NEW.booking_item_id
          JOIN bookings booking ON booking.id = item.booking_id
          WHERE snapshot.id = NEW.quote_snapshot_id
          FOR SHARE OF snapshot, offering, binding, resource, item, booking;

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
          AND jsonb_typeof(booking_item_addon_selections) = 'array'
          AND jsonb_array_length(quote_request->'addOns') = jsonb_array_length(booking_item_addon_selections)
          AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(quote_request->'addOns') quoted
            WHERE jsonb_typeof(quoted) <> 'object'
              OR jsonb_typeof(quoted->'assignmentId') <> 'string'
              OR jsonb_typeof(quoted->'quantity') <> 'number'
          )
          AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(booking_item_addon_selections) selected
            WHERE jsonb_typeof(selected) <> 'object'
              OR jsonb_typeof(selected->'assignmentId') <> 'string'
              OR jsonb_typeof(selected->'quantity') <> 'number'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(quote_request->'addOns') quoted
            WHERE NOT EXISTS (
              SELECT 1
              FROM jsonb_array_elements(booking_item_addon_selections) selected
              WHERE selected->>'assignmentId' = quoted->>'assignmentId'
                AND selected->>'quantity' = quoted->>'quantity'
            )
          )
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(booking_item_addon_selections) selected
            WHERE NOT EXISTS (
              SELECT 1
              FROM jsonb_array_elements(quote_request->'addOns') quoted
              WHERE quoted->>'assignmentId' = selected->>'assignmentId'
                AND quoted->>'quantity' = selected->>'quantity'
            )
          )
          AND (
            (jsonb_array_length(booking_item_addon_selections) = 0 AND booking_item_quote_snapshot_id IS NULL)
            OR (jsonb_array_length(booking_item_addon_selections) > 0 AND booking_item_quote_snapshot_id = NEW.quote_snapshot_id)
          )
          AND jsonb_typeof(quote_request->'period') = 'object'
          AND jsonb_typeof(quote_request#>'{period,type}') = 'string'
          AND quote_request#>>'{period,type}' = 'stay'
          AND jsonb_typeof(quote_request#>'{period,arrivalDate}') = 'string'
          AND quote_request#>>'{period,arrivalDate}' = to_char(booking_item_start_at AT TIME ZONE offering_timezone, 'YYYY-MM-DD')
          AND jsonb_typeof(quote_request#>'{period,departureDate}') = 'string'
          AND quote_request#>>'{period,departureDate}' = to_char(booking_item_end_at AT TIME ZONE offering_timezone, 'YYYY-MM-DD')
          AND jsonb_typeof(quote_request->'quantities') = 'object'
          AND jsonb_typeof(quote_request#>'{quantities,guests}') = 'number'
          AND quote_request#>>'{quantities,guests}' = booking_item_quantity::text
          AND jsonb_typeof(quote_request#>'{quantities,participants}') = 'null'
          AND jsonb_typeof(quote_request#>'{quantities,units}') = 'number'
          AND quote_request#>>'{quantities,units}' = '1'
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
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE OR REPLACE FUNCTION guard_accepted_offering_quote_link_insert()
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
  }
}
