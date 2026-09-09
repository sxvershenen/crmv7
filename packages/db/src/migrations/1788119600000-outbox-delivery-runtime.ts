import type { MigrationInterface, QueryRunner } from "typeorm"

/** P4.5B-4: fenced per-consumer deliveries, forensic attempts and projection receipts. */
export class OutboxDeliveryRuntime1788119600000 implements MigrationInterface {
  name = "OutboxDeliveryRuntime1788119600000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE outbox_deliveries
      ADD COLUMN delivery_epoch integer NOT NULL DEFAULT 1,
      ADD COLUMN replay_count integer NOT NULL DEFAULT 0,
      ADD COLUMN max_attempts smallint NOT NULL DEFAULT 8,
      ADD COLUMN lease_token uuid,
      ADD COLUMN lease_owner text,
      ADD COLUMN lease_acquired_at timestamptz,
      ADD COLUMN lease_expires_at timestamptz,
      ADD COLUMN last_attempt_at timestamptz,
      ADD COLUMN last_failure_at timestamptz,
      ADD COLUMN last_error_code text,
      ADD COLUMN dead_lettered_at timestamptz`)

    // Existing processing rows were leased through available_at. Make them
    // reclaimable by the fenced dispatcher without discarding their attempt.
    await queryRunner.query(`UPDATE outbox_deliveries
      SET lease_token = gen_random_uuid(), lease_owner = 'legacy_recovery',
        lease_acquired_at = updated_at,
        lease_expires_at = GREATEST(available_at, updated_at + interval '1 microsecond')
      WHERE status = 'processing'`)

    await queryRunner.query(`ALTER TABLE outbox_deliveries
      DROP CONSTRAINT outbox_deliveries_status_check,
      DROP CONSTRAINT outbox_deliveries_completion_check,
      ADD CONSTRAINT outbox_deliveries_status_check CHECK (status IN ('pending','processing','succeeded','failed','dead_letter')),
      ADD CONSTRAINT outbox_deliveries_delivery_epoch_check CHECK (delivery_epoch > 0),
      ADD CONSTRAINT outbox_deliveries_replay_count_check CHECK (replay_count >= 0),
      ADD CONSTRAINT outbox_deliveries_max_attempts_check CHECK (max_attempts BETWEEN 1 AND 100),
      ADD CONSTRAINT outbox_deliveries_lease_owner_check CHECK (lease_owner IS NULL OR length(btrim(lease_owner)) > 0),
      ADD CONSTRAINT outbox_deliveries_error_code_check CHECK (last_error_code IS NULL OR last_error_code ~ '^[A-Z][A-Z0-9_]*$'),
      ADD CONSTRAINT outbox_deliveries_completion_check CHECK (
        (status = 'succeeded' AND processed_at IS NOT NULL AND lease_token IS NULL AND lease_owner IS NULL
          AND lease_acquired_at IS NULL AND lease_expires_at IS NULL AND last_error IS NULL
          AND last_error_code IS NULL AND dead_lettered_at IS NULL)
        OR (status = 'processing' AND processed_at IS NULL AND lease_token IS NOT NULL AND lease_owner IS NOT NULL
          AND lease_acquired_at IS NOT NULL AND lease_expires_at IS NOT NULL AND lease_expires_at > lease_acquired_at
          AND dead_lettered_at IS NULL)
        OR (status IN ('pending','failed') AND processed_at IS NULL AND lease_token IS NULL AND lease_owner IS NULL
          AND lease_acquired_at IS NULL AND lease_expires_at IS NULL AND dead_lettered_at IS NULL)
        OR (status = 'dead_letter' AND processed_at IS NULL AND lease_token IS NULL AND lease_owner IS NULL
          AND lease_acquired_at IS NULL AND lease_expires_at IS NULL AND dead_lettered_at IS NOT NULL
          AND last_error_code IS NOT NULL)
      )`)
    await queryRunner.query(`DROP INDEX outbox_deliveries_ready_idx`)
    await queryRunner.query(`CREATE INDEX outbox_deliveries_ready_idx
      ON outbox_deliveries(consumer, available_at, event_id)
      WHERE status IN ('pending','failed')`)
    await queryRunner.query(`CREATE INDEX outbox_deliveries_lease_expiry_idx
      ON outbox_deliveries(consumer, lease_expires_at, event_id)
      WHERE status = 'processing'`)
    await queryRunner.query(`CREATE INDEX outbox_deliveries_dead_letter_idx
      ON outbox_deliveries(consumer, dead_lettered_at DESC, event_id)
      WHERE status = 'dead_letter'`)

    await queryRunner.query(`CREATE TABLE outbox_delivery_attempts (
      event_id uuid NOT NULL,
      consumer text NOT NULL,
      delivery_epoch integer NOT NULL,
      attempt integer NOT NULL,
      lease_token uuid NOT NULL,
      outcome text NOT NULL,
      error_code text,
      attempted_at timestamptz NOT NULL,
      completed_at timestamptz NOT NULL,
      next_available_at timestamptz,
      PRIMARY KEY (event_id, consumer, delivery_epoch, attempt),
      CONSTRAINT outbox_delivery_attempts_delivery_fk FOREIGN KEY (event_id, consumer)
        REFERENCES outbox_deliveries(event_id, consumer) ON DELETE RESTRICT,
      CONSTRAINT outbox_delivery_attempts_epoch_check CHECK (delivery_epoch > 0),
      CONSTRAINT outbox_delivery_attempts_attempt_check CHECK (attempt > 0),
      CONSTRAINT outbox_delivery_attempts_outcome_check CHECK (outcome IN ('succeeded','retryable_failure','permanent_failure','lease_expired')),
      CONSTRAINT outbox_delivery_attempts_error_code_check CHECK (error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]*$'),
      CONSTRAINT outbox_delivery_attempts_time_check CHECK (completed_at >= attempted_at),
      CONSTRAINT outbox_delivery_attempts_result_check CHECK (
        (outcome = 'succeeded' AND error_code IS NULL AND next_available_at IS NULL)
        OR (outcome = 'retryable_failure' AND error_code IS NOT NULL AND next_available_at IS NOT NULL)
        OR (outcome IN ('permanent_failure','lease_expired') AND error_code IS NOT NULL AND next_available_at IS NULL)
      )
    )`)
    await queryRunner.query(`CREATE INDEX outbox_delivery_attempts_delivery_idx
      ON outbox_delivery_attempts(event_id, consumer, delivery_epoch DESC, attempt DESC)`)
    await queryRunner.query(`CREATE FUNCTION prevent_outbox_delivery_attempt_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'outbox delivery attempts are append-only' USING ERRCODE = '55000';
      END
      $$`)
    await queryRunner.query(`CREATE TRIGGER outbox_delivery_attempts_immutable_guard
      BEFORE UPDATE OR DELETE ON outbox_delivery_attempts
      FOR EACH ROW EXECUTE FUNCTION prevent_outbox_delivery_attempt_mutation()`)

    await queryRunner.query(`CREATE TABLE outbox_delivery_replays (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid NOT NULL,
      consumer text NOT NULL,
      previous_delivery_epoch integer NOT NULL,
      previous_attempts integer NOT NULL,
      operation_id uuid NOT NULL,
      request_id text NOT NULL,
      reason text NOT NULL,
      replayed_by uuid REFERENCES users(id) ON DELETE RESTRICT,
      replayed_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT outbox_delivery_replays_delivery_fk FOREIGN KEY (event_id, consumer)
        REFERENCES outbox_deliveries(event_id, consumer) ON DELETE RESTRICT,
      CONSTRAINT outbox_delivery_replays_epoch_check CHECK (previous_delivery_epoch > 0),
      CONSTRAINT outbox_delivery_replays_attempts_check CHECK (previous_attempts >= 0),
      CONSTRAINT outbox_delivery_replays_request_id_check CHECK (length(btrim(request_id)) > 0),
      CONSTRAINT outbox_delivery_replays_reason_check CHECK (length(btrim(reason)) > 0 AND length(reason) <= 500)
    )`)
    await queryRunner.query(`CREATE INDEX outbox_delivery_replays_delivery_idx
      ON outbox_delivery_replays(event_id, consumer, replayed_at DESC)`)
    await queryRunner.query(`CREATE FUNCTION prevent_outbox_delivery_replay_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'outbox delivery replays are append-only' USING ERRCODE = '55000';
      END
      $$`)
    await queryRunner.query(`CREATE TRIGGER outbox_delivery_replays_immutable_guard
      BEFORE UPDATE OR DELETE ON outbox_delivery_replays
      FOR EACH ROW EXECUTE FUNCTION prevent_outbox_delivery_replay_mutation()`)

    await queryRunner.query(`CREATE TABLE public_offering_projection_state (
      offering_id uuid PRIMARY KEY REFERENCES catalog_offerings(id) ON DELETE RESTRICT,
      generation integer NOT NULL,
      last_invalidation_event_id uuid NOT NULL REFERENCES outbox_events(id) ON DELETE RESTRICT,
      invalidated_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT public_offering_projection_state_generation_check CHECK (generation > 0)
    )`)
    await queryRunner.query(`CREATE INDEX public_offering_projection_state_invalidated_idx
      ON public_offering_projection_state(invalidated_at DESC)`)
    await queryRunner.query(`CREATE FUNCTION guard_public_offering_projection_state_generation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        event_topic text; event_aggregate_type text; event_aggregate_id uuid;
      BEGIN
        SELECT topic, aggregate_type, aggregate_id INTO event_topic, event_aggregate_type, event_aggregate_id
          FROM outbox_events WHERE id = NEW.last_invalidation_event_id FOR KEY SHARE;
        IF event_topic IS DISTINCT FROM 'public.offering_projection.invalidated'
          OR event_aggregate_type IS DISTINCT FROM 'catalog_offering' OR event_aggregate_id IS DISTINCT FROM NEW.offering_id THEN
          RAISE EXCEPTION 'invalid offering projection invalidation state' USING ERRCODE = '23514';
        END IF;
        IF TG_OP = 'INSERT' AND NEW.generation <> 1 THEN
          RAISE EXCEPTION 'offering projection generation must start at one' USING ERRCODE = '23514';
        END IF;
        IF TG_OP = 'UPDATE' AND NEW.generation <= OLD.generation THEN
          RAISE EXCEPTION 'offering projection generation must increase monotonically' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END
      $$`)
    await queryRunner.query(`CREATE TRIGGER public_offering_projection_state_generation_guard
      BEFORE INSERT OR UPDATE ON public_offering_projection_state
      FOR EACH ROW EXECUTE FUNCTION guard_public_offering_projection_state_generation()`)
    await queryRunner.query(`CREATE FUNCTION prevent_public_offering_projection_state_delete()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'offering projection generation state is append-only' USING ERRCODE = '55000';
      END
      $$`)
    await queryRunner.query(`CREATE TRIGGER public_offering_projection_state_delete_guard
      BEFORE DELETE ON public_offering_projection_state
      FOR EACH ROW EXECUTE FUNCTION prevent_public_offering_projection_state_delete()`)

    await queryRunner.query(`CREATE TABLE public_offering_projection_invalidation_receipts (
      event_id uuid PRIMARY KEY REFERENCES outbox_events(id) ON DELETE RESTRICT,
      offering_id uuid NOT NULL REFERENCES catalog_offerings(id) ON DELETE RESTRICT,
      delivery_consumer text NOT NULL DEFAULT 'public_projection',
      delivery_epoch integer NOT NULL,
      delivery_attempt integer NOT NULL,
      generation integer NOT NULL,
      cache_tags text[] NOT NULL,
      tags_hash text NOT NULL,
      applied_at timestamptz NOT NULL,
      effect text NOT NULL,
      last_effect_at timestamptz,
      effect_attempts integer NOT NULL DEFAULT 0,
      provider_code text,
      provider_request_id text,
      CONSTRAINT public_offering_projection_receipts_delivery_fk FOREIGN KEY (event_id, delivery_consumer)
        REFERENCES outbox_deliveries(event_id, consumer) ON DELETE RESTRICT,
      CONSTRAINT public_offering_projection_receipts_consumer_check CHECK (delivery_consumer = 'public_projection'),
      CONSTRAINT public_offering_projection_receipts_epoch_check CHECK (delivery_epoch > 0),
      CONSTRAINT public_offering_projection_receipts_attempt_check CHECK (delivery_attempt > 0),
      CONSTRAINT public_offering_projection_receipts_generation_check CHECK (generation > 0),
      CONSTRAINT public_offering_projection_receipts_tags_hash_check CHECK (tags_hash ~ '^[a-f0-9]{64}$'),
      CONSTRAINT public_offering_projection_receipts_effect_attempts_check CHECK (effect_attempts >= 0),
      CONSTRAINT public_offering_projection_receipts_provider_code_check CHECK (provider_code IS NULL OR provider_code ~ '^[A-Z0-9][A-Z0-9_.:-]*$'),
      CONSTRAINT public_offering_projection_receipts_provider_request_id_check CHECK (provider_request_id IS NULL OR provider_request_id ~ '^[A-Za-z0-9._:-]+$'),
      CONSTRAINT public_offering_projection_receipts_effect_check CHECK (
        (effect = 'pending' AND effect_attempts = 0 AND last_effect_at IS NULL AND provider_code IS NULL AND provider_request_id IS NULL)
        OR (effect IN ('applied','failed') AND effect_attempts > 0 AND last_effect_at IS NOT NULL)
      ),
      CONSTRAINT public_offering_projection_receipts_generation_unique UNIQUE (offering_id, generation)
    )`)
    await queryRunner.query(`CREATE INDEX public_offering_projection_receipts_offering_idx
      ON public_offering_projection_invalidation_receipts(offering_id, applied_at DESC)`)
    await queryRunner.query(`CREATE FUNCTION guard_public_offering_projection_invalidation_receipt()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        event_topic text; event_aggregate_type text; event_aggregate_id uuid; offering_kind text; offering_archived_at timestamptz;
        delivery_status text; delivery_epoch_current integer; delivery_attempt_current integer;
        state_generation integer; state_event_id uuid;
        canonical_tags text[]; canonical_hash text;
      BEGIN
        SELECT topic, aggregate_type, aggregate_id INTO event_topic, event_aggregate_type, event_aggregate_id
          FROM outbox_events WHERE id = NEW.event_id FOR KEY SHARE;
        SELECT kind, archived_at INTO offering_kind, offering_archived_at FROM catalog_offerings WHERE id = NEW.offering_id FOR KEY SHARE;
        IF offering_archived_at IS NULL THEN
          canonical_tags := ARRAY['public-offering:' || NEW.offering_id::text, 'public-offering-kind:' || offering_kind, 'public-offering-collection'];
        ELSE
          canonical_tags := ARRAY['public-offering:' || NEW.offering_id::text, 'public-offering-collection'];
        END IF;
        canonical_hash := encode(sha256(convert_to(array_to_string(canonical_tags, E'\\n'), 'UTF8')), 'hex');
        IF TG_OP = 'INSERT' THEN
          SELECT status, delivery_epoch, attempts INTO delivery_status, delivery_epoch_current, delivery_attempt_current
            FROM outbox_deliveries WHERE event_id = NEW.event_id AND consumer = NEW.delivery_consumer FOR KEY SHARE;
          SELECT generation, last_invalidation_event_id INTO state_generation, state_event_id
            FROM public_offering_projection_state WHERE offering_id = NEW.offering_id FOR KEY SHARE;
          IF event_topic IS DISTINCT FROM 'public.offering_projection.invalidated'
            OR event_aggregate_type IS DISTINCT FROM 'catalog_offering' OR event_aggregate_id IS DISTINCT FROM NEW.offering_id
            OR delivery_status IS DISTINCT FROM 'processing' OR delivery_epoch_current IS DISTINCT FROM NEW.delivery_epoch
            OR delivery_attempt_current IS DISTINCT FROM NEW.delivery_attempt
            OR state_generation IS DISTINCT FROM NEW.generation OR state_event_id IS DISTINCT FROM NEW.event_id
            OR NEW.cache_tags <> canonical_tags OR NEW.tags_hash <> canonical_hash
            OR NEW.effect <> 'pending' THEN
            RAISE EXCEPTION 'invalid offering projection receipt' USING ERRCODE = '23514';
          END IF;
        ELSE
          IF NEW.event_id IS DISTINCT FROM OLD.event_id OR NEW.offering_id IS DISTINCT FROM OLD.offering_id
            OR NEW.delivery_consumer IS DISTINCT FROM OLD.delivery_consumer
            OR NEW.delivery_epoch IS DISTINCT FROM OLD.delivery_epoch OR NEW.delivery_attempt IS DISTINCT FROM OLD.delivery_attempt
            OR NEW.generation IS DISTINCT FROM OLD.generation OR NEW.cache_tags IS DISTINCT FROM OLD.cache_tags
            OR NEW.tags_hash IS DISTINCT FROM OLD.tags_hash OR NEW.applied_at IS DISTINCT FROM OLD.applied_at THEN
            RAISE EXCEPTION 'offering projection receipt core is immutable' USING ERRCODE = '55000';
          END IF;
          IF OLD.effect = 'applied' OR NEW.effect_attempts < OLD.effect_attempts
            OR (NEW.effect_attempts = OLD.effect_attempts AND (
              NEW.effect IS DISTINCT FROM OLD.effect OR NEW.last_effect_at IS DISTINCT FROM OLD.last_effect_at
              OR NEW.provider_code IS DISTINCT FROM OLD.provider_code OR NEW.provider_request_id IS DISTINCT FROM OLD.provider_request_id
            ))
            OR (NEW.effect_attempts > OLD.effect_attempts AND (
              NEW.effect = 'pending' OR NEW.last_effect_at IS NULL
              OR (OLD.last_effect_at IS NOT NULL AND NEW.last_effect_at < OLD.last_effect_at)
            )) THEN
            RAISE EXCEPTION 'offering projection receipt effect metadata is not monotonic' USING ERRCODE = '23514';
          END IF;
        END IF;
        RETURN NEW;
      END
      $$`)
    await queryRunner.query(`CREATE TRIGGER public_offering_projection_receipts_insert_guard
      BEFORE INSERT OR UPDATE ON public_offering_projection_invalidation_receipts
      FOR EACH ROW EXECUTE FUNCTION guard_public_offering_projection_invalidation_receipt()`)
    await queryRunner.query(`CREATE FUNCTION prevent_public_offering_projection_receipt_delete()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'offering projection invalidation receipts are append-only' USING ERRCODE = '55000';
      END
      $$`)
    await queryRunner.query(`CREATE TRIGGER public_offering_projection_receipts_delete_guard
      BEFORE DELETE ON public_offering_projection_invalidation_receipts
      FOR EACH ROW EXECUTE FUNCTION prevent_public_offering_projection_receipt_delete()`)
    await queryRunner.query(`CREATE FUNCTION guard_public_projection_delivery_completion()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE
        receipt_effect text;
        receipt_required boolean := false;
      BEGIN
        IF TG_OP = 'INSERT' THEN
          receipt_required := NEW.consumer = 'public_projection' AND NEW.status = 'succeeded';
        ELSIF TG_OP = 'UPDATE' THEN
          receipt_required := NEW.consumer = 'public_projection' AND NEW.status = 'succeeded' AND OLD.status IS DISTINCT FROM 'succeeded';
        END IF;
        IF receipt_required THEN
          SELECT effect INTO receipt_effect
            FROM public_offering_projection_invalidation_receipts
            WHERE event_id = NEW.event_id AND delivery_consumer = NEW.consumer
            FOR KEY SHARE;
          IF receipt_effect IS DISTINCT FROM 'applied' THEN
            RAISE EXCEPTION 'public projection delivery cannot succeed before an applied receipt exists' USING ERRCODE = '23514';
          END IF;
        END IF;
        RETURN NEW;
      END
      $$`)
    await queryRunner.query(`CREATE TRIGGER outbox_deliveries_public_projection_completion_guard
      BEFORE INSERT OR UPDATE OF status ON outbox_deliveries
      FOR EACH ROW EXECUTE FUNCTION guard_public_projection_delivery_completion()`)
    await queryRunner.query(`CREATE FUNCTION prevent_outbox_delivery_identity_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.event_id IS DISTINCT FROM OLD.event_id OR NEW.consumer IS DISTINCT FROM OLD.consumer THEN
          RAISE EXCEPTION 'outbox delivery identity is immutable' USING ERRCODE = '55000';
        END IF;
        RETURN NEW;
      END
      $$`)
    await queryRunner.query(`CREATE TRIGGER outbox_deliveries_identity_immutable_guard
      BEFORE UPDATE OF event_id, consumer ON outbox_deliveries
      FOR EACH ROW EXECUTE FUNCTION prevent_outbox_delivery_identity_mutation()`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Never erase DLQ/replay/attempt evidence during an operational rollback.
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM outbox_deliveries WHERE status = 'dead_letter')
        OR EXISTS (SELECT 1 FROM outbox_delivery_attempts)
        OR EXISTS (SELECT 1 FROM outbox_delivery_replays)
        OR EXISTS (SELECT 1 FROM public_offering_projection_invalidation_receipts)
        OR EXISTS (SELECT 1 FROM public_offering_projection_state) THEN
        RAISE EXCEPTION 'outbox delivery runtime contains forensic data; rollback is blocked';
      END IF;
    END $$`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS outbox_deliveries_identity_immutable_guard ON outbox_deliveries`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_outbox_delivery_identity_mutation()`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS outbox_deliveries_public_projection_completion_guard ON outbox_deliveries`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_public_projection_delivery_completion()`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS public_offering_projection_receipts_delete_guard ON public_offering_projection_invalidation_receipts`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_public_offering_projection_receipt_delete()`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS public_offering_projection_receipts_insert_guard ON public_offering_projection_invalidation_receipts`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_public_offering_projection_invalidation_receipt()`)
    await queryRunner.query(`DROP TABLE public_offering_projection_invalidation_receipts`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS public_offering_projection_state_delete_guard ON public_offering_projection_state`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_public_offering_projection_state_delete()`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS public_offering_projection_state_generation_guard ON public_offering_projection_state`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_public_offering_projection_state_generation()`)
    await queryRunner.query(`DROP TABLE public_offering_projection_state`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS outbox_delivery_replays_immutable_guard ON outbox_delivery_replays`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_outbox_delivery_replay_mutation()`)
    await queryRunner.query(`DROP TABLE outbox_delivery_replays`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS outbox_delivery_attempts_immutable_guard ON outbox_delivery_attempts`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_outbox_delivery_attempt_mutation()`)
    await queryRunner.query(`DROP TABLE outbox_delivery_attempts`)
    await queryRunner.query(`DROP INDEX outbox_deliveries_dead_letter_idx`)
    await queryRunner.query(`DROP INDEX outbox_deliveries_lease_expiry_idx`)
    await queryRunner.query(`DROP INDEX outbox_deliveries_ready_idx`)
    await queryRunner.query(`CREATE INDEX outbox_deliveries_ready_idx
      ON outbox_deliveries(consumer, available_at)
      WHERE status IN ('pending','failed')`)
    await queryRunner.query(`ALTER TABLE outbox_deliveries
      DROP CONSTRAINT outbox_deliveries_status_check,
      DROP CONSTRAINT outbox_deliveries_delivery_epoch_check,
      DROP CONSTRAINT outbox_deliveries_replay_count_check,
      DROP CONSTRAINT outbox_deliveries_max_attempts_check,
      DROP CONSTRAINT outbox_deliveries_lease_owner_check,
      DROP CONSTRAINT outbox_deliveries_error_code_check,
      DROP CONSTRAINT outbox_deliveries_completion_check,
      ADD CONSTRAINT outbox_deliveries_status_check CHECK (status IN ('pending','processing','succeeded','failed')),
      ADD CONSTRAINT outbox_deliveries_completion_check CHECK (
        (status = 'succeeded' AND processed_at IS NOT NULL AND last_error IS NULL)
        OR (status <> 'succeeded' AND processed_at IS NULL)
      ),
      DROP COLUMN dead_lettered_at,
      DROP COLUMN last_error_code,
      DROP COLUMN last_failure_at,
      DROP COLUMN last_attempt_at,
      DROP COLUMN lease_expires_at,
      DROP COLUMN lease_acquired_at,
      DROP COLUMN lease_owner,
      DROP COLUMN lease_token,
      DROP COLUMN max_attempts,
      DROP COLUMN replay_count,
      DROP COLUMN delivery_epoch`)
  }
}
