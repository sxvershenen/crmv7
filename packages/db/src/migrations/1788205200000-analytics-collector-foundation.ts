import type { MigrationInterface, QueryRunner } from "typeorm"

export class AnalyticsCollectorFoundation1788205200000 implements MigrationInterface {
  name = "AnalyticsCollectorFoundation1788205200000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE analytics_ingest_dedup (
        event_id uuid PRIMARY KEY,
        request_hash text NOT NULL,
        received_at timestamptz NOT NULL,
        CONSTRAINT analytics_ingest_dedup_hash_check CHECK (length(request_hash) = 64)
      )
    `)
    await queryRunner.query(`CREATE INDEX analytics_ingest_dedup_received_idx ON analytics_ingest_dedup(received_at)`)
    await queryRunner.query(`
      CREATE TABLE analytics_events (
        id uuid PRIMARY KEY,
        event_id uuid NOT NULL REFERENCES analytics_ingest_dedup(event_id) ON DELETE RESTRICT,
        schema_version smallint NOT NULL,
        event_name text NOT NULL,
        occurred_at timestamptz NOT NULL,
        received_at timestamptz NOT NULL,
        visitor_id uuid NOT NULL,
        session_id uuid NOT NULL,
        consent text NOT NULL,
        purpose text NOT NULL,
        context jsonb NOT NULL,
        properties jsonb NOT NULL,
        attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
        normalized_referrer_host text,
        network_pseudonym text,
        user_agent_family text,
        device_class text NOT NULL,
        traffic_class text NOT NULL,
        CONSTRAINT analytics_events_event_unique UNIQUE(event_id),
        CONSTRAINT analytics_events_schema_check CHECK (schema_version > 0),
        CONSTRAINT analytics_events_consent_check CHECK (consent IN ('unknown','denied','analytics','analytics_and_marketing')),
        CONSTRAINT analytics_events_purpose_check CHECK (purpose IN ('essential','analytics','marketing')),
        CONSTRAINT analytics_events_device_check CHECK (device_class IN ('mobile','desktop','unknown')),
        CONSTRAINT analytics_events_traffic_check CHECK (traffic_class IN ('human','bot','unknown')),
        CONSTRAINT analytics_events_network_pseudonym_check CHECK (network_pseudonym IS NULL OR network_pseudonym ~ '^[a-f0-9]{64}$')
      )
    `)
    await queryRunner.query(`CREATE INDEX analytics_events_received_idx ON analytics_events(received_at)`)
    await queryRunner.query(`CREATE INDEX analytics_events_session_idx ON analytics_events(session_id, occurred_at)`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS analytics_events`)
    await queryRunner.query(`DROP TABLE IF EXISTS analytics_ingest_dedup`)
  }
}
