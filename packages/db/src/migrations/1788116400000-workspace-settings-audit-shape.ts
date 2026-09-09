import type { MigrationInterface, QueryRunner } from "typeorm"

/** Aligns workspace_settings with the shared mutable entity audit columns. */
export class WorkspaceSettingsAuditShape1788116400000 implements MigrationInterface {
  name = "WorkspaceSettingsAuditShape1788116400000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE workspace_settings ADD COLUMN archived_at timestamptz NULL`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE workspace_settings DROP COLUMN IF EXISTS archived_at`)
  }
}
