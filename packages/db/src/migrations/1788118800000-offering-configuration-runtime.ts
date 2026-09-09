import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * P4.5B-2 configuration integrity. Calendar authority remains one mutable,
 * audited aggregate while it is active; retirement freezes it permanently.
 */
export class OfferingConfigurationRuntime1788118800000 implements MigrationInterface {
  name = "OfferingConfigurationRuntime1788118800000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE business_calendars
      ADD COLUMN coverage_from date,
      ADD COLUMN coverage_to_exclusive date,
      ADD COLUMN content_hash text`)
    await queryRunner.query(`ALTER TABLE business_calendars
      ADD CONSTRAINT business_calendars_coverage_check CHECK (
        (coverage_from IS NULL AND coverage_to_exclusive IS NULL AND content_hash IS NULL)
        OR (coverage_from IS NOT NULL AND coverage_to_exclusive IS NOT NULL
          AND coverage_to_exclusive > coverage_from
          AND content_hash ~ '^[a-f0-9]{64}$')
      )`)
    await queryRunner.query(`CREATE INDEX business_calendars_state_coverage_idx
      ON business_calendars(state, coverage_from, coverage_to_exclusive)`)

    await queryRunner.query(`ALTER TABLE addon_offering_terms
      ADD COLUMN category_key text NOT NULL DEFAULT 'other',
      ADD CONSTRAINT addon_offering_terms_category_key_check CHECK (category_key ~ '^[a-z][a-z0-9_]*$')`)
    await queryRunner.query(`CREATE INDEX addon_offering_terms_category_idx ON addon_offering_terms(category_key)`)

    await queryRunner.query(`ALTER TABLE offering_addon_assignments
      ADD CONSTRAINT offering_addon_assignments_required_enabled_check CHECK (NOT required OR enabled),
      ADD CONSTRAINT offering_addon_assignments_required_recommended_check CHECK (NOT (required AND recommended))`)
    await queryRunner.query(`DROP INDEX IF EXISTS offering_addon_assignments_live_unique`)
    await queryRunner.query(`CREATE UNIQUE INDEX offering_addon_assignments_live_unique
      ON offering_addon_assignments(offering_id, addon_offering_id) WHERE archived_at IS NULL`)

    await queryRunner.query(`CREATE FUNCTION guard_business_calendar_lifecycle()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.state = 'retired' THEN
          RAISE EXCEPTION 'retired business calendar % is immutable', OLD.id USING ERRCODE = '55000';
        END IF;
        IF OLD.state = 'active' AND NEW.state = 'active' AND (
          NEW.coverage_from IS NULL OR NEW.coverage_to_exclusive IS NULL
          OR NEW.coverage_from > OLD.coverage_from
          OR NEW.coverage_to_exclusive < OLD.coverage_to_exclusive
        ) THEN
          RAISE EXCEPTION 'active business calendar coverage may not be shortened' USING ERRCODE = '23514';
        END IF;
        IF NEW.state = OLD.state THEN
          RETURN NEW;
        END IF;
        IF OLD.state = 'draft' AND NEW.state = 'active' THEN
          IF NEW.coverage_from IS NULL OR NEW.coverage_to_exclusive IS NULL OR NEW.content_hash IS NULL THEN
            RAISE EXCEPTION 'cannot activate business calendar % without covered content hash', OLD.id USING ERRCODE = '23514';
          END IF;
          RETURN NEW;
        END IF;
        IF OLD.state = 'active' AND NEW.state = 'retired' THEN
          IF EXISTS (
            SELECT 1 FROM catalog_offerings
            WHERE business_calendar_id = OLD.id AND archived_at IS NULL AND state <> 'archived'
          ) THEN
            RAISE EXCEPTION 'business calendar % remains assigned to non-archived offerings', OLD.id USING ERRCODE = '23514';
          END IF;
          RETURN NEW;
        END IF;
        RAISE EXCEPTION 'invalid business calendar lifecycle transition: % -> %', OLD.state, NEW.state USING ERRCODE = '23514';
      END
      $$`)
    await queryRunner.query(`CREATE TRIGGER business_calendars_lifecycle_guard
      BEFORE UPDATE OR DELETE ON business_calendars
      FOR EACH ROW EXECUTE FUNCTION guard_business_calendar_lifecycle()`)

    await queryRunner.query(`CREATE FUNCTION guard_business_calendar_date_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE calendar_state text; coverage_start date; coverage_end date;
      BEGIN
        IF TG_OP = 'UPDATE' AND NEW.calendar_id IS DISTINCT FROM OLD.calendar_id THEN
          RAISE EXCEPTION 'calendar date parent is immutable' USING ERRCODE = '23514';
        END IF;
        SELECT state, coverage_from, coverage_to_exclusive
          INTO calendar_state, coverage_start, coverage_end
          FROM business_calendars
          WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.calendar_id ELSE NEW.calendar_id END FOR SHARE;
        IF calendar_state IS NULL OR calendar_state = 'retired' THEN
          RAISE EXCEPTION 'cannot change dates of a retired or absent business calendar' USING ERRCODE = '55000';
        END IF;
        IF TG_OP IN ('INSERT', 'UPDATE') AND (
          coverage_start IS NULL OR coverage_end IS NULL
          OR NEW.local_date < coverage_start OR NEW.local_date >= coverage_end
        ) THEN
          RAISE EXCEPTION 'calendar date is outside declared coverage' USING ERRCODE = '23514';
        END IF;
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END
      $$`)
    await queryRunner.query(`CREATE TRIGGER business_calendar_dates_mutation_guard
      BEFORE INSERT OR UPDATE OR DELETE ON business_calendar_dates
      FOR EACH ROW EXECUTE FUNCTION guard_business_calendar_date_mutation()`)

    await queryRunner.query(`CREATE FUNCTION guard_business_calendar_override_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE calendar_state text; coverage_start date; coverage_end date; target_date date;
      BEGIN
        IF TG_OP = 'UPDATE' AND NEW.calendar_id IS DISTINCT FROM OLD.calendar_id THEN
          RAISE EXCEPTION 'calendar override parent is immutable' USING ERRCODE = '23514';
        END IF;
        SELECT state, coverage_from, coverage_to_exclusive
          INTO calendar_state, coverage_start, coverage_end
          FROM business_calendars
          WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.calendar_id ELSE NEW.calendar_id END FOR SHARE;
        IF calendar_state IS NULL OR calendar_state = 'retired' THEN
          RAISE EXCEPTION 'cannot change overrides of a retired or absent business calendar' USING ERRCODE = '55000';
        END IF;
        IF TG_OP IN ('INSERT', 'UPDATE') THEN
          target_date := NEW.local_date;
          IF coverage_start IS NULL OR target_date < coverage_start OR target_date >= coverage_end
            OR NOT EXISTS (SELECT 1 FROM business_calendar_dates WHERE calendar_id = NEW.calendar_id AND local_date = target_date) THEN
            RAISE EXCEPTION 'calendar override must target an imported day inside coverage' USING ERRCODE = '23514';
          END IF;
        END IF;
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END
      $$`)
    await queryRunner.query(`CREATE TRIGGER business_calendar_date_overrides_mutation_guard
      BEFORE INSERT OR UPDATE OR DELETE ON business_calendar_date_overrides
      FOR EACH ROW EXECUTE FUNCTION guard_business_calendar_override_mutation()`)

    await queryRunner.query(`CREATE FUNCTION guard_offering_addon_assignment_target()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE addon_kind text; addon_state text; addon_archived_at timestamptz; addon_scope text; addon_owner uuid;
      BEGIN
        SELECT kind, state, archived_at, scope, owner_offering_id
          INTO addon_kind, addon_state, addon_archived_at, addon_scope, addon_owner
          FROM catalog_offerings WHERE id = NEW.addon_offering_id FOR SHARE;
        IF addon_kind IS DISTINCT FROM 'addon' OR addon_state = 'archived' OR addon_archived_at IS NOT NULL THEN
          RAISE EXCEPTION 'add-on assignment target must be a non-archived add-on offering' USING ERRCODE = '23514';
        END IF;
        IF NEW.enabled AND addon_state IS DISTINCT FROM 'active' THEN
          RAISE EXCEPTION 'enabled add-on assignment target must be active' USING ERRCODE = '23514';
        END IF;
        IF addon_scope = 'offering_specific' AND addon_owner IS DISTINCT FROM NEW.offering_id THEN
          RAISE EXCEPTION 'offering-specific add-on may only be assigned to its owner offering' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END
      $$`)
    await queryRunner.query(`CREATE TRIGGER offering_addon_assignments_target_guard
      BEFORE INSERT OR UPDATE OF offering_id, addon_offering_id, enabled, required ON offering_addon_assignments
      FOR EACH ROW EXECUTE FUNCTION guard_offering_addon_assignment_target()`)

    await queryRunner.query(`CREATE FUNCTION guard_addon_offering_assignment_dependents()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM offering_addon_assignments assignment
          WHERE assignment.addon_offering_id = OLD.id
            AND assignment.archived_at IS NULL
            AND (
              NEW.kind IS DISTINCT FROM 'addon'
              OR NEW.state = 'archived'
              OR NEW.archived_at IS NOT NULL
              OR (assignment.enabled AND NEW.state IS DISTINCT FROM 'active')
              OR (NEW.scope = 'offering_specific' AND NEW.owner_offering_id IS DISTINCT FROM assignment.offering_id)
            )
        ) THEN
          RAISE EXCEPTION 'assigned add-on target may not become incompatible with its live assignments' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END
      $$`)
    await queryRunner.query(`CREATE TRIGGER catalog_offerings_addon_dependents_guard
      BEFORE UPDATE OF kind, state, archived_at, scope, owner_offering_id ON catalog_offerings
      FOR EACH ROW EXECUTE FUNCTION guard_addon_offering_assignment_dependents()`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS catalog_offerings_addon_dependents_guard ON catalog_offerings`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_addon_offering_assignment_dependents()`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS offering_addon_assignments_target_guard ON offering_addon_assignments`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_offering_addon_assignment_target()`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS business_calendar_date_overrides_mutation_guard ON business_calendar_date_overrides`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_business_calendar_override_mutation()`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS business_calendar_dates_mutation_guard ON business_calendar_dates`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_business_calendar_date_mutation()`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS business_calendars_lifecycle_guard ON business_calendars`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_business_calendar_lifecycle()`)
    await queryRunner.query(`DROP INDEX IF EXISTS offering_addon_assignments_live_unique`)
    await queryRunner.query(`CREATE UNIQUE INDEX offering_addon_assignments_live_unique ON offering_addon_assignments(offering_id, addon_offering_id) WHERE enabled AND archived_at IS NULL`)
    await queryRunner.query(`ALTER TABLE offering_addon_assignments DROP CONSTRAINT IF EXISTS offering_addon_assignments_required_recommended_check`)
    await queryRunner.query(`ALTER TABLE offering_addon_assignments DROP CONSTRAINT IF EXISTS offering_addon_assignments_required_enabled_check`)
    await queryRunner.query(`DROP INDEX IF EXISTS addon_offering_terms_category_idx`)
    await queryRunner.query(`ALTER TABLE addon_offering_terms DROP CONSTRAINT IF EXISTS addon_offering_terms_category_key_check`)
    await queryRunner.query(`ALTER TABLE addon_offering_terms DROP COLUMN IF EXISTS category_key`)
    await queryRunner.query(`DROP INDEX IF EXISTS business_calendars_state_coverage_idx`)
    await queryRunner.query(`ALTER TABLE business_calendars DROP CONSTRAINT IF EXISTS business_calendars_coverage_check`)
    await queryRunner.query(`ALTER TABLE business_calendars DROP COLUMN IF EXISTS content_hash, DROP COLUMN IF EXISTS coverage_to_exclusive, DROP COLUMN IF EXISTS coverage_from`)
  }
}
