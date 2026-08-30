import { ForbiddenException, Inject, Injectable } from "@nestjs/common"
import { DataSource } from "typeorm"

import type { SearchQuery, SearchResponse, SearchResult, SessionUser } from "@crm/contracts"
import { normalizePhone } from "@crm/domain"

type SearchRow = {
  kind: SearchResult["kind"]
  id: string
  code: string | null
  title: string
  meta: string | null
  phone: string | null
  email: string | null
  created_at: Date | string
}

const searchSql = String.raw`
WITH candidates AS (
  SELECT 'customer'::text AS kind, c.id::text AS id, NULL::text AS code, c.name AS title,
    concat_ws(' · ', 'Клиент', c.phones->>0, c.email) AS meta,
    c.phones->>0 AS phone, c.email AS email, c.created_at,
    concat_ws(' ', c.id::text, c.name, c.email, c.phones::text) AS search_text,
    regexp_replace(coalesce(c.phones::text, ''), '[^0-9]', '', 'g') AS phone_search
  FROM customers c WHERE c.archived_at IS NULL
  UNION ALL
  SELECT 'lead', l.id::text, NULL, l.name,
    concat_ws(' · ', 'Заявка', l.requested_item, l.phone), l.phone, NULL, l.created_at,
    concat_ws(' ', l.id::text, l.name, l.phone, l.requested_item) AS search_text,
    regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g')
  FROM leads l WHERE l.archived_at IS NULL
  UNION ALL
  SELECT 'booking', b.id::text, b.code, coalesce(c.name, b.code),
    concat_ws(' · ', 'Бронь ' || b.code, c.name, resource.name, coalesce(c.phones->>0, '')),
    c.phones->>0, c.email, b.created_at,
    concat_ws(' ', b.id::text, b.code, c.name, c.email, c.phones::text, resource.name) AS search_text,
    regexp_replace(coalesce(c.phones::text, ''), '[^0-9]', '', 'g')
  FROM bookings b
  LEFT JOIN customers c ON c.id = b.customer_id
  LEFT JOIN LATERAL (
    SELECT r.name FROM booking_items bi JOIN resources r ON r.id = bi.resource_id
    WHERE bi.booking_id = b.id AND bi.archived_at IS NULL ORDER BY bi.start_at, bi.id LIMIT 1
  ) resource ON true
  WHERE b.archived_at IS NULL
  UNION ALL
  SELECT 'resource', r.id::text, r.code, r.name,
    concat_ws(' · ', 'Ресурс', r.code, r.kind), NULL, NULL, r.created_at,
    concat_ws(' ', r.id::text, r.code, r.name, r.kind) AS search_text, ''
  FROM resources r WHERE r.archived_at IS NULL
  UNION ALL
  SELECT 'task', t.id::text, t.code, t.title,
    concat_ws(' · ', 'Задача ' || t.code, t.relation->>'label'), NULL, NULL, t.created_at,
    concat_ws(' ', t.id::text, t.code, t.title, t.details, t.relation::text) AS search_text, ''
  FROM tasks t WHERE t.archived_at IS NULL
  UNION ALL
  SELECT 'program', p.id::text, p.code, p.name,
    concat_ws(' · ', 'Шаблон программы', p.code), NULL, NULL, p.created_at,
    concat_ws(' ', p.id::text, p.code, p.name, p.description) AS search_text, ''
  FROM program_templates p WHERE p.archived_at IS NULL
  UNION ALL
  SELECT 'program', o.id::text, o.code, o.name,
    concat_ws(' · ', 'Проведение программы', o.code), NULL, NULL, o.created_at,
    concat_ws(' ', o.id::text, o.code, o.name, o.comment) AS search_text, ''
  FROM program_occurrences o WHERE o.archived_at IS NULL
  UNION ALL
  SELECT 'program', pr.id::text, pr.code, coalesce(o.name, pr.code),
    concat_ws(' · ', 'Регистрация', pr.code, pr.phone), pr.phone, NULL, pr.created_at,
    concat_ws(' ', pr.id::text, pr.code, o.name, pr.phone, pr.participant_names, pr.comment) AS search_text,
    regexp_replace(coalesce(pr.phone, ''), '[^0-9]', '', 'g')
  FROM program_registrations pr
  LEFT JOIN program_occurrences o ON o.id = pr.occurrence_id
  WHERE pr.archived_at IS NULL
  UNION ALL
  SELECT 'event', e.id::text, e.code, e.name,
    concat_ws(' · ', 'Мероприятие ' || e.code, c.name, e.phone), e.phone, c.email, e.created_at,
    concat_ws(' ', e.id::text, e.code, e.name, e.phone, c.name, c.email, e.comment) AS search_text,
    regexp_replace(concat_ws(' ', e.phone, c.phones::text), '[^0-9]', '', 'g')
  FROM events e LEFT JOIN customers c ON c.id = e.customer_id
  WHERE e.archived_at IS NULL
)
SELECT kind, id, code, title, meta, phone, email, created_at
FROM candidates
WHERE lower(search_text) LIKE $1 ESCAPE chr(92)
   OR (phone_search <> '' AND phone_search LIKE $2 ESCAPE chr(92))
ORDER BY
  CASE WHEN lower(id) = $4 OR lower(coalesce(code, '')) = $4 THEN 0
       WHEN lower(title) LIKE $5 ESCAPE chr(92) THEN 1 ELSE 2 END,
  created_at DESC, id
LIMIT $3
`

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&")
}

