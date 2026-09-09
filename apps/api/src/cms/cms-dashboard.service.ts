import { ForbiddenException, Inject, Injectable } from "@nestjs/common"
import { DataSource } from "typeorm"

import { CmsDashboardSchema, type CmsDashboard, type SessionUser } from "@crm/contracts"

type DashboardRow = {
  production_release: string | null
  published_at: Date | string | null
  drafts: number | string
  review: number | string
  pages: number | string
  published_pages: number | string
  seo_healthy: number | string
  seo_risks: number | string
  media: number | string
  media_processing: number | string
  delivery_failures: number | string
  delivery_expired: number | string
  leads: number | string
  bookings: number | string
  paid: number | string
}

type ActivityRow = {
  id: string
  actor: string | null
  action: string
  entity_type: string
  target: string | null
  created_at: Date | string
  status: string | null
}

@Injectable()
export class CmsDashboardService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async get(actor: SessionUser): Promise<CmsDashboard> {
    this.assertCanView(actor)
    const [aggregateRows, activityRows] = await Promise.all([
      this.dataSource.query(`
        WITH latest_revision AS (
          SELECT DISTINCT ON (node_id) node_id, state, title, seo
          FROM cms_node_revisions
          ORDER BY node_id, revision DESC
        )
        SELECT
          (SELECT 'REL-' || release.sequence::text
             FROM cms_active_release active
             JOIN cms_releases release ON release.id = active.release_id
            WHERE active.singleton_key = 'public') AS production_release,
          (SELECT release.published_at
             FROM cms_active_release active
             JOIN cms_releases release ON release.id = active.release_id
            WHERE active.singleton_key = 'public') AS published_at,
          (SELECT count(*) FROM latest_revision revision
             JOIN cms_nodes node ON node.id = revision.node_id
            WHERE node.status = 'active' AND revision.state = 'draft') AS drafts,
          (SELECT count(*) FROM latest_revision revision
             JOIN cms_nodes node ON node.id = revision.node_id
            WHERE node.status = 'active' AND revision.state IN ('review', 'approved')) AS review,
          (SELECT count(*) FROM cms_nodes WHERE status = 'active') AS pages,
          (SELECT count(*)
             FROM cms_release_items item
             JOIN cms_active_release active ON active.release_id = item.release_id
            WHERE active.singleton_key = 'public') AS published_pages,
          (SELECT count(*) FROM latest_revision revision
             JOIN cms_nodes node ON node.id = revision.node_id
            WHERE node.status = 'active'
              AND jsonb_typeof(revision.seo) = 'object'
              AND length(COALESCE(revision.seo->>'title', '')) BETWEEN 1 AND 60
              AND length(COALESCE(revision.seo->>'description', '')) BETWEEN 1 AND 160) AS seo_healthy,
          (SELECT count(*) FROM latest_revision revision
             JOIN cms_nodes node ON node.id = revision.node_id
            WHERE node.status = 'active'
              AND (length(COALESCE(revision.seo->>'title', '')) NOT BETWEEN 1 AND 60
                OR length(COALESCE(revision.seo->>'description', '')) NOT BETWEEN 1 AND 160)) AS seo_risks,
          (SELECT count(*) FROM media_assets WHERE archived_at IS NULL) AS media,
          (SELECT count(*) FROM media_assets WHERE archived_at IS NULL AND state IN ('uploading', 'processing')) AS media_processing,
          (SELECT count(*) FROM outbox_deliveries WHERE status IN ('failed', 'dead_letter')) AS delivery_failures,
          (SELECT count(*) FROM outbox_deliveries WHERE status = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at < now()) AS delivery_expired,
          (SELECT count(*) FROM leads WHERE archived_at IS NULL AND status NOT IN ('archived', 'spam')) AS leads,
          (SELECT count(*) FROM bookings WHERE archived_at IS NULL AND status NOT IN ('cancelled', 'archived')) AS bookings,
          (SELECT count(*) FROM (
             SELECT payment.booking_id,
                    SUM(CASE WHEN payment.kind = 'payment' THEN payment.amount ELSE -payment.amount END) AS net
               FROM payments payment
               JOIN bookings booking ON booking.id = payment.booking_id
              WHERE booking.archived_at IS NULL AND booking.status NOT IN ('cancelled', 'archived')
              GROUP BY payment.booking_id
          ) paid_booking WHERE paid_booking.net > 0) AS paid
      `) as unknown as DashboardRow[],
      this.dataSource.query(`
        SELECT change.id, COALESCE(actor.display_name, CASE WHEN change.actor_id IS NULL THEN 'Система' ELSE 'Оператор' END) AS actor,
               change.action, change.entity_type,
               COALESCE(revision.title, booking.code, lead.name, release.sequence::text, 'Изменение') AS target,
               change.created_at,
               CASE
                 WHEN change.action IN ('published', 'publish', 'activated') THEN 'published'
                 WHEN change.action IN ('submitted', 'review', 'approved') THEN 'review'
                 WHEN change.action IN ('archived', 'archive') THEN 'archived'
                 WHEN change.action IN ('failed', 'error') THEN 'failed'
                 ELSE 'draft'
               END AS status
          FROM change_log change
          LEFT JOIN users actor ON actor.id = change.actor_id
          LEFT JOIN LATERAL (
            SELECT node_revision.title
              FROM cms_node_revisions node_revision
             WHERE node_revision.node_id = change.entity_id
             ORDER BY node_revision.revision DESC LIMIT 1
          ) revision ON change.entity_type LIKE 'cms_%'
          LEFT JOIN bookings booking ON booking.id = change.entity_id AND change.entity_type = 'booking'
          LEFT JOIN leads lead ON lead.id = change.entity_id AND change.entity_type = 'lead'
          LEFT JOIN cms_releases release ON release.id = change.entity_id AND change.entity_type IN ('cms_release', 'release')
         ORDER BY change.created_at DESC, change.id DESC
         LIMIT 8
      `) as unknown as ActivityRow[],
    ])

