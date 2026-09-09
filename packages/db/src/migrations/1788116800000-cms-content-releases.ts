import type { MigrationInterface, QueryRunner } from "typeorm"

/** Adds revision-scoped CMS content and an atomic immutable release pointer. */
export class CmsContentReleases1788116800000 implements MigrationInterface {
  name = "CmsContentReleases1788116800000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE cms_nodes (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, kind text NOT NULL, status text NOT NULL DEFAULT 'active',
      created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
      CONSTRAINT cms_nodes_kind_check CHECK (kind IN ('home','landing','category','resource_listing','resource_detail','program_listing','program_detail','program_occurrence','event_listing','event_detail','article_listing','article','information','legal','custom_code_page')),
      CONSTRAINT cms_nodes_status_check CHECK (status IN ('active','archived'))
    )`)
    await queryRunner.query(`CREATE INDEX cms_nodes_kind_status_idx ON cms_nodes(kind, status)`)

    await queryRunner.query(`CREATE TABLE cms_node_revisions (
      id uuid PRIMARY KEY, node_id uuid NOT NULL REFERENCES cms_nodes(id) ON DELETE RESTRICT, revision integer NOT NULL,
      state text NOT NULL, path text NOT NULL, slug text NOT NULL, parent_node_id uuid REFERENCES cms_nodes(id) ON DELETE RESTRICT,
      sort_order integer NOT NULL DEFAULT 0, title text NOT NULL, summary text, sections jsonb NOT NULL DEFAULT '[]'::jsonb,
      seo jsonb NOT NULL DEFAULT '{}'::jsonb, relations jsonb NOT NULL DEFAULT '[]'::jsonb,
      schema_version integer NOT NULL, content_hash text NOT NULL, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT cms_node_revisions_revision_positive CHECK (revision > 0),
      CONSTRAINT cms_node_revisions_schema_version_positive CHECK (schema_version > 0),
      CONSTRAINT cms_node_revisions_state_check CHECK (state IN ('draft','review','approved','scheduled','published','superseded','archived')),
      CONSTRAINT cms_node_revisions_path_check CHECK (path = '/' OR path ~ '^/([a-z0-9]+(-[a-z0-9]+)*)(/[a-z0-9]+(-[a-z0-9]+)*)*$'),
      CONSTRAINT cms_node_revisions_slug_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
      CONSTRAINT cms_node_revisions_hash_check CHECK (content_hash ~ '^[a-f0-9]{64}$'),
      CONSTRAINT cms_node_revisions_node_revision_unique UNIQUE (node_id, revision),
      CONSTRAINT cms_node_revisions_id_node_unique UNIQUE (id, node_id),
      CONSTRAINT cms_node_revisions_parent_not_self CHECK (parent_node_id IS NULL OR parent_node_id <> node_id)
    )`)
    await queryRunner.query(`CREATE INDEX cms_node_revisions_node_state_idx ON cms_node_revisions(node_id, state)`)
    await queryRunner.query(`CREATE UNIQUE INDEX cms_node_revisions_one_draft_idx ON cms_node_revisions(node_id) WHERE state = 'draft'`)

    await queryRunner.query(`CREATE TABLE cms_releases (
      id uuid PRIMARY KEY, sequence integer NOT NULL, state text NOT NULL, base_release_id uuid REFERENCES cms_releases(id) ON DELETE RESTRICT,
      manifest_hash text NOT NULL, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz,
      CONSTRAINT cms_releases_sequence_positive CHECK (sequence > 0),
      CONSTRAINT cms_releases_sequence_unique UNIQUE (sequence),
      CONSTRAINT cms_releases_state_check CHECK (state IN ('draft','validating','ready','publishing','published','failed','superseded')),
      CONSTRAINT cms_releases_hash_check CHECK (manifest_hash ~ '^[a-f0-9]{64}$')
    )`)

    await queryRunner.query(`CREATE TABLE cms_release_items (
      id uuid PRIMARY KEY, release_id uuid NOT NULL REFERENCES cms_releases(id) ON DELETE CASCADE,
      path text NOT NULL, node_id uuid NOT NULL REFERENCES cms_nodes(id) ON DELETE RESTRICT,
      revision_id uuid NOT NULL,
      resolved_content_hash text NOT NULL, resolved_content jsonb NOT NULL, dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
      CONSTRAINT cms_release_items_release_path_unique UNIQUE (release_id, path),
      CONSTRAINT cms_release_items_revision_node_fk FOREIGN KEY (revision_id, node_id) REFERENCES cms_node_revisions(id, node_id) ON DELETE RESTRICT,
      CONSTRAINT cms_release_items_path_check CHECK (path = '/' OR path ~ '^/([a-z0-9]+(-[a-z0-9]+)*)(/[a-z0-9]+(-[a-z0-9]+)*)*$'),
      CONSTRAINT cms_release_items_hash_check CHECK (resolved_content_hash ~ '^[a-f0-9]{64}$')
    )`)
    await queryRunner.query(`CREATE INDEX cms_release_items_node_idx ON cms_release_items(node_id, revision_id)`)

    await queryRunner.query(`CREATE TABLE cms_active_release (
      singleton_key text PRIMARY KEY, release_id uuid REFERENCES cms_releases(id) ON DELETE RESTRICT,
      version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id),
      CONSTRAINT cms_active_release_singleton_check CHECK (singleton_key = 'public'),
      CONSTRAINT cms_active_release_version_positive CHECK (version > 0)
    )`)
    await queryRunner.query(`INSERT INTO cms_active_release(singleton_key, release_id) VALUES ('public', NULL)`)

    await queryRunner.query(`CREATE TABLE cms_public_profiles (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, kind text NOT NULL, entity_id uuid NOT NULL,
      node_id uuid NOT NULL REFERENCES cms_nodes(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
      CONSTRAINT cms_public_profiles_kind_check CHECK (kind IN ('resource','program_template','program_occurrence','public_event_offering','catalog_offering')),
      CONSTRAINT cms_public_profiles_entity_unique UNIQUE (kind, entity_id),
      CONSTRAINT cms_public_profiles_node_unique UNIQUE (node_id)
    )`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS cms_public_profiles`)
    await queryRunner.query(`DROP TABLE IF EXISTS cms_active_release`)
    await queryRunner.query(`DROP TABLE IF EXISTS cms_release_items`)
    await queryRunner.query(`DROP TABLE IF EXISTS cms_releases`)
    await queryRunner.query(`DROP TABLE IF EXISTS cms_node_revisions`)
    await queryRunner.query(`DROP TABLE IF EXISTS cms_nodes`)
  }
}
