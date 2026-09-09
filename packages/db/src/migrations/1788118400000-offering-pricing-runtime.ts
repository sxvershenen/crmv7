import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Runtime guarantees for P4.5B pricing. The application service remains the
 * owner of validation and transitions; these constraints prevent bypasses
 * from mutating an activated commercial revision or a persisted quote.
 */
export class OfferingPricingRuntime1788118400000 implements MigrationInterface {
  name = "OfferingPricingRuntime1788118400000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE UNIQUE INDEX price_books_one_live_draft_idx
      ON price_books(offering_id)
      WHERE state = 'draft' AND archived_at IS NULL`)

    await queryRunner.query(`ALTER TABLE price_books
      ADD CONSTRAINT price_books_lifecycle_metadata_check CHECK (
        (state = 'draft'
          AND scheduled_activation_at IS NULL AND scheduled_by IS NULL
          AND activated_at IS NULL AND activated_by IS NULL
          AND retired_at IS NULL AND retired_by IS NULL)
        OR (state = 'scheduled'
          AND scheduled_activation_at IS NOT NULL
          AND activated_at IS NULL AND activated_by IS NULL
          AND retired_at IS NULL AND retired_by IS NULL)
        OR (state = 'active'
          AND activated_at IS NOT NULL
          AND retired_at IS NULL AND retired_by IS NULL)
        OR (state = 'retired' AND retired_at IS NOT NULL)
      )`)

    await queryRunner.query(`CREATE FUNCTION guard_price_book_lifecycle()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        allowed_columns text[];
      BEGIN
        IF TG_OP = 'DELETE' THEN
          IF OLD.state <> 'draft' THEN
            RAISE EXCEPTION 'price book % is immutable after leaving draft', OLD.id
              USING ERRCODE = '55000';
          END IF;
          RETURN OLD;
        END IF;

        IF NEW.state <> OLD.state AND NEW.version <> OLD.version + 1 THEN
          RAISE EXCEPTION 'price book lifecycle transition must increment version by exactly one'
            USING ERRCODE = '23514';
        END IF;

        IF OLD.state = 'draft' THEN
          IF NEW.state NOT IN ('draft', 'scheduled', 'active') THEN
            RAISE EXCEPTION 'invalid price book lifecycle transition: % -> %', OLD.state, NEW.state
              USING ERRCODE = '23514';
          END IF;
          IF NEW.state <> 'draft' AND (OLD.archived_at IS NOT NULL OR NEW.archived_at IS NOT NULL) THEN
            RAISE EXCEPTION 'an archived price book draft cannot be activated or scheduled'
              USING ERRCODE = '23514';
          END IF;
          RETURN NEW;
        END IF;

        IF OLD.state = 'scheduled' AND NEW.state = 'active' THEN
          allowed_columns := ARRAY['state', 'version', 'updated_at', 'updated_by', 'activated_at', 'activated_by'];
        ELSIF OLD.state = 'scheduled' AND NEW.state = 'retired' THEN
          allowed_columns := ARRAY['state', 'version', 'updated_at', 'updated_by', 'retired_at', 'retired_by'];
        ELSIF OLD.state = 'active' AND NEW.state = 'retired' THEN
          allowed_columns := ARRAY['state', 'version', 'updated_at', 'updated_by', 'retired_at', 'retired_by'];
        ELSE
          RAISE EXCEPTION 'invalid or immutable price book lifecycle transition: % -> %', OLD.state, NEW.state
            USING ERRCODE = '23514';
        END IF;

        IF (to_jsonb(NEW) - allowed_columns) IS DISTINCT FROM (to_jsonb(OLD) - allowed_columns) THEN
          RAISE EXCEPTION 'price book % commercial fields are immutable after leaving draft', OLD.id
            USING ERRCODE = '55000';
        END IF;

