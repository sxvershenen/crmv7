import type { MigrationInterface, QueryRunner } from "typeorm"

/** P4 venue: exact Resource binding and canonical resource-detail source links. */
export class VenueOfferingIntegrity1788124800000 implements MigrationInterface {
  name = "VenueOfferingIntegrity1788124800000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE FUNCTION guard_venue_offering_binding() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE offering_kind text; resource_kind text; resource_capacity_mode text; resource_capacity_total integer;
      BEGIN
        SELECT kind INTO offering_kind FROM catalog_offerings WHERE id = NEW.offering_id;
        IF offering_kind IS NULL THEN
          RAISE EXCEPTION 'catalog_offering % does not exist', NEW.offering_id USING ERRCODE = '23503';
        END IF;
        IF offering_kind <> 'venue' THEN RETURN NEW; END IF;
        IF NEW.resource_id IS NULL OR NEW.resource_group_id IS NOT NULL OR NEW.program_template_id IS NOT NULL OR NEW.event_service_template_id IS NOT NULL THEN
          RAISE EXCEPTION 'venue binding must target exactly one Resource' USING ERRCODE = '23514';
        END IF;
        SELECT kind, capacity_mode, capacity_total INTO resource_kind, resource_capacity_mode, resource_capacity_total
        FROM resources WHERE id = NEW.resource_id AND archived_at IS NULL;
        IF resource_kind IS NULL OR resource_kind NOT IN ('venue','venues') OR resource_capacity_mode <> 'fixed' OR resource_capacity_total <= 0 THEN
          RAISE EXCEPTION 'venue binding requires an active fixed Resource kind=venues with positive capacity' USING ERRCODE = '23514';
        END IF;
        IF NEW.role = 'primary' AND NEW.archived_at IS NULL AND (NEW.quantity_default <> 1 OR NEW.capacity_impact_default <> 1 OR NEW.availability_required IS NOT TRUE) THEN
          RAISE EXCEPTION 'venue primary binding must reserve one available Resource' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END
    $$`)
    await queryRunner.query(`CREATE TRIGGER offering_bindings_venue_guard
      BEFORE INSERT OR UPDATE OF offering_id, resource_id, resource_group_id, program_template_id, event_service_template_id, role,
        quantity_default, capacity_impact_default, availability_required, archived_at
      ON offering_bindings FOR EACH ROW EXECUTE FUNCTION guard_venue_offering_binding()`)

    await queryRunner.query(`CREATE OR REPLACE FUNCTION cms_catalog_offering_source_link_guard() RETURNS trigger AS $$
      DECLARE offering_kind text; offering_version integer; node_kind text;
      BEGIN
        IF NEW.source_kind <> 'catalog_offering' THEN RETURN NEW; END IF;
        SELECT kind, version INTO offering_kind, offering_version FROM catalog_offerings WHERE id = NEW.source_id;
        IF offering_kind IS NULL THEN
          RAISE EXCEPTION 'catalog_offering source % does not exist', NEW.source_id USING ERRCODE = '23503';
        END IF;
        IF offering_kind NOT IN ('house','campground','addon','venue','program','event_service') THEN
          RAISE EXCEPTION 'catalog_offering source % must be a supported editorial offering', NEW.source_id USING ERRCODE = '23514';
        END IF;
        IF offering_kind = 'venue' AND NOT EXISTS (
          SELECT 1 FROM offering_bindings binding
          JOIN resources resource ON resource.id = binding.resource_id
          WHERE binding.offering_id = NEW.source_id AND binding.role = 'primary'
            AND binding.resource_id IS NOT NULL AND binding.archived_at IS NULL
            AND resource.kind IN ('venue','venues') AND resource.capacity_mode = 'fixed' AND resource.capacity_total > 0
            AND resource.archived_at IS NULL
        ) THEN
          RAISE EXCEPTION 'venue catalog offering requires an exact primary Resource binding' USING ERRCODE = '23514';
        END IF;
        IF offering_kind = 'event_service' AND NOT EXISTS (
          SELECT 1 FROM offering_bindings binding
          WHERE binding.offering_id = NEW.source_id AND binding.role = 'primary'
            AND binding.event_service_template_id IS NOT NULL AND binding.archived_at IS NULL
        ) THEN
          RAISE EXCEPTION 'event_service catalog offering requires an exact primary EventServiceTemplate binding' USING ERRCODE = '23514';
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
          OR (offering_kind IN ('house','campground','venue') AND node_kind <> 'resource_detail')
          OR (offering_kind = 'event_service' AND node_kind <> 'event_detail') THEN
          RAISE EXCEPTION 'catalog_offering kind % must link to its matching detail node, got %', offering_kind, node_kind USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const links = await queryRunner.query(`SELECT EXISTS (
      SELECT 1 FROM cms_source_links WHERE source_kind = 'catalog_offering'
        AND source_id IN (SELECT id FROM catalog_offerings WHERE kind = 'venue')
    ) AS exists`)
    if (links[0]?.exists) throw new Error("VenueOfferingIntegrity rollback is unsafe while venue canonical CMS links exist")
    await queryRunner.query(`DROP TRIGGER IF EXISTS offering_bindings_venue_guard ON offering_bindings`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_venue_offering_binding()`)
    await queryRunner.query(`CREATE OR REPLACE FUNCTION cms_catalog_offering_source_link_guard() RETURNS trigger AS $$
      DECLARE offering_kind text; offering_version integer; node_kind text;
      BEGIN
        IF NEW.source_kind <> 'catalog_offering' THEN RETURN NEW; END IF;
        SELECT kind, version INTO offering_kind, offering_version FROM catalog_offerings WHERE id = NEW.source_id;
        IF offering_kind IS NULL THEN
          RAISE EXCEPTION 'catalog_offering source % does not exist', NEW.source_id USING ERRCODE = '23503';
        END IF;
        IF offering_kind NOT IN ('house','campground','addon','program','event_service') THEN
          RAISE EXCEPTION 'catalog_offering source % must be a supported editorial offering', NEW.source_id USING ERRCODE = '23514';
        END IF;
        IF offering_kind = 'event_service' AND NOT EXISTS (
          SELECT 1 FROM offering_bindings binding WHERE binding.offering_id = NEW.source_id AND binding.role = 'primary'
            AND binding.event_service_template_id IS NOT NULL AND binding.archived_at IS NULL
        ) THEN
          RAISE EXCEPTION 'event_service catalog offering requires an exact primary EventServiceTemplate binding' USING ERRCODE = '23514';
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
          OR (offering_kind IN ('house','campground') AND node_kind <> 'resource_detail')
          OR (offering_kind = 'event_service' AND node_kind <> 'event_detail') THEN
          RAISE EXCEPTION 'catalog_offering kind % must link to its matching detail node, got %', offering_kind, node_kind USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`)
  }
}
