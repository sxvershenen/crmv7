import type { MigrationInterface, QueryRunner } from "typeorm"

export class IdempotencyKeys1788113200000 implements MigrationInterface {
  name = "IdempotencyKeys1788113200000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE idempotency_keys ADD COLUMN idempotency_key text`)
    await queryRunner.query(`UPDATE idempotency_keys SET idempotency_key = operation_id::text WHERE idempotency_key IS NULL`)
    await queryRunner.query(`ALTER TABLE idempotency_keys ALTER COLUMN idempotency_key SET NOT NULL`)
    await queryRunner.query(`ALTER TABLE idempotency_keys ADD CONSTRAINT idempotency_scope_key_unique UNIQUE(scope,idempotency_key)`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE idempotency_keys DROP CONSTRAINT idempotency_scope_key_unique`)
    await queryRunner.query(`ALTER TABLE idempotency_keys DROP COLUMN idempotency_key`)
  }
}
