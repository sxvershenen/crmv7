import type { MigrationInterface, QueryRunner } from "typeorm"

export class AnalyticsConversionFacts1788205600000 implements MigrationInterface {
  name = "AnalyticsConversionFacts1788205600000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE analytics_conversion_facts (
        id uuid PRIMARY KEY,
        source_event_id uuid NOT NULL,
        kind text NOT NULL,
        occurred_at timestamptz NOT NULL,
        entity_id uuid NOT NULL,
        lead_id uuid,
        booking_id uuid,
        anonymous_visitor_id uuid,
        session_id uuid,
        release_id uuid,
        page_node_id uuid,
        attribution_model text NOT NULL,
        CONSTRAINT analytics_conversion_facts_source_event_unique UNIQUE(source_event_id),
        CONSTRAINT analytics_conversion_facts_source_event_fk FOREIGN KEY(source_event_id)
          REFERENCES outbox_events(id) ON DELETE RESTRICT,
        CONSTRAINT analytics_conversion_facts_kind_check
          CHECK (kind IN ('lead_created','booking_created','payment_recorded')),
        CONSTRAINT analytics_conversion_facts_attribution_model_check
          CHECK (attribution_model IN ('first_touch','last_touch','direct','unattributed')),
        CONSTRAINT analytics_conversion_facts_entity_shape_check CHECK (
          (kind = 'lead_created' AND lead_id IS NOT NULL AND lead_id = entity_id)
          OR (kind = 'booking_created' AND booking_id IS NOT NULL AND booking_id = entity_id)
          OR kind = 'payment_recorded'
        )
      )
    `)
    await queryRunner.query(`CREATE INDEX analytics_conversion_facts_occurred_kind_idx
      ON analytics_conversion_facts(occurred_at DESC, kind)`)
    await queryRunner.query(`CREATE INDEX analytics_conversion_facts_lead_idx
      ON analytics_conversion_facts(lead_id) WHERE lead_id IS NOT NULL`)
    await queryRunner.query(`CREATE INDEX analytics_conversion_facts_booking_idx
      ON analytics_conversion_facts(booking_id) WHERE booking_id IS NOT NULL`)
    await queryRunner.query(`CREATE INDEX analytics_conversion_facts_visitor_idx
      ON analytics_conversion_facts(anonymous_visitor_id) WHERE anonymous_visitor_id IS NOT NULL`)
    await queryRunner.query(`CREATE FUNCTION prevent_analytics_conversion_fact_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'analytics conversion facts are append-only' USING ERRCODE = '55000';
      END
      $$`)
    await queryRunner.query(`CREATE TRIGGER analytics_conversion_facts_immutable_guard
      BEFORE UPDATE OR DELETE ON analytics_conversion_facts
      FOR EACH ROW EXECUTE FUNCTION prevent_analytics_conversion_fact_mutation()`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM analytics_conversion_facts) THEN
        RAISE EXCEPTION 'analytics conversion facts contain append-only data; rollback is blocked';
      END IF;
    END $$`)
    await queryRunner.query(`DROP TRIGGER IF EXISTS analytics_conversion_facts_immutable_guard ON analytics_conversion_facts`)
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_analytics_conversion_fact_mutation()`)
    await queryRunner.query(`DROP TABLE analytics_conversion_facts`)
  }
}
