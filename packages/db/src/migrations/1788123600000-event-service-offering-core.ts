import type { MigrationInterface, QueryRunner } from "typeorm"

/** P4.5 event-service dossier, typed preview pins and editorial mapping. */
export class EventServiceOfferingCore1788123600000 implements MigrationInterface {
  name = "EventServiceOfferingCore1788123600000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE offering_quote_snapshots
      ADD COLUMN event_service_template_id uuid REFERENCES event_service_templates(id) ON DELETE RESTRICT,
      ADD COLUMN event_service_template_version integer,
      ADD COLUMN offering_binding_id uuid REFERENCES offering_bindings(id) ON DELETE RESTRICT,
      ADD COLUMN offering_binding_version integer`)

    await queryRunner.query(`ALTER TABLE offering_quote_snapshots
      DROP CONSTRAINT offering_quote_snapshots_type_check,
      DROP CONSTRAINT offering_quote_snapshots_program_pin_check,
      ADD CONSTRAINT offering_quote_snapshots_type_check CHECK (quote_type IN ('stay_preview','template_preview','program_registration','event_service_preview')),
      ADD CONSTRAINT offering_quote_snapshots_subject_pin_check CHECK (
        (quote_type IN ('template_preview','program_registration')
          AND subject_version IS NOT NULL AND program_template_id IS NOT NULL AND program_template_version IS NOT NULL
          AND event_service_template_id IS NULL AND event_service_template_version IS NULL
          AND offering_binding_id IS NULL AND offering_binding_version IS NULL)
        OR (quote_type = 'event_service_preview'
          AND subject_version > 0 AND event_service_template_id IS NOT NULL AND event_service_template_version > 0
          AND offering_binding_id IS NOT NULL AND offering_binding_version > 0
          AND program_template_id IS NULL AND program_template_version IS NULL)
        OR (quote_type = 'stay_preview'
          AND program_template_id IS NULL AND program_template_version IS NULL
          AND event_service_template_id IS NULL AND event_service_template_version IS NULL
          AND offering_binding_id IS NULL AND offering_binding_version IS NULL)
      )`)

    await queryRunner.query(`CREATE FUNCTION guard_event_service_quote_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.quote_type <> 'event_service_preview' THEN RETURN NEW; END IF;

        IF NEW.subject_version <= 0 OR NEW.event_service_template_version <= 0 OR NEW.offering_binding_version <= 0
          OR NEW.program_template_id IS NOT NULL OR NEW.program_template_version IS NOT NULL THEN
          RAISE EXCEPTION 'event-service preview requires positive event pins and no program pins' USING ERRCODE = '23514';
        END IF;

        IF NEW.request_payload->>'quoteType' IS DISTINCT FROM 'event_service_preview'
          OR NEW.request_payload->>'offeringId' IS DISTINCT FROM NEW.offering_id::text
          OR NEW.request_payload->>'eventServiceTemplateId' IS DISTINCT FROM NEW.event_service_template_id::text
          OR NEW.result_payload->>'quoteType' IS DISTINCT FROM 'event_service_preview'
          OR NEW.result_payload->>'quoteId' IS DISTINCT FROM NEW.id::text
          OR NEW.result_payload->>'offeringId' IS DISTINCT FROM NEW.offering_id::text
          OR NEW.result_payload->>'eventServiceTemplateId' IS DISTINCT FROM NEW.event_service_template_id::text
          OR jsonb_typeof(NEW.result_payload->'acceptanceReady') IS DISTINCT FROM 'boolean'
          OR NEW.result_payload->'acceptanceReady' <> 'false'::jsonb
          OR NEW.result_payload#>>'{provenance,offeringVersion}' IS DISTINCT FROM NEW.offering_version::text
          OR NEW.result_payload#>>'{provenance,subjectVersion}' IS DISTINCT FROM NEW.subject_version::text
          OR NEW.result_payload#>>'{provenance,eventServiceTemplateVersion}' IS DISTINCT FROM NEW.event_service_template_version::text
          OR NEW.result_payload#>>'{provenance,offeringBindingId}' IS DISTINCT FROM NEW.offering_binding_id::text
          OR NEW.result_payload#>>'{provenance,offeringBindingVersion}' IS DISTINCT FROM NEW.offering_binding_version::text
          OR NEW.result_payload#>>'{provenance,pricingVersion}' IS DISTINCT FROM NEW.pricing_version::text
          OR NEW.result_payload#>>'{provenance,addOnsVersion}' IS DISTINCT FROM NEW.addon_assignments_version::text
          OR NEW.result_payload#>>'{provenance,priceBookId}' IS DISTINCT FROM NEW.price_book_id::text
          OR NEW.result_payload#>>'{provenance,priceBookVersion}' IS DISTINCT FROM NEW.price_book_version::text
          OR NEW.result_payload#>>'{provenance,businessCalendarId}' IS DISTINCT FROM NEW.business_calendar_id::text
          OR NEW.result_payload#>>'{provenance,businessCalendarVersion}' IS DISTINCT FROM NEW.business_calendar_version::text
          OR NEW.result_payload#>>'{provenance,businessCalendarSourceVersion}' IS DISTINCT FROM NEW.business_calendar_source_version THEN
          RAISE EXCEPTION 'event-service preview payload identity is inconsistent with pinned columns' USING ERRCODE = '23514';
        END IF;

