import type { MigrationInterface, QueryRunner } from "typeorm"

export class AlignCoreConstraints1788112400000 implements MigrationInterface {
  name = "AlignCoreConstraints1788112400000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS task_code_seq START WITH 1000`)
    await queryRunner.query(`ALTER TABLE users DROP CONSTRAINT users_role_check`)
    await queryRunner.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','manager','lead_manager','manager_supervisor','technical_admin','readonly'))`)
    await queryRunner.query(`ALTER TABLE tasks DROP CONSTRAINT tasks_status_check`)
    await queryRunner.query(`ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('open','completed','cancelled','todo','in_progress','review','done'))`)
    await queryRunner.query(`ALTER TABLE resource_allocations ADD COLUMN exclusive boolean NOT NULL DEFAULT true`)
    await queryRunner.query(`ALTER TABLE resource_allocations DROP CONSTRAINT resource_allocations_fixed_overlap_excl`)
    await queryRunner.query(`
      ALTER TABLE resource_allocations ADD CONSTRAINT resource_allocations_fixed_overlap_excl
      EXCLUDE USING gist (resource_id WITH =, tstzrange(start_at,end_at,'[)') WITH &&)
      WHERE (status = 'active' AND exclusive)
      DEFERRABLE INITIALLY IMMEDIATE
    `)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE resource_allocations DROP CONSTRAINT resource_allocations_fixed_overlap_excl`)
    await queryRunner.query(`ALTER TABLE resource_allocations DROP COLUMN exclusive`)
    await queryRunner.query(`
      ALTER TABLE resource_allocations ADD CONSTRAINT resource_allocations_fixed_overlap_excl
      EXCLUDE USING gist (resource_id WITH =, tstzrange(start_at,end_at,'[)') WITH &&)
      WHERE (status = 'active' AND capacity_impact > 0)
      DEFERRABLE INITIALLY IMMEDIATE
    `)
    await queryRunner.query(`ALTER TABLE tasks DROP CONSTRAINT tasks_status_check`)
    await queryRunner.query(`ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('todo','in_progress','review','done'))`)
    await queryRunner.query(`ALTER TABLE users DROP CONSTRAINT users_role_check`)
    await queryRunner.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','manager','supervisor','technical_admin','readonly'))`)
    await queryRunner.query(`DROP SEQUENCE IF EXISTS task_code_seq`)
  }
}
