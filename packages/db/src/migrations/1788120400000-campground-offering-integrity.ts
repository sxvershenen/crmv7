import type { MigrationInterface, QueryRunner } from "typeorm"

/** Keeps ResourceGroup operational-only and validates the sellable campground member. */
export class CampgroundOfferingIntegrity1788120400000 implements MigrationInterface {
  name = "CampgroundOfferingIntegrity1788120400000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE UNIQUE INDEX resource_group_members_sellable_resource_unique
      ON resource_group_members(resource_id)
      WHERE archived_at IS NULL AND role IN ('owned_tent','own_tent_area')`)
    await queryRunner.query(`CREATE OR REPLACE FUNCTION cms_catalog_offering_source_link_guard() RETURNS trigger AS $$
      DECLARE offering_kind text; offering_version integer; node_kind text;
      BEGIN
        IF NEW.source_kind <> 'catalog_offering' THEN RETURN NEW; END IF;
        SELECT kind, version INTO offering_kind, offering_version FROM catalog_offerings WHERE id = NEW.source_id;
        IF offering_kind IS NULL THEN
          RAISE EXCEPTION 'catalog_offering source % does not exist', NEW.source_id USING ERRCODE = '23503';
        END IF;
        IF offering_kind NOT IN ('house','campground') THEN
          RAISE EXCEPTION 'catalog_offering source % must be a supported stay offering', NEW.source_id USING ERRCODE = '23514';
        END IF;
        IF NEW.source_version > offering_version THEN
          RAISE EXCEPTION 'catalog_offering source version % exceeds current version %', NEW.source_version, offering_version USING ERRCODE = '23514';
        END IF;
        SELECT kind INTO node_kind FROM cms_nodes WHERE id = NEW.node_id;
        IF node_kind IS NULL THEN
          RAISE EXCEPTION 'CMS node % does not exist', NEW.node_id USING ERRCODE = '23503';
        END IF;
        IF node_kind <> 'resource_detail' THEN
          RAISE EXCEPTION 'stay catalog_offering must link to resource_detail, got %', node_kind USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`)
    await queryRunner.query(`CREATE FUNCTION guard_campground_offering_binding()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE v_offering_kind text; v_sellable_unit text; v_inventory_mode text; v_resource_mode text; v_expected_role text; v_membership_count integer;
      BEGIN
        SELECT kind INTO v_offering_kind FROM catalog_offerings WHERE id = NEW.offering_id FOR SHARE;
        IF v_offering_kind IS DISTINCT FROM 'campground' THEN RETURN NEW; END IF;
        IF NEW.resource_id IS NULL OR NEW.resource_group_id IS NOT NULL OR NEW.program_template_id IS NOT NULL OR NEW.event_service_template_id IS NOT NULL THEN
          RAISE EXCEPTION 'campground offerings may bind only sellable Resource members, never ResourceGroup' USING ERRCODE = '23514';
        END IF;
        IF NEW.role IS DISTINCT FROM 'primary' OR NEW.archived_at IS NOT NULL THEN RETURN NEW; END IF;
        SELECT terms.sellable_unit, terms.inventory_mode INTO v_sellable_unit, v_inventory_mode
          FROM campground_offering_terms terms WHERE terms.offering_id = NEW.offering_id;
        SELECT resource.capacity_mode INTO v_resource_mode FROM resources resource WHERE resource.id = NEW.resource_id AND resource.archived_at IS NULL FOR SHARE;
        v_expected_role := CASE WHEN v_sellable_unit = 'owned_tent' THEN 'owned_tent' ELSE 'own_tent_area' END;
        IF v_sellable_unit IS NULL OR v_resource_mode IS NULL
          OR (v_sellable_unit = 'owned_tent' AND (v_inventory_mode <> 'discrete_inventory' OR v_resource_mode <> 'fixed'))
          OR (v_sellable_unit = 'own_tent_pitch' AND (v_inventory_mode <> 'shared_capacity' OR v_resource_mode <> 'shared')) THEN
          RAISE EXCEPTION 'campground primary Resource is incompatible with operational terms' USING ERRCODE = '23514';
        END IF;
        SELECT count(*) INTO v_membership_count
          FROM resource_group_members member
          JOIN resource_groups resource_group ON resource_group.id = member.group_id
          WHERE member.resource_id = NEW.resource_id AND member.role = v_expected_role
            AND member.archived_at IS NULL AND resource_group.archived_at IS NULL AND resource_group.state = 'active';
        IF v_membership_count <> 1 THEN
          RAISE EXCEPTION 'campground primary Resource must belong to exactly one active campground group with role %', v_expected_role USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END
      $$`)
    await queryRunner.query(`CREATE TRIGGER offering_bindings_campground_guard
      BEFORE INSERT OR UPDATE OF offering_id, resource_id, resource_group_id, program_template_id, event_service_template_id, role, archived_at
      ON offering_bindings FOR EACH ROW EXECUTE FUNCTION guard_campground_offering_binding()`)

    await queryRunner.query(`CREATE FUNCTION assert_campground_resource_integrity(v_resource_id uuid)
      RETURNS void LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM offering_bindings binding
          JOIN catalog_offerings offering ON offering.id = binding.offering_id AND offering.kind = 'campground' AND offering.archived_at IS NULL
          LEFT JOIN campground_offering_terms terms ON terms.offering_id = offering.id
          LEFT JOIN resources resource ON resource.id = binding.resource_id
          WHERE binding.resource_id = v_resource_id AND binding.role = 'primary' AND binding.archived_at IS NULL
            AND (
              terms.offering_id IS NULL OR resource.id IS NULL OR resource.archived_at IS NOT NULL
              OR (terms.sellable_unit = 'owned_tent' AND (terms.inventory_mode <> 'discrete_inventory' OR resource.capacity_mode <> 'fixed'))
              OR (terms.sellable_unit = 'own_tent_pitch' AND (terms.inventory_mode <> 'shared_capacity' OR resource.capacity_mode <> 'shared'))
              OR (SELECT count(*) FROM resource_group_members member
                  JOIN resource_groups resource_group ON resource_group.id = member.group_id
                  WHERE member.resource_id = binding.resource_id AND member.archived_at IS NULL
                    AND resource_group.archived_at IS NULL AND resource_group.state = 'active'
                    AND member.role = CASE WHEN terms.sellable_unit = 'owned_tent' THEN 'owned_tent' ELSE 'own_tent_area' END) <> 1
            )
        ) THEN
          RAISE EXCEPTION 'mutation would invalidate a live campground offering bound to Resource %', v_resource_id USING ERRCODE = '23514';
        END IF;
      END
      $$`)
    await queryRunner.query(`CREATE FUNCTION guard_campground_resource_integrity()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN PERFORM assert_campground_resource_integrity(OLD.id); RETURN OLD; END IF;
        PERFORM assert_campground_resource_integrity(NEW.id);
        RETURN NEW;
      END
      $$`)
    await queryRunner.query(`CREATE CONSTRAINT TRIGGER resources_campground_integrity_guard
      AFTER UPDATE OR DELETE ON resources DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION guard_campground_resource_integrity()`)

    await queryRunner.query(`CREATE FUNCTION guard_campground_membership_integrity()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP <> 'INSERT' AND OLD.resource_id IS NOT NULL THEN PERFORM assert_campground_resource_integrity(OLD.resource_id); END IF;
        IF TG_OP <> 'DELETE' AND NEW.resource_id IS NOT NULL THEN PERFORM assert_campground_resource_integrity(NEW.resource_id); END IF;
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END
      $$`)
    await queryRunner.query(`CREATE CONSTRAINT TRIGGER resource_group_members_campground_integrity_guard
      AFTER INSERT OR UPDATE OR DELETE ON resource_group_members DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION guard_campground_membership_integrity()`)

    await queryRunner.query(`CREATE FUNCTION guard_campground_group_integrity()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE member_resource_id uuid;
      BEGIN
        FOR member_resource_id IN SELECT resource_id FROM resource_group_members WHERE group_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END LOOP
          PERFORM assert_campground_resource_integrity(member_resource_id);
        END LOOP;
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END
      $$`)
    await queryRunner.query(`CREATE CONSTRAINT TRIGGER resource_groups_campground_integrity_guard
      AFTER UPDATE OR DELETE ON resource_groups DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION guard_campground_group_integrity()`)

    await queryRunner.query(`CREATE FUNCTION guard_campground_terms_integrity()
      RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE primary_resource_id uuid;
      BEGIN
        SELECT resource_id INTO primary_resource_id FROM offering_bindings
          WHERE offering_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.offering_id ELSE NEW.offering_id END AND role = 'primary' AND archived_at IS NULL;
        IF primary_resource_id IS NOT NULL THEN PERFORM assert_campground_resource_integrity(primary_resource_id); END IF;
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END
      $$`)
    await queryRunner.query(`CREATE CONSTRAINT TRIGGER campground_terms_integrity_guard
      AFTER INSERT OR UPDATE OR DELETE ON campground_offering_terms DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION guard_campground_terms_integrity()`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS campground_terms_integrity_guard ON campground_offering_terms`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_campground_terms_integrity()`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS resource_groups_campground_integrity_guard ON resource_groups`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_campground_group_integrity()`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS resource_group_members_campground_integrity_guard ON resource_group_members`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_campground_membership_integrity()`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS resources_campground_integrity_guard ON resources`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_campground_resource_integrity()`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS assert_campground_resource_integrity(uuid)`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS offering_bindings_campground_guard ON offering_bindings`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_campground_offering_binding()`)
    await queryRunner.query(`DROP INDEX IF EXISTS resource_group_members_sellable_resource_unique`)
    await queryRunner.query(`CREATE OR REPLACE FUNCTION cms_catalog_offering_source_link_guard() RETURNS trigger AS $$
      DECLARE offering_kind text; offering_version integer; node_kind text;
      BEGIN
        IF NEW.source_kind <> 'catalog_offering' THEN RETURN NEW; END IF;
        SELECT kind, version INTO offering_kind, offering_version FROM catalog_offerings WHERE id = NEW.source_id;
        IF offering_kind IS NULL THEN
          RAISE EXCEPTION 'catalog_offering source % does not exist', NEW.source_id USING ERRCODE = '23503';
        END IF;
        IF offering_kind <> 'house' THEN
          RAISE EXCEPTION 'catalog_offering source % must be a house in v1', NEW.source_id USING ERRCODE = '23514';
        END IF;
        IF NEW.source_version > offering_version THEN
          RAISE EXCEPTION 'catalog_offering source version % exceeds current version %', NEW.source_version, offering_version USING ERRCODE = '23514';
        END IF;
        SELECT kind INTO node_kind FROM cms_nodes WHERE id = NEW.node_id;
        IF node_kind IS NULL THEN
          RAISE EXCEPTION 'CMS node % does not exist', NEW.node_id USING ERRCODE = '23503';
        END IF;
        IF node_kind <> 'resource_detail' THEN
          RAISE EXCEPTION 'house catalog_offering must link to resource_detail, got %', node_kind USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`)
  }
}
