import type { MigrationInterface, QueryRunner } from "typeorm"

export class NotificationReads1788115200000 implements MigrationInterface {
  name = "NotificationReads1788115200000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notification_reads (
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        change_log_id uuid NOT NULL REFERENCES change_log(id) ON DELETE CASCADE,
        read_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, change_log_id)
      )
    `)
    await queryRunner.query(`CREATE INDEX notification_reads_user_read_at_idx ON notification_reads(user_id, read_at DESC)`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notification_reads`)
  }
}
