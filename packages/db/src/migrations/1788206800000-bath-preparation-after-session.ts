import type { MigrationInterface, QueryRunner } from "typeorm"

export class BathPreparationAfterSession1788206800000 implements MigrationInterface {
  name = "BathPreparationAfterSession1788206800000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.rebase(queryRunner, true)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await this.rebase(queryRunner, false)
  }

  private async rebase(queryRunner: QueryRunner, afterSession: boolean): Promise<void> {
    const preparation = "make_interval(mins => item.preparation_minutes)"
    const start = afterSession ? "item.start_at" : `item.start_at - ${preparation}`
    const end = afterSession ? `item.end_at + ${preparation}` : "item.end_at"
    const conflicts: Array<{ resource_id: string }> = await queryRunner.query(`
      WITH intervals AS (
        SELECT allocation.id, allocation.resource_id, allocation.capacity_impact, allocation.exclusive,
          CASE WHEN item.type = 'bath' AND item.preparation_minutes > 0 THEN ${start} ELSE allocation.start_at END AS start_at,
          CASE WHEN item.type = 'bath' AND item.preparation_minutes > 0 THEN ${end} ELSE allocation.end_at END AS end_at
        FROM resource_allocations allocation
        LEFT JOIN booking_items item ON allocation.source_type = 'booking_item' AND item.id = allocation.source_id
        WHERE allocation.status IN ('active', 'tentative') AND allocation.archived_at IS NULL
      ), affected AS (
        SELECT DISTINCT allocation.resource_id FROM resource_allocations allocation
        JOIN booking_items item ON allocation.source_type = 'booking_item' AND item.id = allocation.source_id
        WHERE item.type = 'bath' AND item.preparation_minutes > 0
          AND allocation.status IN ('active', 'tentative') AND allocation.archived_at IS NULL
      ), fixed_conflicts AS (
        SELECT left_slot.resource_id FROM intervals left_slot
        JOIN intervals right_slot ON right_slot.resource_id = left_slot.resource_id AND right_slot.id > left_slot.id
        JOIN resources resource ON resource.id = left_slot.resource_id
        JOIN affected ON affected.resource_id = resource.id
        WHERE resource.capacity_mode = 'fixed' AND left_slot.exclusive AND right_slot.exclusive
          AND tstzrange(left_slot.start_at, left_slot.end_at, '[)') && tstzrange(right_slot.start_at, right_slot.end_at, '[)')
      ), shared_conflicts AS (
        SELECT slot.resource_id FROM intervals slot
        JOIN resources resource ON resource.id = slot.resource_id
        JOIN affected ON affected.resource_id = resource.id
        WHERE resource.capacity_mode = 'shared' AND (
          SELECT COALESCE(SUM(occupied.capacity_impact), 0) FROM intervals occupied
          WHERE occupied.resource_id = slot.resource_id
            AND occupied.start_at <= slot.start_at AND occupied.end_at > slot.start_at
        ) > resource.capacity_total
      )
      SELECT resource_id FROM fixed_conflicts UNION ALL SELECT resource_id FROM shared_conflicts LIMIT 1
    `)
    if (conflicts.length > 0) throw new Error(`Нельзя перенести подготовку бани/чана: пересекаются слоты ресурса ${conflicts[0]!.resource_id}. Разрешите конфликт броней до миграции.`)
    await queryRunner.query(`
      UPDATE resource_allocations allocation
      SET start_at = ${start}, end_at = ${end}, updated_at = now()
      FROM booking_items item
      WHERE allocation.source_type = 'booking_item' AND allocation.source_id = item.id
        AND item.type = 'bath' AND item.preparation_minutes > 0
        AND allocation.status IN ('active', 'tentative') AND allocation.archived_at IS NULL
    `)
  }
}
