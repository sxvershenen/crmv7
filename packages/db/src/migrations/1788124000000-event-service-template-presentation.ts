import type { MigrationInterface, QueryRunner } from "typeorm"

/** Additive presentation fields for the event-service template dossier. */
export class EventServiceTemplatePresentation1788124000000 implements MigrationInterface {
  name = "EventServiceTemplatePresentation1788124000000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE event_service_templates
      ADD COLUMN icon text NOT NULL DEFAULT 'heart',
      ADD COLUMN tone text NOT NULL DEFAULT 'rose',
      ADD CONSTRAINT event_service_templates_icon_check CHECK (icon IN ('heart','building','cake','bus')),
      ADD CONSTRAINT event_service_templates_tone_check CHECK (tone IN ('rose','violet','amber','sky'))`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE event_service_templates
      DROP CONSTRAINT IF EXISTS event_service_templates_icon_check,
      DROP CONSTRAINT IF EXISTS event_service_templates_tone_check,
      DROP COLUMN IF EXISTS icon,
      DROP COLUMN IF EXISTS tone`)
  }
}