        -- Only insertion resolves the current mutable binding. Persisted pins remain
        -- historical evidence and are never compared to mutable rows on reload.
        IF TG_OP = 'INSERT' AND NOT EXISTS (
          SELECT 1
          FROM offering_bindings binding
          JOIN catalog_offerings offering ON offering.id = binding.offering_id
          JOIN event_service_templates template ON template.id = binding.event_service_template_id
          WHERE binding.id = NEW.offering_binding_id
            AND binding.version = NEW.offering_binding_version
            AND binding.offering_id = NEW.offering_id
            AND binding.event_service_template_id = NEW.event_service_template_id
            AND binding.role = 'primary' AND binding.archived_at IS NULL
            AND offering.kind = 'event_service' AND offering.archived_at IS NULL
            AND offering.version = NEW.offering_version
            AND offering.subject_version = NEW.subject_version
            AND template.version = NEW.event_service_template_version
            AND template.archived_at IS NULL
        ) THEN
          RAISE EXCEPTION 'event-service preview requires the exact current primary binding identity' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END
    $$`)
    await queryRunner.query(`CREATE TRIGGER offering_quote_snapshots_event_service_payload_guard
      BEFORE INSERT OR UPDATE ON offering_quote_snapshots FOR EACH ROW EXECUTE FUNCTION guard_event_service_quote_snapshot()`)

    await queryRunner.query(`CREATE FUNCTION guard_event_service_preview_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.quote_type = 'event_service_preview' OR (TG_OP = 'UPDATE' AND NEW.quote_type = 'event_service_preview') THEN
          RAISE EXCEPTION 'event-service preview snapshots are immutable' USING ERRCODE = '55000';
        END IF;
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END
    $$`)
    await queryRunner.query(`CREATE TRIGGER offering_quote_snapshots_event_service_immutable_guard
      BEFORE UPDATE OR DELETE ON offering_quote_snapshots FOR EACH ROW EXECUTE FUNCTION guard_event_service_preview_immutable()`)

    await queryRunner.query(`CREATE UNIQUE INDEX offering_bindings_one_live_event_service_primary_idx
      ON offering_bindings(event_service_template_id)
      WHERE role = 'primary' AND event_service_template_id IS NOT NULL AND archived_at IS NULL`)

    await queryRunner.query(`CREATE FUNCTION guard_event_service_offering_binding() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE offering_kind text;
      BEGIN
        SELECT kind INTO offering_kind FROM catalog_offerings WHERE id = NEW.offering_id;
        IF offering_kind IS NULL THEN
          RAISE EXCEPTION 'catalog_offering % does not exist', NEW.offering_id USING ERRCODE = '23503';
        END IF;
        IF NEW.event_service_template_id IS NOT NULL AND offering_kind <> 'event_service' THEN
          RAISE EXCEPTION 'event service template binding requires an event_service offering' USING ERRCODE = '23514';
        END IF;
        IF offering_kind = 'event_service' AND NEW.role = 'primary' AND NEW.event_service_template_id IS NULL AND NEW.archived_at IS NULL THEN
          RAISE EXCEPTION 'event_service primary binding must target an EventServiceTemplate' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END
    $$`)
    await queryRunner.query(`CREATE TRIGGER offering_bindings_event_service_guard
      BEFORE INSERT OR UPDATE OF offering_id, role, resource_id, resource_group_id, program_template_id, event_service_template_id, archived_at
      ON offering_bindings FOR EACH ROW EXECUTE FUNCTION guard_event_service_offering_binding()`)

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
          OR (offering_kind IN ('house','campground') AND node_kind <> 'resource_detail')
          OR (offering_kind = 'event_service' AND node_kind <> 'event_detail') THEN
          RAISE EXCEPTION 'catalog_offering kind % must link to its matching detail node, got %', offering_kind, node_kind USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
    $$ LANGUAGE plpgsql`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const snapshots = await queryRunner.query(`SELECT EXISTS (
      SELECT 1 FROM offering_quote_snapshots WHERE quote_type = 'event_service_preview'
    ) AS exists`)
    const links = await queryRunner.query(`SELECT EXISTS (
      SELECT 1 FROM cms_source_links WHERE source_kind = 'catalog_offering'
        AND source_id IN (SELECT id FROM catalog_offerings WHERE kind = 'event_service')
    ) AS exists`)
    if (snapshots[0]?.exists || links[0]?.exists) {
      throw new Error("EventServiceOfferingCore rollback is unsafe while event-service snapshots or canonical CMS links exist")
    }

    await queryRunner.query(`DROP TRIGGER IF EXISTS offering_quote_snapshots_event_service_immutable_guard ON offering_quote_snapshots`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_event_service_preview_immutable()`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS offering_quote_snapshots_event_service_payload_guard ON offering_quote_snapshots`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_event_service_quote_snapshot()`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS offering_bindings_event_service_guard ON offering_bindings`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS guard_event_service_offering_binding()`)
    await queryRunner.query(`DROP INDEX IF EXISTS offering_bindings_one_live_event_service_primary_idx`)

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

    await queryRunner.query(`ALTER TABLE offering_quote_snapshots
      DROP CONSTRAINT IF EXISTS offering_quote_snapshots_subject_pin_check,
      DROP CONSTRAINT IF EXISTS offering_quote_snapshots_type_check,
      ADD CONSTRAINT offering_quote_snapshots_type_check CHECK (quote_type IN ('stay_preview','template_preview','program_registration')),
      ADD CONSTRAINT offering_quote_snapshots_program_pin_check CHECK (
        (quote_type IN ('template_preview','program_registration') AND subject_version IS NOT NULL AND program_template_id IS NOT NULL AND program_template_version IS NOT NULL)
        OR (quote_type = 'stay_preview' AND program_template_id IS NULL AND program_template_version IS NULL)
      )`)
    await queryRunner.query(`ALTER TABLE offering_quote_snapshots
      DROP COLUMN IF EXISTS offering_binding_version,
      DROP COLUMN IF EXISTS offering_binding_id,
      DROP COLUMN IF EXISTS event_service_template_version,
      DROP COLUMN IF EXISTS event_service_template_id`)
  }
}
