import type { MigrationInterface, QueryRunner } from "typeorm"

export class PublicIntakeRateLimits1788204800000 implements MigrationInterface {
  name = "PublicIntakeRateLimits1788204800000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE public_intake_rate_limits (
        identifier_hash text NOT NULL,
        window_started_at timestamptz NOT NULL,
        request_count integer NOT NULL,
        expires_at timestamptz NOT NULL,
        CONSTRAINT public_intake_rate_limits_pk PRIMARY KEY(identifier_hash, window_started_at),
        CONSTRAINT public_intake_rate_limits_count_check CHECK (request_count > 0)
      )
    `)
    await queryRunner.query(`CREATE INDEX public_intake_rate_limits_expiry_idx ON public_intake_rate_limits(expires_at)`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS public_intake_rate_limits`)
  }
}
