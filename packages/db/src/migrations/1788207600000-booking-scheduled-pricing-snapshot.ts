import type { MigrationInterface, QueryRunner } from "typeorm"

/** Keep the tariff used by each newly priced bath item without changing historical manual bookings. */
export class BookingScheduledPricingSnapshot1788207600000 implements MigrationInterface {
  name = "BookingScheduledPricingSnapshot1788207600000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE booking_items ADD COLUMN pricing_snapshot jsonb`)
    await queryRunner.query(`ALTER TABLE booking_items ADD CONSTRAINT booking_items_pricing_snapshot_check CHECK (
      pricing_snapshot IS NULL OR (
        type = 'bath' AND jsonb_typeof(pricing_snapshot) = 'object'
        AND pricing_snapshot ?& ARRAY['offeringId','offeringVersion','pricingVersion','priceBookId','priceBookVersion','ratePlanId','ratePlanVersion','ratePlanKey','pricingBasis','unitAmountMinor','totalAmountMinor','billableHours']
      )
    )`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(`SELECT EXISTS (SELECT 1 FROM booking_items WHERE pricing_snapshot IS NOT NULL) AS unsafe`) as Array<{ unsafe: boolean }>
    if (rows[0]?.unsafe) throw new Error("BookingScheduledPricingSnapshot rollback is unsafe while priced bath bookings exist")
    await queryRunner.query(`ALTER TABLE booking_items DROP CONSTRAINT booking_items_pricing_snapshot_check`)
    await queryRunner.query(`ALTER TABLE booking_items DROP COLUMN pricing_snapshot`)
  }
}
