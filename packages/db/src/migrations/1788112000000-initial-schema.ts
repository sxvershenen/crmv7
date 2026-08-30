import type { MigrationInterface, QueryRunner } from "typeorm"

export class InitialSchema1788112000000 implements MigrationInterface {
  name = "InitialSchema1788112000000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`)
    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1,
        email text NOT NULL, display_name text NOT NULL, password_hash text NOT NULL,
        role text NOT NULL, status text NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
        updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid, archived_at timestamptz,
        CONSTRAINT users_email_unique UNIQUE (email),
        CONSTRAINT users_role_check CHECK (role IN ('admin','manager','supervisor','technical_admin','readonly')),
        CONSTRAINT users_status_check CHECK (status IN ('active','blocked','invited','archived'))
      )
    `)
    await queryRunner.query(`
      CREATE TABLE sessions (
        id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL, last_seen_at timestamptz NOT NULL, created_at timestamptz NOT NULL
      )
    `)
    await queryRunner.query(`CREATE INDEX sessions_expires_at_idx ON sessions(expires_at)`)
    await queryRunner.query(`
      CREATE TABLE tasks (
        id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, code text NOT NULL,
        title text NOT NULL, details text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'todo',
        priority text NOT NULL DEFAULT 'normal', due_at timestamptz, reminder_minutes integer,
        relation jsonb NOT NULL DEFAULT '{}'::jsonb, assignees jsonb NOT NULL DEFAULT '[]'::jsonb,
        comment_count integer NOT NULL DEFAULT 0, latest_comment text, blocked boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
        updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
        CONSTRAINT tasks_code_unique UNIQUE(code),
        CONSTRAINT tasks_title_check CHECK (length(btrim(title)) > 0),
        CONSTRAINT tasks_status_check CHECK (status IN ('todo','in_progress','review','done')),
        CONSTRAINT tasks_priority_check CHECK (priority IN ('low','normal','high','urgent')),
        CONSTRAINT tasks_reminder_check CHECK (reminder_minutes IS NULL OR reminder_minutes >= 0)
      )
    `)
    await queryRunner.query(`CREATE INDEX tasks_due_at_idx ON tasks(due_at)`)
    await queryRunner.query(`
      CREATE TABLE resources (
        id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, code text NOT NULL,
        kind text NOT NULL, name text NOT NULL, capacity_mode text NOT NULL, capacity_total integer NOT NULL,
        settings jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
        updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
        CONSTRAINT resources_code_unique UNIQUE(code),
        CONSTRAINT resources_capacity_check CHECK (capacity_total >= 0),
        CONSTRAINT resources_mode_check CHECK (capacity_mode IN ('fixed','shared'))
      )
    `)
    await queryRunner.query(`
      CREATE TABLE bookings (
        id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, code text NOT NULL,
        customer_id uuid, status text NOT NULL DEFAULT 'draft', currency text NOT NULL DEFAULT 'RUB',
        total_amount integer NOT NULL DEFAULT 0, snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
        updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
        CONSTRAINT bookings_code_unique UNIQUE(code),
        CONSTRAINT bookings_amount_check CHECK (total_amount >= 0),
        CONSTRAINT bookings_status_check CHECK (status IN ('draft','unconfirmed','confirmed','in_progress','completed','cancelled','archived'))
      )
    `)
    await queryRunner.query(`
      CREATE TABLE resource_allocations (
        id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, resource_id uuid NOT NULL REFERENCES resources(id),
        source_type text NOT NULL, source_id uuid NOT NULL, start_at timestamptz NOT NULL, end_at timestamptz NOT NULL,
        quantity integer NOT NULL DEFAULT 1, capacity_impact integer NOT NULL DEFAULT 1, status text NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
        updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
        CONSTRAINT resource_allocations_interval_check CHECK (start_at < end_at),
        CONSTRAINT resource_allocations_quantity_check CHECK (quantity > 0 AND capacity_impact >= 0)
      )
    `)
    await queryRunner.query(`CREATE INDEX resource_allocations_resource_interval_idx ON resource_allocations(resource_id,start_at,end_at)`)
    await queryRunner.query(`
      ALTER TABLE resource_allocations ADD CONSTRAINT resource_allocations_fixed_overlap_excl
      EXCLUDE USING gist (resource_id WITH =, tstzrange(start_at,end_at,'[)') WITH &&)
      WHERE (status = 'active' AND capacity_impact > 0)
      DEFERRABLE INITIALLY IMMEDIATE
    `)
    await queryRunner.query(`
      CREATE TABLE payments (
        id uuid PRIMARY KEY, operation_id uuid NOT NULL, booking_id uuid NOT NULL REFERENCES bookings(id),
        kind text NOT NULL, amount integer NOT NULL, currency text NOT NULL DEFAULT 'RUB', method text NOT NULL,
        source_payment_id uuid REFERENCES payments(id), reason text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL, created_by uuid REFERENCES users(id),
        CONSTRAINT payments_operation_id_unique UNIQUE(operation_id),
        CONSTRAINT payments_amount_positive CHECK (amount > 0),
        CONSTRAINT payments_kind_check CHECK (kind IN ('payment','refund')),
        CONSTRAINT payments_refund_source_check CHECK ((kind = 'payment' AND source_payment_id IS NULL) OR (kind = 'refund' AND source_payment_id IS NOT NULL))
      )
    `)
    await queryRunner.query(`
      CREATE TABLE saved_views (
        id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, owner_id uuid NOT NULL REFERENCES users(id),
        entity_type text NOT NULL, name text NOT NULL, definition jsonb NOT NULL, is_default boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
        updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
        CONSTRAINT saved_views_owner_name_unique UNIQUE(owner_id,entity_type,name)
      )
    `)
    await queryRunner.query(`
      CREATE TABLE idempotency_keys (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), scope text NOT NULL, operation_id uuid NOT NULL,
        request_hash text NOT NULL, response_status integer, response_body jsonb, created_at timestamptz NOT NULL,
        CONSTRAINT idempotency_scope_operation_unique UNIQUE(scope,operation_id)
      )
    `)
    await queryRunner.query(`
      CREATE TABLE change_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text NOT NULL, entity_id uuid NOT NULL,
        action text NOT NULL, actor_id uuid REFERENCES users(id), changes jsonb NOT NULL DEFAULT '{}'::jsonb,
        request_id text NOT NULL, created_at timestamptz NOT NULL
      )
    `)
    await queryRunner.query(`CREATE INDEX change_log_entity_idx ON change_log(entity_type,entity_id,created_at DESC)`)
    await queryRunner.query(`
      CREATE TABLE outbox_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), topic text NOT NULL, aggregate_type text NOT NULL,
        aggregate_id uuid NOT NULL, payload jsonb NOT NULL, available_at timestamptz NOT NULL,
        processed_at timestamptz, attempts integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL
      )
    `)
    await queryRunner.query(`CREATE INDEX outbox_pending_idx ON outbox_events(available_at) WHERE processed_at IS NULL`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS outbox_events`)
    await queryRunner.query(`DROP TABLE IF EXISTS change_log`)
    await queryRunner.query(`DROP TABLE IF EXISTS idempotency_keys`)
    await queryRunner.query(`DROP TABLE IF EXISTS saved_views`)
    await queryRunner.query(`DROP TABLE IF EXISTS payments`)
    await queryRunner.query(`DROP TABLE IF EXISTS resource_allocations`)
    await queryRunner.query(`DROP TABLE IF EXISTS bookings`)
    await queryRunner.query(`DROP TABLE IF EXISTS resources`)
    await queryRunner.query(`DROP TABLE IF EXISTS tasks`)
    await queryRunner.query(`DROP TABLE IF EXISTS sessions`)
    await queryRunner.query(`DROP TABLE IF EXISTS users`)
  }
}
