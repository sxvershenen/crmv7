import type { MigrationInterface, QueryRunner } from "typeorm"

export class ProgramsEvents1788114000000 implements MigrationInterface {
  name = "ProgramsEvents1788114000000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS program_template_code_seq START WITH 1000`)
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS program_occurrence_code_seq START WITH 1000`)
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS program_registration_code_seq START WITH 1000`)
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS event_code_seq START WITH 1000`)
    await queryRunner.query(`CREATE TABLE program_templates (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, code text NOT NULL, name text NOT NULL,
      category_id uuid, duration_minutes integer NOT NULL, minimum_participants integer, participant_limit integer NOT NULL,
      registration_close_hours numeric, base_price_amount integer NOT NULL DEFAULT 0, currency text NOT NULL DEFAULT 'RUB',
      description text NOT NULL DEFAULT '', publication text NOT NULL DEFAULT 'draft', assignee_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
      stages jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
      CONSTRAINT program_templates_code_unique UNIQUE(code), CONSTRAINT program_templates_duration_check CHECK (duration_minutes > 0),
      CONSTRAINT program_templates_minimum_check CHECK (minimum_participants IS NULL OR minimum_participants >= 0),
      CONSTRAINT program_templates_limit_check CHECK (participant_limit > 0), CONSTRAINT program_templates_price_check CHECK (base_price_amount >= 0),
      CONSTRAINT program_templates_publication_check CHECK (publication IN ('draft','published','archived')), CONSTRAINT program_templates_currency_check CHECK (currency ~ '^[A-Z]{3}$')
    )`)
    await queryRunner.query(`CREATE TABLE program_occurrences (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, code text NOT NULL, template_id uuid NOT NULL REFERENCES program_templates(id), name text NOT NULL,
      starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, participant_limit integer NOT NULL, registration_limit integer NOT NULL,
      status text NOT NULL DEFAULT 'draft', currency text NOT NULL DEFAULT 'RUB', comment text NOT NULL DEFAULT '', assignee_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
      CONSTRAINT program_occurrences_code_unique UNIQUE(code), CONSTRAINT program_occurrences_interval_check CHECK (starts_at < ends_at),
      CONSTRAINT program_occurrences_participant_limit_check CHECK (participant_limit > 0), CONSTRAINT program_occurrences_registration_limit_check CHECK (registration_limit > 0),
      CONSTRAINT program_occurrences_status_check CHECK (status IN ('draft','open','closed','completed','cancelled')), CONSTRAINT program_occurrences_currency_check CHECK (currency ~ '^[A-Z]{3}$')
    )`)
    await queryRunner.query(`CREATE INDEX program_occurrences_template_idx ON program_occurrences(template_id,starts_at)`)
    await queryRunner.query(`CREATE TABLE program_registrations (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, code text NOT NULL, occurrence_id uuid NOT NULL REFERENCES program_occurrences(id), customer_id uuid,
      phone text NOT NULL DEFAULT '', participant_count integer NOT NULL, participant_names text NOT NULL DEFAULT '', total_amount integer NOT NULL DEFAULT 0,
      discount_amount integer NOT NULL DEFAULT 0, paid_amount integer NOT NULL DEFAULT 0, currency text NOT NULL DEFAULT 'RUB', status text NOT NULL DEFAULT 'new',
      promo text NOT NULL DEFAULT '', source text NOT NULL DEFAULT '', comment text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
      CONSTRAINT program_registrations_code_unique UNIQUE(code), CONSTRAINT program_registrations_participant_count_check CHECK (participant_count > 0),
      CONSTRAINT program_registrations_amount_check CHECK (total_amount >= 0 AND discount_amount >= 0 AND discount_amount <= total_amount AND paid_amount >= 0),
      CONSTRAINT program_registrations_status_check CHECK (status IN ('new','confirmed','paid','visited','cancelled')), CONSTRAINT program_registrations_currency_check CHECK (currency ~ '^[A-Z]{3}$')
    )`)
    await queryRunner.query(`CREATE INDEX program_registrations_occurrence_idx ON program_registrations(occurrence_id,created_at)`)
    await queryRunner.query(`CREATE TABLE events (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, code text NOT NULL, name text NOT NULL, category_id uuid, customer_id uuid, phone text NOT NULL DEFAULT '',
      starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, guest_count integer NOT NULL DEFAULT 0, total_amount integer NOT NULL DEFAULT 0, paid_amount integer NOT NULL DEFAULT 0,
      currency text NOT NULL DEFAULT 'RUB', status text NOT NULL DEFAULT 'inquiry', comment text NOT NULL DEFAULT '', requires_action boolean NOT NULL DEFAULT false,
      assignee_ids jsonb NOT NULL DEFAULT '[]'::jsonb, scenario jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
      CONSTRAINT events_code_unique UNIQUE(code), CONSTRAINT events_interval_check CHECK (starts_at < ends_at), CONSTRAINT events_guest_count_check CHECK (guest_count >= 0),
      CONSTRAINT events_amount_check CHECK (total_amount >= 0 AND paid_amount >= 0), CONSTRAINT events_status_check CHECK (status IN ('inquiry','planning','booked','completed','cancelled')), CONSTRAINT events_currency_check CHECK (currency ~ '^[A-Z]{3}$')
    )`)
    await queryRunner.query(`CREATE INDEX events_schedule_idx ON events(starts_at,ends_at)`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS events`)
    await queryRunner.query(`DROP TABLE IF EXISTS program_registrations`)
    await queryRunner.query(`DROP TABLE IF EXISTS program_occurrences`)
    await queryRunner.query(`DROP TABLE IF EXISTS program_templates`)
    await queryRunner.query(`DROP SEQUENCE IF EXISTS event_code_seq`)
    await queryRunner.query(`DROP SEQUENCE IF EXISTS program_registration_code_seq`)
    await queryRunner.query(`DROP SEQUENCE IF EXISTS program_occurrence_code_seq`)
    await queryRunner.query(`DROP SEQUENCE IF EXISTS program_template_code_seq`)
  }
}
