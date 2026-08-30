import type { MigrationInterface, QueryRunner } from "typeorm"

export class CustomersLeads1788113600000 implements MigrationInterface {
  name = "CustomersLeads1788113600000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE customers (
        id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1,
        type text NOT NULL DEFAULT 'person', name text NOT NULL,
        phones jsonb NOT NULL DEFAULT '[]'::jsonb, channels jsonb NOT NULL DEFAULT '[]'::jsonb,
        email text, notes text NOT NULL DEFAULT '', consent jsonb NOT NULL DEFAULT '{}'::jsonb,
        duplicate_risk text NOT NULL DEFAULT 'none', assignees jsonb NOT NULL DEFAULT '[]'::jsonb,
        lead_count integer NOT NULL DEFAULT 0, active_lead_count integer NOT NULL DEFAULT 0,
        booking_count integer NOT NULL DEFAULT 0, future_booking_count integer NOT NULL DEFAULT 0,
        task_count integer NOT NULL DEFAULT 0, turnover integer NOT NULL DEFAULT 0, debt integer NOT NULL DEFAULT 0,
        next_contact_at timestamptz, last_visit_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
        updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
        CONSTRAINT customers_name_check CHECK (length(btrim(name)) > 0),
        CONSTRAINT customers_type_check CHECK (type IN ('person','company','organizer')),
        CONSTRAINT customers_duplicate_risk_check CHECK (duplicate_risk IN ('none','possible','high')),
        CONSTRAINT customers_counts_check CHECK (lead_count >= 0 AND active_lead_count >= 0 AND booking_count >= 0 AND future_booking_count >= 0 AND task_count >= 0 AND turnover >= 0)
      )
    `)
    await queryRunner.query(`CREATE INDEX customers_name_idx ON customers(name)`)
    await queryRunner.query(`CREATE INDEX customers_phones_gin_idx ON customers USING gin(phones)`)
    await queryRunner.query(`
      CREATE TABLE leads (
        id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1,
        customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
        name text NOT NULL, phone text, channel text, direction text, requested_item text,
        desired_start_at timestamptz, desired_end_at timestamptz,
        guest_count integer NOT NULL DEFAULT 0, comment text NOT NULL DEFAULT '', source text,
        utm jsonb NOT NULL DEFAULT '{}'::jsonb, assignees jsonb NOT NULL DEFAULT '[]'::jsonb,
        next_contact_at timestamptz, status text NOT NULL DEFAULT 'new',
        created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
        updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
        CONSTRAINT leads_name_check CHECK (length(btrim(name)) > 0),
        CONSTRAINT leads_guest_count_check CHECK (guest_count >= 0),
        CONSTRAINT leads_interval_check CHECK (desired_end_at IS NULL OR desired_start_at IS NULL OR desired_start_at < desired_end_at),
        CONSTRAINT leads_status_check CHECK (status IN ('new','in_progress','waiting','success','rejected','spam','archived'))
      )
    `)
    await queryRunner.query(`CREATE INDEX leads_status_idx ON leads(status)`)
    await queryRunner.query(`CREATE INDEX leads_customer_idx ON leads(customer_id)`)
    await queryRunner.query(`CREATE INDEX leads_phone_idx ON leads(phone) WHERE phone IS NOT NULL`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS leads`)
    await queryRunner.query(`DROP TABLE IF EXISTS customers`)
  }
}
