import { BadRequestException, Inject, Injectable } from "@nestjs/common"
import { DataSource } from "typeorm"

import {
  AnalyticsAggregatePointSchema,
  AnalyticsAggregateResponseSchema,
  type AnalyticsAggregateQuery,
  type AnalyticsAggregateResponse,
} from "@crm/contracts"

export const ANALYTICS_AGGREGATE_TIMEZONE = "Europe/Moscow"
export const ANALYTICS_ACTION_EVENTS = [
  "cta_clicked",
  "navigation_click",
  "outbound_click",
  "file_download",
] as const

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_DAY_PERIODS = 366
const MAX_MONTH_PERIODS = 36

type AggregateRow = {
  period: string
  page_views: number | string
  unique_visitors: number | string
  actions: number | string
  leads: number | string
  bookings: number | string
  payments: number | string
}

type RollupCoverageRow = {
  covered_periods: number | string
}

type DateParts = {
  year: number
  month: number
  day: number
  epoch: number
}

@Injectable()
export class AnalyticsAggregateService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async get(query: AnalyticsAggregateQuery): Promise<AnalyticsAggregateResponse> {
    const periods = this.validateAndBuildPeriods(query)
    const rows = await this.queryRows(query, periods.length)

    const byPeriod = new Map(rows.map((row) => {
      const point = AnalyticsAggregatePointSchema.parse({
        period: row.period,
        pageNodeId: query.pageNodeId ?? null,
        sectionKey: query.sectionKey ?? null,
        pageViews: Number(row.page_views),
        uniqueVisitors: Number(row.unique_visitors),
        actions: Number(row.actions),
        leads: Number(row.leads),
        bookings: Number(row.bookings),
        payments: Number(row.payments),
      })
      return [point.period, point] as const
    }))

    const items = periods.map((period) => byPeriod.get(period) ?? AnalyticsAggregatePointSchema.parse({
      period,
      pageNodeId: query.pageNodeId ?? null,
      sectionKey: query.sectionKey ?? null,
      pageViews: 0,
      uniqueVisitors: 0,
      actions: 0,
      leads: 0,
      bookings: 0,
      payments: 0,
    }))

