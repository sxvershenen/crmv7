import type { MigrationInterface, QueryRunner } from "typeorm"

/** A bath/chan is a Resource and keeps its existing resource_detail draft when a sellable offering is attached. */
export class ScheduledResourceEditorialLink1788207200000 implements MigrationInterface {
  name = "ScheduledResourceEditorialLink1788207200000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(sourceLinkGuard(true))
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const links: Array<{ exists: boolean }> = await queryRunner.query(`SELECT EXISTS (
      SELECT 1 FROM cms_source_links link
      JOIN catalog_offerings offering ON offering.id = link.source_id
      JOIN addon_offering_terms terms ON terms.offering_id = offering.id
      JOIN cms_nodes node ON node.id = link.node_id
      WHERE link.source_kind = 'catalog_offering' AND offering.kind = 'addon'
        AND terms.service_type = 'scheduled_resource' AND node.kind = 'resource_detail'
    ) AS exists`)
    if (links[0]?.exists) throw new Error("ScheduledResourceEditorialLink rollback is unsafe while bath/chan CMS links exist")
    await queryRunner.query(sourceLinkGuard(false))
  }
}

function sourceLinkGuard(allowScheduledResource: boolean): string {
  const addonNodeCheck = allowScheduledResource
    ? `((offering_kind = 'addon' AND offering_service_type = 'scheduled_resource' AND node_kind <> 'resource_detail')
          OR (offering_kind = 'addon' AND offering_service_type IS DISTINCT FROM 'scheduled_resource' AND node_kind <> 'addon_detail'))`
    : `(offering_kind = 'addon' AND node_kind <> 'addon_detail')`
  return `CREATE OR REPLACE FUNCTION cms_catalog_offering_source_link_guard() RETURNS trigger AS $$
    DECLARE offering_kind text; offering_version integer; offering_service_type text; node_kind text;
    BEGIN
      IF NEW.source_kind <> 'catalog_offering' THEN RETURN NEW; END IF;
      SELECT kind, version INTO offering_kind, offering_version FROM catalog_offerings WHERE id = NEW.source_id;
      IF offering_kind IS NULL THEN
        RAISE EXCEPTION 'catalog_offering source % does not exist', NEW.source_id USING ERRCODE = '23503';
      END IF;
      IF offering_kind NOT IN ('house','campground','addon','venue','program','event_service') THEN
        RAISE EXCEPTION 'catalog_offering source % must be a supported editorial offering', NEW.source_id USING ERRCODE = '23514';
      END IF;
      IF offering_kind = 'addon' THEN
        SELECT service_type INTO offering_service_type FROM addon_offering_terms WHERE offering_id = NEW.source_id;
        IF offering_service_type IS NULL THEN
          RAISE EXCEPTION 'addon catalog offering requires terms' USING ERRCODE = '23514';
        END IF;
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
      IF ${addonNodeCheck}
        OR (offering_kind = 'program' AND node_kind <> 'program_detail')
        OR (offering_kind IN ('house','campground','venue') AND node_kind <> 'resource_detail')
        OR (offering_kind = 'event_service' AND node_kind <> 'event_detail') THEN
        RAISE EXCEPTION 'catalog_offering kind % must link to its matching detail node, got %', offering_kind, node_kind USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
  $$ LANGUAGE plpgsql`
}
