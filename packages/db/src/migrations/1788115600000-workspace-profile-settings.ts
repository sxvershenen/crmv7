import type { MigrationInterface, QueryRunner } from "typeorm"

export class WorkspaceProfileSettings1788115600000 implements MigrationInterface {
  name = "WorkspaceProfileSettings1788115600000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN phone text NOT NULL DEFAULT '',
        ADD COLUMN timezone text NOT NULL DEFAULT 'Europe/Moscow',
        ADD COLUMN language text NOT NULL DEFAULT 'ru',
        ADD COLUMN browser_notifications boolean NOT NULL DEFAULT true,
        ADD COLUMN email_notifications boolean NOT NULL DEFAULT false,
        ADD COLUMN telegram_notifications boolean NOT NULL DEFAULT false,
        ADD COLUMN notify_conflicts boolean NOT NULL DEFAULT true,
        ADD COLUMN notify_new_leads boolean NOT NULL DEFAULT true,
        ADD COLUMN notify_overdue_tasks boolean NOT NULL DEFAULT true
    `)
    await queryRunner.query(`
      CREATE TABLE workspace_settings (
        id uuid PRIMARY KEY,
        version integer NOT NULL DEFAULT 1,
        organization jsonb NOT NULL DEFAULT '{}'::jsonb,
        operations jsonb NOT NULL DEFAULT '{}'::jsonb,
        site jsonb NOT NULL DEFAULT '{}'::jsonb,
        integrations jsonb NOT NULL DEFAULT '[]'::jsonb,
        staff_configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        created_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        updated_by uuid NULL REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT workspace_settings_version_positive CHECK (version > 0)
      )
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS workspace_settings`)
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS notify_overdue_tasks, DROP COLUMN IF EXISTS notify_new_leads, DROP COLUMN IF EXISTS notify_conflicts, DROP COLUMN IF EXISTS telegram_notifications, DROP COLUMN IF EXISTS email_notifications, DROP COLUMN IF EXISTS browser_notifications, DROP COLUMN IF EXISTS language, DROP COLUMN IF EXISTS timezone, DROP COLUMN IF EXISTS phone`)
  }
}
