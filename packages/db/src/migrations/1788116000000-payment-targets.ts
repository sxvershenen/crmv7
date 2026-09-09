import type { MigrationInterface, QueryRunner } from "typeorm"

/** Makes the immutable payment ledger target exactly one canonical aggregate. */
export class PaymentTargets1788116000000 implements MigrationInterface {
  name = "PaymentTargets1788116000000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE payments ALTER COLUMN booking_id DROP NOT NULL`)
    await queryRunner.query(`ALTER TABLE payments ADD COLUMN event_id uuid REFERENCES events(id) ON DELETE RESTRICT`)
    await queryRunner.query(`ALTER TABLE payments ADD COLUMN program_registration_id uuid REFERENCES program_registrations(id) ON DELETE RESTRICT`)
    await queryRunner.query(`ALTER TABLE payments ADD CONSTRAINT payments_exactly_one_target_check CHECK (num_nonnulls(booking_id, event_id, program_registration_id) = 1)`)
    await queryRunner.query(`CREATE INDEX payments_booking_created_idx ON payments(booking_id, created_at DESC) WHERE booking_id IS NOT NULL`)
    await queryRunner.query(`CREATE INDEX payments_event_created_idx ON payments(event_id, created_at DESC) WHERE event_id IS NOT NULL`)
    await queryRunner.query(`CREATE INDEX payments_program_registration_created_idx ON payments(program_registration_id, created_at DESC) WHERE program_registration_id IS NOT NULL`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS payments_program_registration_created_idx`)
    await queryRunner.query(`DROP INDEX IF EXISTS payments_event_created_idx`)
    await queryRunner.query(`DROP INDEX IF EXISTS payments_booking_created_idx`)
    await queryRunner.query(`ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_exactly_one_target_check`)
    await queryRunner.query(`ALTER TABLE payments DROP COLUMN IF EXISTS program_registration_id`)
    await queryRunner.query(`ALTER TABLE payments DROP COLUMN IF EXISTS event_id`)
    await queryRunner.query(`ALTER TABLE payments ALTER COLUMN booking_id SET NOT NULL`)
  }
}