@Injectable()
export class SearchService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async search(query: SearchQuery, actor: SessionUser): Promise<SearchResponse> {
    if (!actor.capabilities.canView) {
      throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для поиска" })
    }
    // Keep normalization server-side: callers cannot turn search into a
    // substring query over a different representation of a phone number.
    const term = query.q.normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/[«»“”„]/g, "").replace(/\s+/g, " ").trim()
    if (!term) return []
    const idTerm = term.replace(/^#/, "")
    const searchTerm = term.startsWith("#") && idTerm ? idTerm : term
    const phone = normalizePhone(idTerm) ?? ""
    const phoneNeedle = phone.length >= 10 ? phone.slice(-10) : phone
    const rows = await this.dataSource.query<SearchRow[]>(searchSql, [
      `%${escapeLike(searchTerm)}%`,
      `%${phoneNeedle.length >= 5 ? phoneNeedle : "__no_phone_match__"}%`,
      query.limit,
      idTerm,
      `${escapeLike(searchTerm)}%`,
    ])
    return rows.map((row) => this.toResult(row, actor))
  }

  private toResult(row: SearchRow, actor: SessionUser): SearchResult {
    const routeId = row.code ?? row.id
    const href = row.kind === "customer" ? `/customers/${row.id}`
      : row.kind === "lead" ? `/leads/${row.id}`
        : row.kind === "booking" ? `/bookings/${routeId}`
          : row.kind === "resource" ? `/resources/${row.code ?? row.id}`
            : row.kind === "task" ? `/tasks/${row.code ?? row.id}`
              : row.kind === "event" ? `/events/${routeId}`
                : row.code?.toUpperCase().startsWith("PO-") ? `/programs/runs/${routeId}`
                  : row.code?.toUpperCase().startsWith("PR-") ? `/programs/registrations/${routeId}`
                    : `/programs/${routeId}`
    return {
      kind: row.kind,
      id: row.id,
      code: row.code,
      title: row.title,
      meta: row.meta ?? "",
      href,
      phone: row.phone,
      email: row.email,
      archived: false,
      capabilities: {
        canView: actor.capabilities.canView,
        canEdit: actor.capabilities.canEdit,
        canArchive: actor.capabilities.canArchive,
      },
    }
  }
}
