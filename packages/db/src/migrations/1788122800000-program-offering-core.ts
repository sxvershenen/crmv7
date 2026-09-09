import type { MigrationInterface, QueryRunner } from "typeorm"

export class ProgramOfferingCore1788122800000 implements MigrationInterface {
  name = "ProgramOfferingCore1788122800000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE program_occurrences
      ADD COLUMN rate_plan_override_id uuid REFERENCES rate_plans(id) ON DELETE RESTRICT`)

    await queryRunner.query(`ALTER TABLE offering_quote_snapshots
      ADD COLUMN quote_type text NOT NULL DEFAULT 'stay_preview',
      ADD COLUMN subject_version integer,
      ADD COLUMN program_template_id uuid REFERENCES program_templates(id) ON DELETE RESTRICT,
      ADD COLUMN program_template_version integer`)
    await queryRunner.query(`ALTER TABLE offering_quote_snapshots
      ADD CONSTRAINT offering_quote_snapshots_type_check CHECK (quote_type IN ('stay_preview','template_preview','program_registration')),
      ADD CONSTRAINT offering_quote_snapshots_program_pin_check CHECK (
        (quote_type IN ('template_preview','program_registration') AND subject_version IS NOT NULL AND program_template_id IS NOT NULL AND program_template_version IS NOT NULL)
        OR (quote_type = 'stay_preview' AND program_template_id IS NULL AND program_template_version IS NULL)
      )`)

    await queryRunner.query(`CREATE UNIQUE INDEX offering_bindings_one_live_program_primary_idx
      ON offering_bindings(program_template_id)
      WHERE role = 'primary' AND program_template_id IS NOT NULL AND archived_at IS NULL`)

    await queryRunner.query(`CREATE OR REPLACE FUNCTION cms_catalog_offering_source_link_guard() RETURNS trigger AS $$
      DECLARE offering_kind text; offering_version integer; node_kind text;
      BEGIN
        IF NEW.source_kind <> 'catalog_offering' THEN RETURN NEW; END IF;
        SELECT kind, version INTO offering_kind, offering_version FROM catalog_offerings WHERE id = NEW.source_id;
        IF offering_kind IS NULL THEN
          RAISE EXCEPTION 'catalog_offering source % does not exist', NEW.source_id USING ERRCODE = '23503';
        END IF;
        IF offering_kind NOT IN ('house','campground','addon','program') THEN
          RAISE EXCEPTION 'catalog_offering source % must be a supported editorial offering', NEW.source_id USING ERRCODE = '23514';
        END IF;
        IF NEW.source_version > offering_version THEN
          RAISE EXCEPTION 'catalog_offering source version % exceeds current version %', NEW.source_version, offering_version USING ERRCODE = '23514';
        END IF;
        SELECT kind INTO node_kind FROM cms_nodes WHERE id = NEW.node_id;
        IF node_kind IS NULL THEN
          RAISE EXCEPTION 'CMS node % does not exist', NEW.node_id USING ERRCODE = '23503';
        END IF;
        IF (offering_kind = 'addon' AND node_kind <> 'addon_detail')
          OR (offering_kind = 'program' AND node_kind <> 'program_detail')
          OR (offering_kind IN ('house','campground') AND node_kind <> 'resource_detail') THEN
          RAISE EXCEPTION 'catalog_offering kind % must link to its matching detail node, got %', offering_kind, node_kind USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`)

    await queryRunner.query(`CREATE OR REPLACE FUNCTION enforce_program_occurrence_rate_plan_override() RETURNS trigger AS $$
      BEGIN
        IF NEW.rate_plan_override_id IS NULL THEN RETURN NEW; END IF;
        IF NOT EXISTS (
          SELECT 1
          FROM rate_plans plan
          JOIN price_books book ON book.id = plan.price_book_id
          JOIN catalog_offerings offering ON offering.id = book.offering_id AND offering.kind = 'program' AND offering.archived_at IS NULL
          JOIN offering_bindings binding ON binding.offering_id = offering.id
            AND binding.role = 'primary' AND binding.archived_at IS NULL
            AND binding.program_template_id = NEW.template_id
          WHERE plan.id = NEW.rate_plan_override_id AND plan.archived_at IS NULL
            AND book.state IN ('active','scheduled') AND book.archived_at IS NULL
        ) THEN
          RAISE EXCEPTION 'Program occurrence rate-plan override must belong to its exact program offering' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`)
    await queryRunner.query(`CREATE TRIGGER program_occurrences_rate_plan_override_guard
      BEFORE INSERT OR UPDATE OF template_id, rate_plan_override_id ON program_occurrences
      FOR EACH ROW EXECUTE FUNCTION enforce_program_occurrence_rate_plan_override()`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS program_occurrences_rate_plan_override_guard ON program_occurrences`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS enforce_program_occurrence_rate_plan_override()`)
    await queryRunner.query(`CREATE OR REPLACE FUNCTION cms_catalog_offering_source_link_guard() RETURNS trigger AS $$
      DECLARE offering_kind text; offering_version integer; node_kind text;
      BEGIN
        IF NEW.source_kind <> 'catalog_offering' THEN RETURN NEW; END IF;
        SELECT kind, version INTO offering_kind, offering_version FROM catalog_offerings WHERE id = NEW.source_id;
        IF offering_kind IS NULL THEN
          RAISE EXCEPTION 'catalog_offering source % does not exist', NEW.source_id USING ERRCODE = '23503';
        END IF;
        IF offering_kind NOT IN ('house','campground','addon') THEN
          RAISE EXCEPTION 'catalog_offering source % must be a supported editorial offering', NEW.source_id USING ERRCODE = '23514';
        END IF;
        IF NEW.source_version > offering_version THEN
          RAISE EXCEPTION 'catalog_offering source version % exceeds current version %', NEW.source_version, offering_version USING ERRCODE = '23514';
        END IF;
        SELECT kind INTO node_kind FROM cms_nodes WHERE id = NEW.node_id;
        IF node_kind IS NULL THEN
          RAISE EXCEPTION 'CMS node % does not exist', NEW.node_id USING ERRCODE = '23503';
        END IF;
        IF (offering_kind = 'addon' AND node_kind <> 'addon_detail')
          OR (offering_kind IN ('house','campground') AND node_kind <> 'resource_detail') THEN
          RAISE EXCEPTION 'catalog_offering kind % must link to its matching detail node, got %', offering_kind, node_kind USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`)
    await queryRunner.query(`DROP INDEX IF EXISTS offering_bindings_one_live_program_primary_idx`)
    await queryRunner.query(`ALTER TABLE offering_quote_snapshots DROP CONSTRAINT IF EXISTS offering_quote_snapshots_program_pin_check`)
    await queryRunner.query(`ALTER TABLE offering_quote_snapshots DROP CONSTRAINT IF EXISTS offering_quote_snapshots_type_check`)
    await queryRunner.query(`ALTER TABLE offering_quote_snapshots DROP COLUMN IF EXISTS program_template_version`)
    await queryRunner.query(`ALTER TABLE offering_quote_snapshots DROP COLUMN IF EXISTS program_template_id`)
    await queryRunner.query(`ALTER TABLE offering_quote_snapshots DROP COLUMN IF EXISTS subject_version`)
    await queryRunner.query(`ALTER TABLE offering_quote_snapshots DROP COLUMN IF EXISTS quote_type`)
    await queryRunner.query(`ALTER TABLE program_occurrences DROP COLUMN IF EXISTS rate_plan_override_id`)
  }
}
