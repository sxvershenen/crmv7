import type { MigrationInterface, QueryRunner } from "typeorm"

/** Private originals, immutable public variants, scoped uploads and a revision-aware usage graph. */
export class MediaPlatform1788117600000 implements MigrationInterface {
  name = "MediaPlatform1788117600000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE media_assets (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, kind text NOT NULL, state text NOT NULL DEFAULT 'uploading',
      title text NOT NULL, alt text, caption text, credit text, license text, tags jsonb NOT NULL DEFAULT '[]'::jsonb,
      focal_point jsonb NOT NULL DEFAULT '{"x":0.5,"y":0.5}'::jsonb,
      original_filename text NOT NULL, mime_type text NOT NULL, byte_size integer NOT NULL, width integer, height integer,
      current_blob_id uuid, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
      CONSTRAINT media_assets_kind_check CHECK (kind IN ('image','svg','video','document')),
      CONSTRAINT media_assets_state_check CHECK (state IN ('uploading','processing','ready','failed','archived')),
      CONSTRAINT media_assets_byte_size_check CHECK (byte_size > 0 AND byte_size <= 100000000),
      CONSTRAINT media_assets_dimensions_check CHECK ((width IS NULL AND height IS NULL) OR (width > 0 AND width <= 20000 AND height > 0 AND height <= 20000)),
      CONSTRAINT media_assets_focal_point_check CHECK (
        jsonb_typeof(focal_point) = 'object' AND focal_point ? 'x' AND focal_point ? 'y'
        AND (focal_point->>'x')::numeric BETWEEN 0 AND 1 AND (focal_point->>'y')::numeric BETWEEN 0 AND 1
      )
    )`)
    await queryRunner.query(`CREATE INDEX media_assets_state_updated_idx ON media_assets(state, updated_at DESC)`)

    await queryRunner.query(`CREATE TABLE media_blobs (
      id uuid PRIMARY KEY, asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT, revision integer NOT NULL,
      checksum_sha256 text NOT NULL, mime_type text NOT NULL, byte_size integer NOT NULL, storage_key text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT media_blobs_revision_positive CHECK (revision > 0),
      CONSTRAINT media_blobs_hash_check CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'),
      CONSTRAINT media_blobs_asset_revision_unique UNIQUE (asset_id, revision),
      CONSTRAINT media_blobs_storage_key_unique UNIQUE (storage_key)
    )`)
    await queryRunner.query(`CREATE INDEX media_blobs_checksum_idx ON media_blobs(checksum_sha256)`)
    await queryRunner.query(`ALTER TABLE media_assets ADD CONSTRAINT media_assets_current_blob_fk FOREIGN KEY (current_blob_id) REFERENCES media_blobs(id) ON DELETE RESTRICT`)

    await queryRunner.query(`CREATE TABLE media_variants (
      id uuid PRIMARY KEY, asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
      blob_id uuid NOT NULL REFERENCES media_blobs(id) ON DELETE RESTRICT, format text NOT NULL,
      width integer NOT NULL, height integer NOT NULL, byte_size integer NOT NULL, storage_key text NOT NULL,
      content_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT media_variants_format_check CHECK (format IN ('webp','avif')),
      CONSTRAINT media_variants_dimensions_check CHECK (width > 0 AND width <= 20000 AND height > 0 AND height <= 20000),
      CONSTRAINT media_variants_byte_size_check CHECK (byte_size > 0),
      CONSTRAINT media_variants_hash_check CHECK (content_hash ~ '^[a-f0-9]{64}$'),
      CONSTRAINT media_variants_blob_format_width_unique UNIQUE (blob_id, format, width),
      CONSTRAINT media_variants_storage_key_unique UNIQUE (storage_key)
    )`)
    await queryRunner.query(`CREATE INDEX media_variants_asset_idx ON media_variants(asset_id)`)

    await queryRunner.query(`CREATE TABLE media_uploads (
      id uuid PRIMARY KEY, asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
      state text NOT NULL, filename text NOT NULL, mime_type text NOT NULL, byte_size integer NOT NULL,
      checksum_sha256 text NOT NULL, token_hash text NOT NULL, expires_at timestamptz NOT NULL,
      created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
      error_code text, error_message text,
      CONSTRAINT media_uploads_state_check CHECK (state IN ('pending','processing','completed','failed','expired')),
      CONSTRAINT media_uploads_size_check CHECK (byte_size > 0 AND byte_size <= 100000000),
      CONSTRAINT media_uploads_hash_check CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'),
      CONSTRAINT media_uploads_token_hash_check CHECK (token_hash ~ '^[a-f0-9]{64}$')
    )`)
    await queryRunner.query(`CREATE INDEX media_uploads_state_expiry_idx ON media_uploads(state, expires_at)`)

    await queryRunner.query(`CREATE TABLE media_processing_jobs (
      id uuid PRIMARY KEY, asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
      upload_id uuid NOT NULL REFERENCES media_uploads(id) ON DELETE RESTRICT,
      blob_id uuid REFERENCES media_blobs(id) ON DELETE RESTRICT, state text NOT NULL, attempts integer NOT NULL DEFAULT 0,
      available_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, finished_at timestamptz,
      error_code text, error_message text,
      CONSTRAINT media_processing_jobs_state_check CHECK (state IN ('queued','processing','completed','failed','dead_letter')),
      CONSTRAINT media_processing_jobs_attempts_check CHECK (attempts >= 0)
    )`)
    await queryRunner.query(`CREATE INDEX media_processing_jobs_claim_idx ON media_processing_jobs(state, available_at)`)

    await queryRunner.query(`CREATE TABLE media_usages (
      id uuid PRIMARY KEY, asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
      owner_type text NOT NULL, owner_id uuid NOT NULL, pointer text NOT NULL, published boolean NOT NULL,
      detected_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT media_usages_owner_type_check CHECK (owner_type IN ('cms_revision','cms_site_settings_revision','cms_block_revision','code_artifact','release')),
      CONSTRAINT media_usages_owner_pointer_unique UNIQUE (asset_id, owner_type, owner_id, pointer)
    )`)
    await queryRunner.query(`CREATE INDEX media_usages_asset_published_idx ON media_usages(asset_id, published)`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS media_usages`)
    await queryRunner.query(`DROP TABLE IF EXISTS media_processing_jobs`)
    await queryRunner.query(`DROP TABLE IF EXISTS media_uploads`)
    await queryRunner.query(`DROP TABLE IF EXISTS media_variants`)
    await queryRunner.query(`ALTER TABLE media_assets DROP CONSTRAINT IF EXISTS media_assets_current_blob_fk`)
    await queryRunner.query(`DROP TABLE IF EXISTS media_blobs`)
    await queryRunner.query(`DROP TABLE IF EXISTS media_assets`)
  }
}
