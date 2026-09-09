import type { MigrationInterface, QueryRunner } from "typeorm"

/** Adds the persisted operational dossier for reusable add-ons and their CMS locator boundary. */
export class AddonOperationalDossier1788120800000 implements MigrationInterface {
  name = "AddonOperationalDossier1788120800000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cms_nodes DROP CONSTRAINT cms_nodes_kind_check`)
    await queryRunner.query(`ALTER TABLE cms_nodes ADD CONSTRAINT cms_nodes_kind_check CHECK (kind IN ('home','landing','category','resource_listing','resource_detail','program_listing','program_detail','program_occurrence','event_listing','event_detail','article_listing','article','information','legal','custom_code_page','addon_detail'))`)

    await queryRunner.query(`ALTER TABLE addon_offering_terms
      ADD COLUMN applicable_offering_kinds text[],
      ADD COLUMN minimum_quantity integer,
      ADD COLUMN maximum_quantity integer,
      ADD COLUMN default_quantity integer,
      ADD COLUMN quantity_step integer`)
    await queryRunner.query(`CREATE FUNCTION addon_offering_kinds_are_unique(value text[]) RETURNS boolean
      LANGUAGE SQL IMMUTABLE STRICT AS $$
        SELECT cardinality(value) = (SELECT count(DISTINCT item) FROM unnest(value) AS items(item))
      $$`)
    await queryRunner.query(`UPDATE addon_offering_terms
      SET applicable_offering_kinds = ARRAY['house','campground','venue','event_service','program']::text[]
      WHERE applicable_offering_kinds IS NULL`)
    await queryRunner.query(`UPDATE addon_offering_terms
      SET minimum_quantity = COALESCE(minimum_quantity, 1),
          maximum_quantity = COALESCE(maximum_quantity, 100),
          default_quantity = COALESCE(default_quantity, 1),
          quantity_step = COALESCE(quantity_step, 1)
      WHERE service_type IN ('quantity_service','person_service')`)
    await queryRunner.query(`ALTER TABLE addon_offering_terms ALTER COLUMN applicable_offering_kinds SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE addon_offering_terms
      ADD CONSTRAINT addon_offering_terms_applicable_kinds_check CHECK (
        cardinality(applicable_offering_kinds) > 0
          AND applicable_offering_kinds <@ ARRAY['house','campground','venue','event_service','program']::text[]
          AND addon_offering_kinds_are_unique(applicable_offering_kinds)
      ),
      ADD CONSTRAINT addon_offering_terms_quantity_range_check CHECK (
        (minimum_quantity IS NULL OR minimum_quantity > 0)
        AND (maximum_quantity IS NULL OR maximum_quantity > 0)
        AND (default_quantity IS NULL OR default_quantity > 0)
        AND (quantity_step IS NULL OR quantity_step > 0)
        AND (minimum_quantity IS NULL OR maximum_quantity IS NULL OR minimum_quantity <= maximum_quantity)
        AND (default_quantity IS NULL OR minimum_quantity IS NULL OR default_quantity >= minimum_quantity)
        AND (default_quantity IS NULL OR maximum_quantity IS NULL OR default_quantity <= maximum_quantity)
      ),
      ADD CONSTRAINT addon_offering_terms_quantity_required_check CHECK (
        service_type NOT IN ('quantity_service','person_service')
        OR (
          minimum_quantity IS NOT NULL
          AND default_quantity IS NOT NULL
          AND quantity_step IS NOT NULL
        )
      ),
      ADD CONSTRAINT addon_offering_terms_quantity_step_check CHECK (
        service_type NOT IN ('quantity_service','person_service')
        OR (
          MOD(default_quantity - minimum_quantity, quantity_step) = 0
          AND (maximum_quantity IS NULL OR MOD(maximum_quantity - minimum_quantity, quantity_step) = 0)
        )
      )`)

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
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM cms_nodes WHERE kind = 'addon_detail') THEN
          RAISE EXCEPTION 'AddonOperationalDossier cannot be reverted while addon_detail nodes exist';
        END IF;
      END
    $$`)
    await queryRunner.query(`CREATE OR REPLACE FUNCTION cms_catalog_offering_source_link_guard() RETURNS trigger AS $$
      DECLARE offering_kind text; offering_version integer; node_kind text;
      BEGIN
        IF NEW.source_kind <> 'catalog_offering' THEN RETURN NEW; END IF;
        SELECT kind, version INTO offering_kind, offering_version FROM catalog_offerings WHERE id = NEW.source_id;
        IF offering_kind IS NULL THEN RAISE EXCEPTION 'catalog_offering source % does not exist', NEW.source_id USING ERRCODE = '23503'; END IF;
        IF offering_kind NOT IN ('house','campground') THEN RAISE EXCEPTION 'catalog_offering source % must be a supported stay offering', NEW.source_id USING ERRCODE = '23514'; END IF;
        IF NEW.source_version > offering_version THEN RAISE EXCEPTION 'catalog_offering source version % exceeds current version %', NEW.source_version, offering_version USING ERRCODE = '23514'; END IF;
        SELECT kind INTO node_kind FROM cms_nodes WHERE id = NEW.node_id;
        IF node_kind IS NULL THEN RAISE EXCEPTION 'CMS node % does not exist', NEW.node_id USING ERRCODE = '23503'; END IF;
        IF node_kind <> 'resource_detail' THEN RAISE EXCEPTION 'stay catalog_offering must link to resource_detail, got %', node_kind USING ERRCODE = '23514'; END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`)
    await queryRunner.query(`ALTER TABLE addon_offering_terms
      DROP CONSTRAINT IF EXISTS addon_offering_terms_quantity_required_check,
      DROP CONSTRAINT IF EXISTS addon_offering_terms_quantity_step_check,
      DROP CONSTRAINT IF EXISTS addon_offering_terms_quantity_range_check,
      DROP CONSTRAINT IF EXISTS addon_offering_terms_applicable_kinds_check,
      DROP COLUMN IF EXISTS quantity_step,
      DROP COLUMN IF EXISTS default_quantity,
      DROP COLUMN IF EXISTS maximum_quantity,
      DROP COLUMN IF EXISTS minimum_quantity,
      DROP COLUMN IF EXISTS applicable_offering_kinds`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS addon_offering_kinds_are_unique(text[])`)
    await queryRunner.query(`ALTER TABLE cms_nodes DROP CONSTRAINT cms_nodes_kind_check`)
    await queryRunner.query(`ALTER TABLE cms_nodes ADD CONSTRAINT cms_nodes_kind_check CHECK (kind IN ('home','landing','category','resource_listing','resource_detail','program_listing','program_detail','program_occurrence','event_listing','event_detail','article_listing','article','information','legal','custom_code_page'))`)
  }
}
