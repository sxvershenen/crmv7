import type { MigrationInterface, QueryRunner } from "typeorm"

/** Keeps the selected service composition beside its immutable server quote. */
export class BookingItemAddons1788121600000 implements MigrationInterface {
  name = "BookingItemAddons1788121600000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE booking_items ADD COLUMN quote_snapshot_id uuid REFERENCES offering_quote_snapshots(id) ON DELETE RESTRICT`)
    await queryRunner.query(`ALTER TABLE booking_items ADD COLUMN addon_selections jsonb NOT NULL DEFAULT '[]'::jsonb`)
    await queryRunner.query(`ALTER TABLE booking_items ADD CONSTRAINT booking_items_addon_quote_check CHECK (
      (jsonb_typeof(addon_selections) = 'array')
      AND ((jsonb_array_length(addon_selections) = 0 AND quote_snapshot_id IS NULL) OR (jsonb_array_length(addon_selections) > 0 AND quote_snapshot_id IS NOT NULL))
    )`)
    await queryRunner.query(`CREATE INDEX booking_items_quote_snapshot_idx ON booking_items(quote_snapshot_id) WHERE quote_snapshot_id IS NOT NULL`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS booking_items_quote_snapshot_idx`)
    await queryRunner.query(`ALTER TABLE booking_items DROP CONSTRAINT IF EXISTS booking_items_addon_quote_check`)
    await queryRunner.query(`ALTER TABLE booking_items DROP COLUMN IF EXISTS addon_selections`)
    await queryRunner.query(`ALTER TABLE booking_items DROP COLUMN IF EXISTS quote_snapshot_id`)
  }
}
