import type { MigrationInterface, QueryRunner } from "typeorm"

export class ProgramEventCategories1788114800000 implements MigrationInterface {
  name = "ProgramEventCategories1788114800000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE program_categories (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, name text NOT NULL, description text NOT NULL DEFAULT '',
      icon text NOT NULL, tone text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
      CONSTRAINT program_categories_name_check CHECK (length(trim(name)) > 0),
      CONSTRAINT program_categories_icon_check CHECK (icon IN ('campfire','leaf','palette','snowflake','sparkles')),
      CONSTRAINT program_categories_tone_check CHECK (tone IN ('amber','emerald','violet','sky','rose'))
    )`)
    await queryRunner.query(`CREATE INDEX program_categories_name_idx ON program_categories(name)`)
    await queryRunner.query(`CREATE TABLE event_categories (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, name text NOT NULL, description text NOT NULL DEFAULT '',
      icon text NOT NULL, tone text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
      CONSTRAINT event_categories_name_check CHECK (length(trim(name)) > 0),
      CONSTRAINT event_categories_icon_check CHECK (icon IN ('heart','building','cake','bus')),
      CONSTRAINT event_categories_tone_check CHECK (tone IN ('rose','violet','amber','sky'))
    )`)
    await queryRunner.query(`CREATE INDEX event_categories_name_idx ON event_categories(name)`)
    await queryRunner.query(`ALTER TABLE program_templates ADD CONSTRAINT program_templates_category_fk FOREIGN KEY (category_id) REFERENCES program_categories(id) ON DELETE SET NULL`)
    await queryRunner.query(`ALTER TABLE events ADD CONSTRAINT events_category_fk FOREIGN KEY (category_id) REFERENCES event_categories(id) ON DELETE SET NULL`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE events DROP CONSTRAINT IF EXISTS events_category_fk`)
    await queryRunner.query(`ALTER TABLE program_templates DROP CONSTRAINT IF EXISTS program_templates_category_fk`)
    await queryRunner.query(`DROP TABLE IF EXISTS event_categories`)
    await queryRunner.query(`DROP TABLE IF EXISTS program_categories`)
  }
}