    const row = aggregateRows[0] ?? this.emptyRow()
    const failures = this.number(row.delivery_failures) + this.number(row.delivery_expired)
    const mediaProcessing = this.number(row.media_processing)
    const attention: CmsDashboard["attention"] = []
    if (!row.production_release) attention.push({ id: "production-release", title: "Сайт ещё не опубликован", detail: "Создайте и активируйте первый production release", href: "/releases", tone: "danger" })
    if (failures > 0) attention.push({ id: "delivery-failures", title: "Есть ошибки доставки", detail: `${failures} событий требуют проверки`, href: "/settings/integrations", tone: "danger" })
    if (mediaProcessing > 0) attention.push({ id: "media-processing", title: "Медиа ещё обрабатывается", detail: `${mediaProcessing} файлов ожидают WebP/AVIF`, href: "/media", tone: "warning" })
    attention.push({ id: "analytics-not-configured", title: "Сбор веб-аналитики не настроен", detail: "Посетители показываются как 0, пока не подключён first-party collector", href: "/analytics", tone: "info" })

    const pages = this.number(row.pages)
    const seoHealthy = this.number(row.seo_healthy)
    const seoRisks = this.number(row.seo_risks)
    const drafts = this.number(row.drafts)
    const result = {
      productionRelease: row.production_release,
      publishedAt: this.iso(row.published_at),
      drafts,
      queueHealthy: failures === 0,
      metrics: [
        { id: "pages", label: "Страницы", value: String(pages), detail: `${this.number(row.published_pages)} в production` },
        { id: "seo", label: "SEO-качество", value: `${seoHealthy} / ${pages}`, detail: `${seoRisks} страниц с рисками` },
        { id: "media", label: "Медиа", value: String(this.number(row.media)), detail: `${mediaProcessing} файлов в обработке` },
        { id: "release", label: "Черновики", value: String(drafts), detail: `${this.number(row.review)} на проверке` },
      ],
      attention,
      activity: activityRows.map((item) => ({ id: item.id, actor: item.actor ?? "Система", action: this.action(item.action), target: item.target ?? "Изменение", when: this.iso(item.created_at)!, status: this.status(item.status) })),
      funnel: { visitors: 0, leads: this.number(row.leads), bookings: this.number(row.bookings), paid: this.number(row.paid) },
    }
    return CmsDashboardSchema.parse(result)
  }

  private assertCanView(actor: SessionUser) {
    if (actor.capabilities.canViewContent !== true) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для просмотра CMS" })
  }

  private number(value: number | string | null | undefined) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0 }
  private iso(value: Date | string | null | undefined) { if (!value) return null; const date = value instanceof Date ? value : new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString() }
  private status(value: string | null) { return value === "review" || value === "scheduled" || value === "published" || value === "archived" || value === "failed" ? value : "draft" as const }
  private action(value: string) {
    const labels: Record<string, string> = { created: "создал", updated: "обновил", revision_created: "создал версию", submitted: "отправил на проверку", approved: "одобрил", published: "опубликовал", archived: "архивировал", activated: "активировал" }
    return labels[value] ?? value.replaceAll("_", " ")
  }
  private emptyRow(): DashboardRow { return { production_release: null, published_at: null, drafts: 0, review: 0, pages: 0, published_pages: 0, seo_healthy: 0, seo_risks: 0, media: 0, media_processing: 0, delivery_failures: 0, delivery_expired: 0, leads: 0, bookings: 0, paid: 0 } }
}