        RETURN NEW;
      END
      $$`)
    await queryRunner.query(`CREATE TRIGGER price_books_lifecycle_guard
      BEFORE UPDATE OR DELETE ON price_books
      FOR EACH ROW EXECUTE FUNCTION guard_price_book_lifecycle()`)

    await queryRunner.query(`CREATE FUNCTION guard_rate_plan_draft_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        old_book_state text;
        new_book_state text;
      BEGIN
        IF TG_OP IN ('UPDATE', 'DELETE') THEN
          SELECT state INTO old_book_state FROM price_books WHERE id = OLD.price_book_id FOR SHARE;
          IF old_book_state IS DISTINCT FROM 'draft' THEN
            RAISE EXCEPTION 'rate plans are immutable outside a draft price book'
              USING ERRCODE = '55000';
          END IF;
        END IF;

        IF TG_OP IN ('INSERT', 'UPDATE') THEN
          SELECT state INTO new_book_state FROM price_books WHERE id = NEW.price_book_id FOR SHARE;
          IF new_book_state IS DISTINCT FROM 'draft' THEN
            RAISE EXCEPTION 'rate plans may only be written inside a draft price book'
              USING ERRCODE = '55000';
          END IF;
          RETURN NEW;
        END IF;

        RETURN OLD;
      END
      $$`)
    await queryRunner.query(`CREATE TRIGGER rate_plans_draft_guard
      BEFORE INSERT OR UPDATE OR DELETE ON rate_plans
      FOR EACH ROW EXECUTE FUNCTION guard_rate_plan_draft_mutation()`)

    await queryRunner.query(`CREATE FUNCTION guard_price_rule_draft_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        old_book_state text;
        new_book_state text;
      BEGIN
        IF TG_OP IN ('UPDATE', 'DELETE') THEN
          SELECT pb.state INTO old_book_state
          FROM rate_plans rp
          JOIN price_books pb ON pb.id = rp.price_book_id
          WHERE rp.id = OLD.rate_plan_id
          FOR SHARE OF pb;
          IF old_book_state IS DISTINCT FROM 'draft' THEN
            RAISE EXCEPTION 'price rules are immutable outside a draft price book'
              USING ERRCODE = '55000';
          END IF;
        END IF;

        IF TG_OP IN ('INSERT', 'UPDATE') THEN
          SELECT pb.state INTO new_book_state
          FROM rate_plans rp
          JOIN price_books pb ON pb.id = rp.price_book_id
          WHERE rp.id = NEW.rate_plan_id
          FOR SHARE OF pb;
          IF new_book_state IS DISTINCT FROM 'draft' THEN
            RAISE EXCEPTION 'price rules may only be written inside a draft price book'
              USING ERRCODE = '55000';
          END IF;
          RETURN NEW;
        END IF;

