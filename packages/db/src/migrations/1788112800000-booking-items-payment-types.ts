import type { MigrationInterface, QueryRunner } from "typeorm"

export class BookingItemsPaymentTypes1788112800000 implements MigrationInterface {
  name = "BookingItemsPaymentTypes1788112800000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS booking_code_seq START WITH 3000`)
    await queryRunner.query(`
      CREATE TABLE booking_items (
        id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1,
        booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        type text NOT NULL, resource_id uuid REFERENCES resources(id),
        start_at timestamptz NOT NULL, end_at timestamptz NOT NULL,
        quantity integer NOT NULL, price_amount integer NOT NULL, discount_amount integer NOT NULL,
        currency text NOT NULL, preparation_minutes integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
        updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
        CONSTRAINT booking_items_type_check CHECK (type IN ('accommodation','bath','venue','camping','program','service','other')),
        CONSTRAINT booking_items_interval_check CHECK (start_at < end_at),
        CONSTRAINT booking_items_quantity_check CHECK (quantity > 0),
        CONSTRAINT booking_items_amount_check CHECK (price_amount >= 0 AND discount_amount >= 0 AND discount_amount <= price_amount),
        CONSTRAINT booking_items_preparation_check CHECK (preparation_minutes BETWEEN 0 AND 1440),
        CONSTRAINT booking_items_currency_check CHECK (currency ~ '^[A-Z]{3}$')
      )
    `)
    await queryRunner.query(`CREATE INDEX booking_items_booking_idx ON booking_items(booking_id)`)
    await queryRunner.query(`CREATE INDEX booking_items_resource_interval_idx ON booking_items(resource_id,start_at,end_at)`)
    await queryRunner.query(`ALTER TABLE payments DROP CONSTRAINT payments_kind_check`)
    await queryRunner.query(`ALTER TABLE payments ADD CONSTRAINT payments_kind_check CHECK (kind IN ('charge','refund','adjustment'))`)
    await queryRunner.query(`ALTER TABLE payments DROP CONSTRAINT payments_refund_source_check`)
    await queryRunner.query(`ALTER TABLE payments ADD CONSTRAINT payments_refund_source_check CHECK ((kind = 'refund' AND source_payment_id IS NOT NULL) OR (kind <> 'refund' AND source_payment_id IS NULL))`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE payments DROP CONSTRAINT payments_refund_source_check`)
    await queryRunner.query(`ALTER TABLE payments ADD CONSTRAINT payments_refund_source_check CHECK ((kind = 'payment' AND source_payment_id IS NULL) OR (kind = 'refund' AND source_payment_id IS NOT NULL))`)
    await queryRunner.query(`ALTER TABLE payments DROP CONSTRAINT payments_kind_check`)
    await queryRunner.query(`ALTER TABLE payments ADD CONSTRAINT payments_kind_check CHECK (kind IN ('payment','refund'))`)
    await queryRunner.query(`DROP TABLE IF EXISTS booking_items`)
    await queryRunner.query(`DROP SEQUENCE IF EXISTS booking_code_seq`)
  }
}
