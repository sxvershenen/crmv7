import { Inject, Injectable } from "@nestjs/common"
import { DataSource, type EntityManager } from "typeorm"

import { ANALYTICS_ACTION_EVENTS, ANALYTICS_AGGREGATE_TIMEZONE } from "./analytics-aggregate.service.js"

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

@Injectable()
export class AnalyticsDailyRollupService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async rebuildDay(periodDate: string): Promise<number> {
    this.assertDate(periodDate)
    return this.dataSource.transaction(async (manager) => {
      await manager.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [`analytics-daily-rollup:${periodDate}`],
      )
      await manager.query("DELETE FROM analytics_daily_aggregates WHERE period_date = $1::date", [periodDate])
      return this.insertDay(manager, periodDate)
    })
  }

  private async insertDay(manager: EntityManager, periodDate: string): Promise<number> {
    const inserted = await manager.query<Array<{ id: string }>>(`
      WITH parameters AS (
        SELECT $1::date AS period_date, $2::text AS timezone
      ),
      normalized_events AS MATERIALIZED (
        SELECT
          event.event_name,
          event.visitor_id,
          CASE
            WHEN event.context->>'pageNodeId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN (event.context->>'pageNodeId')::uuid
            ELSE NULL
          END AS page_node_id,
          CASE
            WHEN length(event.context->>'sectionKey') <= 120
              AND event.context->>'sectionKey' ~ '^[a-z][a-z0-9._-]*$'
              THEN event.context->>'sectionKey'
            ELSE NULL
          END AS section_key
        FROM analytics_events event
        CROSS JOIN parameters
        WHERE event.occurred_at >= parameters.period_date::timestamp AT TIME ZONE parameters.timezone
          AND event.occurred_at < (parameters.period_date + 1)::timestamp AT TIME ZONE parameters.timezone
          AND event.purpose = 'analytics'
          AND event.consent IN ('analytics', 'analytics_and_marketing')
      ),
      event_aggregates AS (
        SELECT
          CASE WHEN GROUPING(page_node_id) = 1 THEN NULL ELSE page_node_id END AS page_node_id,
          CASE WHEN GROUPING(section_key) = 1 THEN NULL ELSE section_key END AS section_key,
          count(*) FILTER (WHERE event_name = 'page_view') AS page_views,
          count(DISTINCT visitor_id) AS unique_visitors,
          count(*) FILTER (WHERE event_name = ANY($3::text[])) AS actions
        FROM normalized_events
        GROUP BY GROUPING SETS ((), (page_node_id), (section_key), (page_node_id, section_key))
        HAVING (GROUPING(page_node_id) = 1 OR page_node_id IS NOT NULL)
          AND (GROUPING(section_key) = 1 OR section_key IS NOT NULL)
      ),
      event_rows AS (
        SELECT page_node_id, section_key, page_views, unique_visitors, actions
        FROM event_aggregates
        UNION ALL
        SELECT NULL::uuid, NULL::text, 0::bigint, 0::bigint, 0::bigint
        WHERE NOT EXISTS (
          SELECT 1 FROM event_aggregates
          WHERE page_node_id IS NULL AND section_key IS NULL
        )
      ),
      conversion_aggregates AS (
        SELECT
          count(DISTINCT fact.source_event_id) FILTER (WHERE fact.kind = 'lead_created') AS leads,
          count(DISTINCT fact.source_event_id) FILTER (WHERE fact.kind = 'booking_created') AS bookings,
          count(DISTINCT fact.source_event_id) FILTER (WHERE fact.kind = 'payment_recorded') AS payments
        FROM analytics_conversion_facts fact
        CROSS JOIN parameters
        WHERE fact.occurred_at >= parameters.period_date::timestamp AT TIME ZONE parameters.timezone
          AND fact.occurred_at < (parameters.period_date + 1)::timestamp AT TIME ZONE parameters.timezone
          AND fact.kind IN ('lead_created', 'booking_created', 'payment_recorded')
      )
      INSERT INTO analytics_daily_aggregates (
        period_date, page_node_id, section_key, page_views, unique_visitors,
        actions, leads, bookings, payments, computed_at
      )
      SELECT
        parameters.period_date,
        event_rows.page_node_id,
        event_rows.section_key,
        event_rows.page_views,
        event_rows.unique_visitors,
        event_rows.actions,
        CASE WHEN event_rows.page_node_id IS NULL AND event_rows.section_key IS NULL
          THEN conversion_aggregates.leads ELSE 0 END,
        CASE WHEN event_rows.page_node_id IS NULL AND event_rows.section_key IS NULL
          THEN conversion_aggregates.bookings ELSE 0 END,
        CASE WHEN event_rows.page_node_id IS NULL AND event_rows.section_key IS NULL
          THEN conversion_aggregates.payments ELSE 0 END,
        CURRENT_TIMESTAMP
      FROM event_rows
      CROSS JOIN conversion_aggregates
      CROSS JOIN parameters
      RETURNING id
    `, [periodDate, ANALYTICS_AGGREGATE_TIMEZONE, [...ANALYTICS_ACTION_EVENTS]])
    return inserted.length
  }

  private assertDate(value: string): void {
    const match = DATE_PATTERN.exec(value)
    if (!match || Number(match[1]) < 1) throw new TypeError("Analytics rollup date must use YYYY-MM-DD")
    const parsed = new Date(`${value}T00:00:00.000Z`)
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new TypeError("Analytics rollup date must be a valid calendar date")
    }
  }
}