    return AnalyticsAggregateResponseSchema.parse({ items })
  }

  private async queryRows(query: AnalyticsAggregateQuery, expectedPeriods: number): Promise<AggregateRow[]> {
    if (query.interval !== "day" || query.to >= this.currentMoscowDay()) {
      return this.queryRaw(query)
    }

    const coverage = await this.dataSource.query<RollupCoverageRow[]>(`
      SELECT count(DISTINCT period_date) AS covered_periods
      FROM analytics_daily_aggregates
      WHERE period_date >= $1::date
        AND period_date <= $2::date
        AND page_node_id IS NULL
        AND section_key IS NULL
    `, [query.from, query.to])

    if (Number(coverage[0]?.covered_periods ?? 0) !== expectedPeriods) {
      return this.queryRaw(query)
    }

    return this.dataSource.query<AggregateRow[]>(`
      SELECT
        to_char(period_date, 'YYYY-MM-DD') AS period,
        page_views,
        unique_visitors,
        actions,
        leads,
        bookings,
        payments
      FROM analytics_daily_aggregates
      WHERE period_date >= $1::date
        AND period_date <= $2::date
        AND page_node_id IS NOT DISTINCT FROM $3::uuid
        AND section_key IS NOT DISTINCT FROM $4::text
      ORDER BY period_date
    `, [
      query.from,
      query.to,
      query.pageNodeId ?? null,
      query.sectionKey ?? null,
    ])
  }

  private queryRaw(query: AnalyticsAggregateQuery): Promise<AggregateRow[]> {
    return this.dataSource.query<AggregateRow[]>(`
      WITH parameters AS (
        SELECT
          $1::date AS from_date,
          $2::date AS to_date,
          $3::text AS interval_name,
          $4::text AS timezone,
          $5::uuid AS page_node_id,
          $6::text AS section_key
      ),
      event_aggregates AS (
        SELECT
          date_trunc(parameters.interval_name, event.occurred_at AT TIME ZONE parameters.timezone)::date AS period_start,
          count(*) FILTER (WHERE event.event_name = 'page_view') AS page_views,
          count(DISTINCT event.visitor_id) AS unique_visitors,
          count(*) FILTER (WHERE event.event_name = ANY($7::text[])) AS actions
        FROM analytics_events event
        CROSS JOIN parameters
        WHERE event.occurred_at >= parameters.from_date::timestamp AT TIME ZONE parameters.timezone
          AND event.occurred_at < (parameters.to_date + 1)::timestamp AT TIME ZONE parameters.timezone
          AND event.purpose = 'analytics'
          AND event.consent IN ('analytics', 'analytics_and_marketing')
          AND (parameters.page_node_id IS NULL OR event.context->>'pageNodeId' = parameters.page_node_id::text)
          AND (parameters.section_key IS NULL OR event.context->>'sectionKey' = parameters.section_key)
        GROUP BY 1
      ),
      conversion_aggregates AS (
        SELECT
          date_trunc(parameters.interval_name, fact.occurred_at AT TIME ZONE parameters.timezone)::date AS period_start,
          count(DISTINCT fact.source_event_id) FILTER (WHERE fact.kind = 'lead_created') AS leads,
          count(DISTINCT fact.source_event_id) FILTER (WHERE fact.kind = 'booking_created') AS bookings,
          count(DISTINCT fact.source_event_id) FILTER (WHERE fact.kind = 'payment_recorded') AS payments
        FROM analytics_conversion_facts fact
        CROSS JOIN parameters
        WHERE fact.occurred_at >= parameters.from_date::timestamp AT TIME ZONE parameters.timezone
          AND fact.occurred_at < (parameters.to_date + 1)::timestamp AT TIME ZONE parameters.timezone
          AND fact.kind IN ('lead_created', 'booking_created', 'payment_recorded')
          AND parameters.page_node_id IS NULL
          AND parameters.section_key IS NULL
        GROUP BY 1
      )
      SELECT
        to_char(
          COALESCE(event_aggregates.period_start, conversion_aggregates.period_start),
          CASE WHEN parameters.interval_name = 'month' THEN 'YYYY-MM' ELSE 'YYYY-MM-DD' END
        ) AS period,
        COALESCE(event_aggregates.page_views, 0) AS page_views,
        COALESCE(event_aggregates.unique_visitors, 0) AS unique_visitors,
        COALESCE(event_aggregates.actions, 0) AS actions,
        COALESCE(conversion_aggregates.leads, 0) AS leads,
        COALESCE(conversion_aggregates.bookings, 0) AS bookings,
        COALESCE(conversion_aggregates.payments, 0) AS payments
      FROM event_aggregates
      FULL OUTER JOIN conversion_aggregates USING (period_start)
      CROSS JOIN parameters
      ORDER BY COALESCE(event_aggregates.period_start, conversion_aggregates.period_start)
    `, [
      query.from,
      query.to,
      query.interval,
      ANALYTICS_AGGREGATE_TIMEZONE,
      query.pageNodeId ?? null,
      query.sectionKey ?? null,
      [...ANALYTICS_ACTION_EVENTS],
    ])
  }

  private currentMoscowDay(): string {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: ANALYTICS_AGGREGATE_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date())
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""
    return `${value("year")}-${value("month")}-${value("day")}`
  }

  private validateAndBuildPeriods(query: AnalyticsAggregateQuery): string[] {
    const from = this.parseDate(query.from)
    const to = this.parseDate(query.to)
    if (!from || !to || from.epoch > to.epoch) {
      throw new BadRequestException({
        code: "ANALYTICS_DATE_RANGE_INVALID",
        message: "Начало периода должно быть корректной датой не позже окончания",
        details: {},
      })
    }

    if (query.interval === "day") {
      const count = ((to.epoch - from.epoch) / DAY_MS) + 1
      if (count > MAX_DAY_PERIODS) this.rangeTooLarge(MAX_DAY_PERIODS, count, query.interval)
      return Array.from({ length: count }, (_, index) => this.formatDay(from.epoch + (index * DAY_MS)))
    }

    const fromMonth = (from.year * 12) + from.month - 1
    const toMonth = (to.year * 12) + to.month - 1
    const count = toMonth - fromMonth + 1
    if (count > MAX_MONTH_PERIODS) this.rangeTooLarge(MAX_MONTH_PERIODS, count, query.interval)
    return Array.from({ length: count }, (_, index) => {
      const monthIndex = fromMonth + index
      const year = Math.floor(monthIndex / 12)
      const month = (monthIndex % 12) + 1
      return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`
    })
  }

  private parseDate(value: string): DateParts | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!match) return null
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    if (year < 1) return null
    const parsed = new Date(`${value}T00:00:00.000Z`)
    if (Number.isNaN(parsed.getTime()) || this.formatDay(parsed.getTime()) !== value) return null
    return { year, month, day, epoch: parsed.getTime() }
  }

  private formatDay(epoch: number): string {
    return new Date(epoch).toISOString().slice(0, 10)
  }

  private rangeTooLarge(maxPeriods: number, actualPeriods: number, interval: AnalyticsAggregateQuery["interval"]): never {
    throw new BadRequestException({
      code: "ANALYTICS_DATE_RANGE_TOO_LARGE",
      message: "Запрошенный период слишком велик",
      details: { interval, maxPeriods, actualPeriods },
    })
  }
}
