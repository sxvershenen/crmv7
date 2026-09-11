import type { MigrationInterface, QueryRunner } from "typeorm"

export class AnalyticsDailyAggregates1788206000000 implements MigrationInterface {
  name = "AnalyticsDailyAggregates1788206000000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE analytics_daily_aggregates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        period_date date NOT NULL,
        page_node_id uuid,
        section_key text,
        page_views integer NOT NULL DEFAULT 0,
        unique_visitors integer NOT NULL DEFAULT 0,
        actions integer NOT NULL DEFAULT 0,
        leads integer NOT NULL DEFAULT 0,
        bookings integer NOT NULL DEFAULT 0,
        payments integer NOT NULL DEFAULT 0,
        computed_at timestamptz NOT NULL,
        CONSTRAINT analytics_daily_aggregates_dimension_unique
          UNIQUE NULLS NOT DISTINCT (period_date, page_node_id, section_key),
        CONSTRAINT analytics_daily_aggregates_counts_check CHECK (
          page_views >= 0
          AND unique_visitors >= 0
          AND actions >= 0
          AND leads >= 0
          AND bookings >= 0
          AND payments >= 0
        ),
        CONSTRAINT analytics_daily_aggregates_section_key_check CHECK (
          section_key IS NULL
          OR (length(section_key) <= 120 AND section_key ~ '^[a-z][a-z0-9._-]*$')
        )
      )
    `)
    await queryRunner.query(`CREATE INDEX analytics_daily_aggregates_period_idx
      ON analytics_daily_aggregates(period_date DESC)`)
    await queryRunner.query(`CREATE INDEX analytics_daily_aggregates_dimensions_idx
      ON analytics_daily_aggregates(page_node_id, section_key, period_date DESC)`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE analytics_daily_aggregates`)
  }
}