        RETURN OLD;
      END
      $$`)
    await queryRunner.query(`CREATE TRIGGER price_rules_draft_guard
      BEFORE INSERT OR UPDATE OR DELETE ON price_rules
      FOR EACH ROW EXECUTE FUNCTION guard_price_rule_draft_mutation()`)

    await queryRunner.query(`CREATE TABLE offering_quote_snapshots (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      offering_id uuid NOT NULL REFERENCES catalog_offerings(id) ON DELETE RESTRICT,
      offering_version integer NOT NULL,
      pricing_version integer NOT NULL,
      addon_assignments_version integer NOT NULL,
      price_book_id uuid NOT NULL,
      price_book_version integer NOT NULL,
      business_calendar_id uuid NOT NULL REFERENCES business_calendars(id) ON DELETE RESTRICT,
      business_calendar_version integer NOT NULL,
      business_calendar_source_version text NOT NULL,
      request_payload jsonb NOT NULL,
      result_payload jsonb NOT NULL,
      provenance jsonb NOT NULL,
      calculated_at timestamptz NOT NULL,
      valid_until timestamptz NOT NULL,
      operation_id uuid NOT NULL,
      idempotency_key text NOT NULL,
      actor_id uuid REFERENCES users(id) ON DELETE RESTRICT,
      request_id text NOT NULL,
      entry_surface text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT offering_quote_snapshots_price_book_fk
        FOREIGN KEY (price_book_id, offering_id) REFERENCES price_books(id, offering_id) ON DELETE RESTRICT,
      CONSTRAINT offering_quote_snapshots_versions_check CHECK (
        offering_version > 0 AND pricing_version > 0 AND addon_assignments_version > 0
        AND price_book_version > 0 AND business_calendar_version > 0
      ),
      CONSTRAINT offering_quote_snapshots_validity_check CHECK (valid_until > calculated_at),
      CONSTRAINT offering_quote_snapshots_calendar_source_check CHECK (length(btrim(business_calendar_source_version)) > 0),
      CONSTRAINT offering_quote_snapshots_payloads_check CHECK (
        jsonb_typeof(request_payload) = 'object'
        AND jsonb_typeof(result_payload) = 'object'
        AND jsonb_typeof(provenance) = 'object'
      ),
      CONSTRAINT offering_quote_snapshots_idempotency_key_check CHECK (length(btrim(idempotency_key)) > 0),
      CONSTRAINT offering_quote_snapshots_request_id_check CHECK (length(btrim(request_id)) > 0),
      CONSTRAINT offering_quote_snapshots_entry_surface_check CHECK (length(btrim(entry_surface)) > 0)
    )`)
    await queryRunner.query(`CREATE INDEX offering_quote_snapshots_offering_calculated_idx
      ON offering_quote_snapshots(offering_id, calculated_at DESC)`)
    await queryRunner.query(`CREATE INDEX offering_quote_snapshots_operation_idx
      ON offering_quote_snapshots(operation_id)`)

    await queryRunner.query(`CREATE FUNCTION prevent_offering_quote_snapshot_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'offering quote snapshots are immutable'
          USING ERRCODE = '55000';
      END
      $$`)
    await queryRunner.query(`CREATE TRIGGER offering_quote_snapshots_immutable_guard
      BEFORE UPDATE OR DELETE ON offering_quote_snapshots
      FOR EACH ROW EXECUTE FUNCTION prevent_offering_quote_snapshot_mutation()`)

    await queryRunner.query(`CREATE TABLE outbox_deliveries (
      event_id uuid NOT NULL REFERENCES outbox_events(id) ON DELETE CASCADE,
      consumer text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      attempts integer NOT NULL DEFAULT 0,
      available_at timestamptz NOT NULL DEFAULT now(),
      processed_at timestamptz,
      last_error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (event_id, consumer),
      CONSTRAINT outbox_deliveries_consumer_check CHECK (length(btrim(consumer)) > 0),
      CONSTRAINT outbox_deliveries_status_check CHECK (status IN ('pending','processing','succeeded','failed')),
      CONSTRAINT outbox_deliveries_attempts_check CHECK (attempts >= 0),
      CONSTRAINT outbox_deliveries_completion_check CHECK (
        (status = 'succeeded' AND processed_at IS NOT NULL AND last_error IS NULL)
        OR (status <> 'succeeded' AND processed_at IS NULL)
      )
    )`)
    await queryRunner.query(`CREATE INDEX outbox_deliveries_ready_idx
      ON outbox_deliveries(consumer, available_at)
      WHERE status IN ('pending','failed')`)
    await queryRunner.query(`CREATE INDEX outbox_deliveries_event_status_idx
      ON outbox_deliveries(event_id, status)`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS outbox_deliveries`)

    await queryRunner.query(`DROP TRIGGER IF EXISTS offering_quote_snapshots_immutable_guard ON offering_quote_snapshots`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_offering_quote_snapshot_mutation()`)
    await queryRunner.query(`DROP TABLE IF EXISTS offering_quote_snapshots`)

    await queryRunner.query(`DROP TRIGGER IF EXISTS price_rules_draft_guard ON price_rules`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_price_rule_draft_mutation()`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS rate_plans_draft_guard ON rate_plans`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_rate_plan_draft_mutation()`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS price_books_lifecycle_guard ON price_books`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_price_book_lifecycle()`)
    await queryRunner.query(`ALTER TABLE price_books DROP CONSTRAINT IF EXISTS price_books_lifecycle_metadata_check`)
    await queryRunner.query(`DROP INDEX IF EXISTS price_books_one_live_draft_idx`)
  }
}
