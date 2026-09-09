import type { MigrationInterface, QueryRunner } from "typeorm"

/** Operational rules only. Editorial promotion content remains CMS-owned. */
export class MarketingPromotions1788122400000 implements MigrationInterface {
  name = "MarketingPromotions1788122400000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE promotions (
      id uuid PRIMARY KEY,
      version integer NOT NULL DEFAULT 1,
      code text NOT NULL,
      terms jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by uuid REFERENCES users(id),
      archived_at timestamptz,
      CONSTRAINT promotions_code_unique UNIQUE (code),
      CONSTRAINT promotions_code_normalized_check CHECK (code = upper(btrim(code))),
      CONSTRAINT promotions_terms_object_check CHECK (jsonb_typeof(terms) = 'object'),
      CONSTRAINT promotions_terms_code_check CHECK (terms->>'code' = code)
    )`)
    await queryRunner.query(`CREATE INDEX promotions_active_code_idx ON promotions(code) WHERE archived_at IS NULL`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS promotions`)
  }
}
