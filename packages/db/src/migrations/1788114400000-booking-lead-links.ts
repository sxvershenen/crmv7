import type { MigrationInterface, QueryRunner } from "typeorm"

export class BookingLeadLinks1788114400000 implements MigrationInterface {
  name = "BookingLeadLinks1788114400000"

  async up(queryRunner: QueryRunner): Promise<void> {
    // Older fixtures allowed arbitrary customer ids. Preserve them as NULL before
    // closing the referential-integrity gap for all existing customer relations.
    await queryRunner.query(`UPDATE bookings SET customer_id = NULL WHERE customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM customers WHERE customers.id = bookings.customer_id)`)
    await queryRunner.query(`UPDATE program_registrations SET customer_id = NULL WHERE customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM customers WHERE customers.id = program_registrations.customer_id)`)
    await queryRunner.query(`UPDATE events SET customer_id = NULL WHERE customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM customers WHERE customers.id = events.customer_id)`)
    await queryRunner.query(`ALTER TABLE bookings ADD CONSTRAINT bookings_customer_fk FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL`)
    await queryRunner.query(`ALTER TABLE program_registrations ADD CONSTRAINT program_registrations_customer_fk FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL`)
    await queryRunner.query(`ALTER TABLE events ADD CONSTRAINT events_customer_fk FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL`)
    await queryRunner.query(`CREATE TABLE booking_lead_links (
      id uuid PRIMARY KEY,
      booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE RESTRICT,
      method text NOT NULL,
      linked_at timestamptz NOT NULL DEFAULT now(),
      linked_by uuid REFERENCES users(id),
      unlinked_at timestamptz,
      unlinked_by uuid REFERENCES users(id),
      CONSTRAINT booking_lead_links_method_check CHECK (method IN ('manual','from_lead')),
      CONSTRAINT booking_lead_links_unlinked_pair_check CHECK ((unlinked_at IS NULL AND unlinked_by IS NULL) OR (unlinked_at IS NOT NULL AND unlinked_by IS NOT NULL))
    )`)
    await queryRunner.query(`CREATE UNIQUE INDEX booking_lead_links_active_booking_unique ON booking_lead_links(booking_id) WHERE unlinked_at IS NULL`)
    await queryRunner.query(`CREATE INDEX booking_lead_links_lead_history_idx ON booking_lead_links(lead_id, linked_at)`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS booking_lead_links_lead_history_idx`)
    await queryRunner.query(`DROP INDEX IF EXISTS booking_lead_links_active_booking_unique`)
    await queryRunner.query(`DROP TABLE IF EXISTS booking_lead_links`)
    await queryRunner.query(`ALTER TABLE events DROP CONSTRAINT IF EXISTS events_customer_fk`)
    await queryRunner.query(`ALTER TABLE program_registrations DROP CONSTRAINT IF EXISTS program_registrations_customer_fk`)
    await queryRunner.query(`ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_customer_fk`)
  }
}
