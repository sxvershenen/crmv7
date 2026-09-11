import type { MigrationInterface, QueryRunner } from "typeorm"

/** Staging object identity for retryable processing and safe orphan cleanup. */
export class MediaHardening1788204000000 implements MigrationInterface {
  name = "MediaHardening1788204000000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE media_uploads ADD COLUMN staging_key text`)
    await queryRunner.query(`CREATE UNIQUE INDEX media_uploads_staging_key_unique ON media_uploads(staging_key) WHERE staging_key IS NOT NULL`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS media_uploads_staging_key_unique`)
    await queryRunner.query(`ALTER TABLE media_uploads DROP COLUMN IF EXISTS staging_key`)
  }
}
