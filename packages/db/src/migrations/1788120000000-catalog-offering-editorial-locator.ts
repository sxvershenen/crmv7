import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * D-076 is intentionally forward-only: once a legacy source link has been
 * promoted, restoring the polymorphic resource identity would be ambiguous.
 */
export class CatalogOfferingEditorialLocator1788120000000 implements MigrationInterface {
  name = "CatalogOfferingEditorialLocator1788120000000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cms_source_links DROP CONSTRAINT cms_source_links_kind_check`)
    await queryRunner.query(`ALTER TABLE cms_source_links ADD CONSTRAINT cms_source_links_kind_check CHECK (source_kind IN ('resource','program_template','program_occurrence','event','program_category','event_category','catalog_offering'))`)

    await queryRunner.query(`CREATE FUNCTION cms_catalog_offering_source_link_guard() RETURNS trigger AS $$
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
    await queryRunner.query(`CREATE TRIGGER cms_catalog_offering_source_link_guard
      BEFORE INSERT OR UPDATE OF source_kind, source_id, source_version, node_id ON cms_source_links
      FOR EACH ROW EXECUTE FUNCTION cms_catalog_offering_source_link_guard()`)

    await queryRunner.query(`CREATE FUNCTION cms_catalog_offering_source_delete_guard() RETURNS trigger AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM cms_source_links WHERE source_kind = 'catalog_offering' AND source_id = OLD.id) THEN
          RAISE EXCEPTION 'catalog_offering % is referenced by a canonical CMS source link', OLD.id USING ERRCODE = '23503';
        END IF;
        RETURN OLD;
      END;
    $$ LANGUAGE plpgsql`)
    await queryRunner.query(`CREATE TRIGGER cms_catalog_offering_source_delete_guard
      BEFORE DELETE ON catalog_offerings FOR EACH ROW EXECUTE FUNCTION cms_catalog_offering_source_delete_guard()`)

    await queryRunner.query(`CREATE FUNCTION cms_catalog_offering_kind_update_guard() RETURNS trigger AS $$
      BEGIN
        IF NEW.kind <> OLD.kind AND EXISTS (SELECT 1 FROM cms_source_links WHERE source_kind = 'catalog_offering' AND source_id = OLD.id) THEN
          RAISE EXCEPTION 'kind of catalog_offering % is protected by its canonical CMS source link', OLD.id USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`)
    await queryRunner.query(`CREATE TRIGGER cms_catalog_offering_kind_update_guard
      BEFORE UPDATE OF kind ON catalog_offerings FOR EACH ROW EXECUTE FUNCTION cms_catalog_offering_kind_update_guard()`)

    await queryRunner.query(`CREATE FUNCTION cms_catalog_offering_node_kind_update_guard() RETURNS trigger AS $$
      BEGIN
        IF NEW.kind <> OLD.kind AND EXISTS (SELECT 1 FROM cms_source_links WHERE source_kind = 'catalog_offering' AND node_id = OLD.id) THEN
          RAISE EXCEPTION 'kind of CMS node % is protected by its canonical catalog offering link', OLD.id USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`)
    await queryRunner.query(`CREATE TRIGGER cms_catalog_offering_node_kind_update_guard
      BEFORE UPDATE OF kind ON cms_nodes FOR EACH ROW EXECUTE FUNCTION cms_catalog_offering_node_kind_update_guard()`)
  }

  async down(): Promise<void> {
    throw new Error("CatalogOfferingEditorialLocator1788120000000 is forward-only")
  }
}
