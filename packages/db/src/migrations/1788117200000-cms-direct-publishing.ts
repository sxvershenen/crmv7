import type { MigrationInterface, QueryRunner } from "typeorm"

export class CmsDirectPublishing1788117200000 implements MigrationInterface {
  name = "CmsDirectPublishing1788117200000"
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cms_node_revisions ADD COLUMN hero jsonb NOT NULL DEFAULT '{"mode":"inherit"}'::jsonb`)
    await queryRunner.query(`CREATE TABLE cms_source_links (
      id uuid PRIMARY KEY, source_kind text NOT NULL, source_id uuid NOT NULL, source_version integer NOT NULL,
      node_id uuid NOT NULL REFERENCES cms_nodes(id) ON DELETE RESTRICT, sync_state text NOT NULL DEFAULT 'draft', created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT cms_source_links_kind_check CHECK (source_kind IN ('resource','program_template','program_occurrence','event','program_category','event_category')),
      CONSTRAINT cms_source_links_version_positive CHECK (source_version > 0), CONSTRAINT cms_source_links_state_check CHECK (sync_state = 'draft'),
      CONSTRAINT cms_source_links_source_unique UNIQUE (source_kind, source_id), CONSTRAINT cms_source_links_node_unique UNIQUE (node_id)
    )`)
    await queryRunner.query(`CREATE TABLE cms_site_settings (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz
    )`)
    await queryRunner.query(`INSERT INTO cms_site_settings(id) VALUES ('00000000-0000-4000-8000-000000000001')`)
    await queryRunner.query(`CREATE TABLE cms_site_settings_revisions (
      id uuid PRIMARY KEY, settings_id uuid NOT NULL REFERENCES cms_site_settings(id) ON DELETE RESTRICT, revision integer NOT NULL, state text NOT NULL,
      value jsonb NOT NULL, content_hash text NOT NULL, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT cms_site_settings_revisions_number_positive CHECK (revision > 0),
      CONSTRAINT cms_site_settings_revisions_state_check CHECK (state IN ('draft','published','superseded')),
      CONSTRAINT cms_site_settings_revisions_hash_check CHECK (content_hash ~ '^[a-f0-9]{64}$'),
      CONSTRAINT cms_site_settings_revisions_number_unique UNIQUE (settings_id, revision)
    )`)
    await queryRunner.query(`CREATE INDEX cms_site_settings_revisions_state_idx ON cms_site_settings_revisions(settings_id, state)`)
    await queryRunner.query(`CREATE UNIQUE INDEX cms_site_settings_one_draft_idx ON cms_site_settings_revisions(settings_id) WHERE state = 'draft'`)
    await queryRunner.query(`ALTER TABLE cms_releases ADD COLUMN site_settings_revision_id uuid REFERENCES cms_site_settings_revisions(id) ON DELETE RESTRICT`)
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE cms_releases DROP COLUMN IF EXISTS site_settings_revision_id`)
    await queryRunner.query(`DROP TABLE IF EXISTS cms_site_settings_revisions`)
    await queryRunner.query(`DROP TABLE IF EXISTS cms_site_settings`)
    await queryRunner.query(`DROP TABLE IF EXISTS cms_source_links`)
    await queryRunner.query(`ALTER TABLE cms_node_revisions DROP COLUMN IF EXISTS hero`)
  }
}
