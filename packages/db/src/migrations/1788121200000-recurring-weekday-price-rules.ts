import type { MigrationInterface, QueryRunner } from "typeorm"

/** Allows one compact recurring rule to target an explicit set of weekdays. */
export class RecurringWeekdayPriceRules1788121200000 implements MigrationInterface {
  name = "RecurringWeekdayPriceRules1788121200000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE price_rules DROP CONSTRAINT price_rules_selector_check`)
    await queryRunner.query(`ALTER TABLE price_rules ADD CONSTRAINT price_rules_selector_check CHECK (
      (selector = 'any_date' AND day_class IS NULL AND service_date_from IS NULL AND service_date_to_exclusive IS NULL AND selector_label IS NULL)
      OR (selector = 'day_class' AND day_class IN ('weekday','weekend') AND service_date_from IS NULL AND service_date_to_exclusive IS NULL AND selector_label IS NULL)
      OR (selector = 'recurring_weekdays' AND day_class IS NULL AND service_date_from IS NULL AND service_date_to_exclusive IS NULL
        AND selector_label ~ '^(mon|tue|wed|thu|fri|sat|sun)(,(mon|tue|wed|thu|fri|sat|sun))*$')
      OR (selector = 'calendar_holiday' AND day_class IS NULL AND service_date_from IS NULL AND service_date_to_exclusive IS NULL AND selector_label IS NULL)
      OR (selector = 'custom_date_override' AND day_class IS NULL AND service_date_from IS NOT NULL AND service_date_to_exclusive IS NOT NULL AND length(btrim(selector_label)) > 0)
    )`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM price_rules WHERE selector = 'recurring_weekdays') THEN
          RAISE EXCEPTION 'cannot remove recurring weekday selector while price rules use it';
        END IF;
      END
    $$`)
    await queryRunner.query(`ALTER TABLE price_rules DROP CONSTRAINT price_rules_selector_check`)
    await queryRunner.query(`ALTER TABLE price_rules ADD CONSTRAINT price_rules_selector_check CHECK (
      (selector = 'any_date' AND day_class IS NULL AND service_date_from IS NULL AND service_date_to_exclusive IS NULL AND selector_label IS NULL)
      OR (selector = 'day_class' AND day_class IN ('weekday','weekend') AND service_date_from IS NULL AND service_date_to_exclusive IS NULL AND selector_label IS NULL)
      OR (selector = 'calendar_holiday' AND day_class IS NULL AND service_date_from IS NULL AND service_date_to_exclusive IS NULL AND selector_label IS NULL)
      OR (selector = 'custom_date_override' AND day_class IS NULL AND service_date_from IS NOT NULL AND service_date_to_exclusive IS NOT NULL AND length(btrim(selector_label)) > 0)
    )`)
  }
}
