import type { MigrationInterface, QueryRunner } from "typeorm"

/** Replacement upload intent/CAS and server-resolved page metadata for media usages. */
export class MediaVersionedReplacements1788204400000 implements MigrationInterface {
  name = "MediaVersionedReplacements1788204400000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE media_uploads
      ADD COLUMN purpose text NOT NULL DEFAULT 'initial',
      ADD COLUMN expected_asset_version integer,
      ADD COLUMN base_blob_id uuid REFERENCES media_blobs(id) ON DELETE RESTRICT,
      ADD CONSTRAINT media_uploads_purpose_check CHECK (purpose IN ('initial','replacement')),
      ADD CONSTRAINT media_uploads_replacement_guard_check CHECK (
        (purpose = 'initial' AND expected_asset_version IS NULL AND base_blob_id IS NULL)
        OR (purpose = 'replacement' AND expected_asset_version > 0 AND base_blob_id IS NOT NULL)
      )`)
    await queryRunner.query(`CREATE INDEX media_uploads_asset_purpose_state_idx ON media_uploads(asset_id, purpose, state)`)

    await queryRunner.query(`ALTER TABLE media_usages
      ADD COLUMN page_id uuid REFERENCES cms_nodes(id) ON DELETE RESTRICT,
      ADD COLUMN path text,
      ADD CONSTRAINT media_usages_page_shape_check CHECK (
        (page_id IS NULL AND path IS NULL)
        OR (page_id IS NOT NULL AND path IS NOT NULL AND (path = '/' OR path ~ '^/([a-z0-9]+(-[a-z0-9]+)*)(/[a-z0-9]+(-[a-z0-9]+)*)*$'))
      )`)
    await queryRunner.query(`ALTER TABLE media_usages DROP CONSTRAINT media_usages_owner_pointer_unique`)
    await queryRunner.query(`CREATE UNIQUE INDEX media_usages_owner_page_pointer_unique ON media_usages(
      asset_id, owner_type, owner_id, COALESCE(page_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(path, ''), pointer
    )`)
    await queryRunner.query(`CREATE INDEX media_usages_asset_page_idx ON media_usages(asset_id, page_id, published)`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS media_usages_asset_page_idx`)
    await queryRunner.query(`DROP INDEX IF EXISTS media_usages_owner_page_pointer_unique`)
    await queryRunner.query(`DELETE FROM media_usages duplicate USING media_usages retained
      WHERE duplicate.id > retained.id AND duplicate.asset_id = retained.asset_id
        AND duplicate.owner_type = retained.owner_type AND duplicate.owner_id = retained.owner_id
        AND duplicate.pointer = retained.pointer`)
    await queryRunner.query(`ALTER TABLE media_usages DROP CONSTRAINT IF EXISTS media_usages_page_shape_check`)
    await queryRunner.query(`ALTER TABLE media_usages DROP COLUMN IF EXISTS path, DROP COLUMN IF EXISTS page_id`)
    await queryRunner.query(`ALTER TABLE media_usages ADD CONSTRAINT media_usages_owner_pointer_unique UNIQUE (asset_id, owner_type, owner_id, pointer)`)

    await queryRunner.query(`DROP INDEX IF EXISTS media_uploads_asset_purpose_state_idx`)
    await queryRunner.query(`ALTER TABLE media_uploads
      DROP CONSTRAINT IF EXISTS media_uploads_replacement_guard_check,
      DROP CONSTRAINT IF EXISTS media_uploads_purpose_check,
      DROP COLUMN IF EXISTS base_blob_id,
      DROP COLUMN IF EXISTS expected_asset_version,
      DROP COLUMN IF EXISTS purpose`)
  }
}
