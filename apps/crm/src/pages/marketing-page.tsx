import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react"
import { IconAlertTriangle, IconChartBar, IconDiscount2, IconReceipt, IconSearch, IconUsers } from "@tabler/icons-react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { MarketingPeriodSchema, type MarketingReport, type Promotion } from "@crm/contracts"
import {
  Button, DataTableShell, DateNavigator, FilterSelect, FormSelect, Input, MainSecondaryCell,
  PageFrame, PageNav, PageState, SettingsBar, Skeleton, SortableHeader, StatusBadge,
  SummaryMetric, SummaryMetricStrip, type DateRange,
} from "@crm/ui"
import { marketingRepository, type MarketingRepository } from "@app/data/marketing-repository"
import { fromIso, toIso } from "@app/components/bookings/booking-date"

const rub = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 2 })
const money = (minor: number) => rub.format(minor / 100)
const compactNumber = new Intl.NumberFormat("ru-RU", { notation: "compact", maximumFractionDigits: 1 })
const date = (value: string | null) => value
  ? new Date(value).toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "short", year: "numeric" }).replace(" г.", "")
  : "Без ограничения"

type PromotionStat = MarketingReport["promotions"][number]
type RegistryRow = Promotion & { stat: PromotionStat | null }
type Campaign = MarketingReport["campaigns"][number]
type Column<T> = { key: string; label: string; value: (row: T) => number | string; render: (row: T) => ReactNode }
const unknown = <span className="text-muted-foreground">—</span>
const statValue = (row: RegistryRow, key: keyof Omit<PromotionStat, "promotionId">) => row.stat?.[key] ?? -1

const promotionColumns: Column<RegistryRow>[] = [
  { key: "code", label: "Промокод", value: row => `${row.terms.code} ${row.terms.name}`, render: row => <MainSecondaryCell main={<span className="font-medium">{row.terms.code}</span>} secondary={row.terms.name} /> },
  { key: "active", label: "Статус", value: row => row.terms.active ? 1 : 0, render: row => <MainSecondaryCell><StatusBadge tone={row.terms.active ? "success" : "neutral"}>{row.terms.active ? "Активен" : "Выключен"}</StatusBadge></MainSecondaryCell> },
  { key: "discount", label: "Скидка", value: row => row.terms.value, render: row => <MainSecondaryCell main={row.terms.discountType === "percent" ? `${row.terms.value}%` : money(row.terms.value)} secondary={row.terms.minimumAmountMinor ? `от ${money(row.terms.minimumAmountMinor)}` : "без минимальной суммы"} /> },
  { key: "scope", label: "Применение", value: row => row.terms.scope === "all" ? "Все услуги" : row.terms.resourceIds.length + row.terms.offeringIds.length, render: row => <MainSecondaryCell main={row.terms.scope === "all" ? "Все услуги" : "Выбранные позиции"} secondary={row.terms.scope === "all" ? undefined : `${row.terms.resourceIds.length} ресурсов · ${row.terms.offeringIds.length} услуг`} /> },
  { key: "period", label: "Период", value: row => row.terms.startsAt ?? "", render: row => <MainSecondaryCell main={date(row.terms.startsAt)} secondary={`до ${date(row.terms.endsAt)}`} /> },
  { key: "bookings", label: "Брони", value: row => statValue(row, "bookings"), render: row => <MainSecondaryCell main={row.stat ? row.stat.bookings : unknown} secondary={row.stat ? `${row.stat.confirmedBookings} подтверждено` : "аналитика недоступна"} /> },
  { key: "paidAmountMinor", label: "Результат", value: row => statValue(row, "paidAmountMinor"), render: row => <MainSecondaryCell main={row.stat ? money(row.stat.paidAmountMinor) : unknown} secondary={row.stat ? `скидка ${money(row.stat.discountAmountMinor)}` : "аналитика недоступна"} /> },
]

const campaignColumns: Column<Campaign>[] = [
  { key: "source", label: "Источник", value: row => row.source || "", render: row => <MainSecondaryCell main={row.source || "Не указан"} secondary={row.medium || "канал не указан"} /> },
  { key: "campaign", label: "Кампания", value: row => row.campaign || "", render: row => <MainSecondaryCell main={row.campaign || "Не указана"} secondary={row.content || undefined} /> },
  { key: "term", label: "Ключевое слово", value: row => row.term || "", render: row => <MainSecondaryCell>{row.term || unknown}</MainSecondaryCell> },
  { key: "leads", label: "Заявки", value: row => row.leads, render: row => <MainSecondaryCell main={row.leads} secondary={`${row.qualifiedLeads} квалифицировано`} /> },
  { key: "bookings", label: "Брони", value: row => row.bookings, render: row => <MainSecondaryCell>{row.bookings}</MainSecondaryCell> },
  { key: "paidAmountMinor", label: "Оплачено", value: row => row.paidAmountMinor, render: row => <MainSecondaryCell className="whitespace-nowrap tabular-nums">{money(row.paidAmountMinor)}</MainSecondaryCell> },
]

export function MarketingPage({ repository = marketingRepository }: { repository?: MarketingRepository }) {
  const [params, setParams] = useSearchParams()
  const tab = params.get("tab") === "attribution" ? "attribution" : "promotions"
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date())
  const from = params.get("from") ?? `${today.slice(0, 7)}-01`
  const to = params.get("to") ?? today
  const query = params.get("q") ?? ""
  const status = params.get("status") ?? "all"
  const source = params.get("source") ?? "all"
  const medium = params.get("medium") ?? "all"
  const validPeriod = MarketingPeriodSchema.safeParse({ from, to }).success
  const [registry, setRegistry] = useState<{ items: Promotion[]; canManage: boolean } | null>(null)
  const [report, setReport] = useState<MarketingReport | null>(null)
  const [registryError, setRegistryError] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)
  const [registryLoading, setRegistryLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(true)
  const [registryRetry, setRegistryRetry] = useState(0)
  const [reportRetry, setReportRetry] = useState(0)

  useEffect(() => {
    let active = true
    setRegistryLoading(true); setRegistryError(null)
    repository.list()
      .then(data => { if (active) setRegistry(data) })
      .catch((reason: unknown) => { if (active) setRegistryError(errorMessage(reason, "Не удалось загрузить промокоды")) })
      .finally(() => { if (active) setRegistryLoading(false) })
    return () => { active = false }
  }, [registryRetry, repository])

  useEffect(() => {
    let active = true
    if (!validPeriod) { setReportLoading(false); setReport(null); return () => { active = false } }
    setReportLoading(true); setReportError(null)
    repository.report({ from, to })
      .then(data => { if (active) setReport(data) })
      .catch((reason: unknown) => { if (active) { setReport(null); setReportError(errorMessage(reason, "Аналитика временно недоступна")) } })
      .finally(() => { if (active) setReportLoading(false) })
    return () => { active = false }
  }, [from, reportRetry, repository, to, validPeriod])

  const setParam = (key: string, value: string, fallback?: string) => setParams(current => {
    const next = new URLSearchParams(current)
    if (!value || value === fallback) next.delete(key); else next.set(key, value)
    return next
  })
  const setRange = (range: DateRange | undefined) => {
    if (!range?.from) return
    const rangeFrom = range.from
    const rangeTo = range.to ?? rangeFrom
    setParams(current => {
      const next = new URLSearchParams(current)
      next.set("from", toIso(rangeFrom)); next.set("to", toIso(rangeTo))
      return next
    })
  }
  const shiftRange = (amount: number) => {
    const start = fromIso(from), end = fromIso(to)
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1)
    start.setDate(start.getDate() + amount * days); end.setDate(end.getDate() + amount * days)
    setRange({ from: start, to: end })
  }

  const rows = useMemo<RegistryRow[]>(() => {
    const normalized = query.trim().toLocaleLowerCase("ru")
    return (registry?.items ?? [])
      .filter(item => status === "all" || (status === "active") === item.terms.active)
      .filter(item => !normalized || `${item.terms.code} ${item.terms.name}`.toLocaleLowerCase("ru").includes(normalized))
      .map(item => ({ ...item, stat: report ? report.promotions.find(stat => stat.promotionId === item.id) ?? zeroStat(item.id) : null }))
  }, [query, registry, report, status])
  const campaigns = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru")
    return (report?.campaigns ?? [])
      .filter(row => source === "all" || row.source === source)
      .filter(row => medium === "all" || row.medium === medium)
      .filter(row => !normalized || [row.source, row.medium, row.campaign, row.content, row.term].join(" ").toLocaleLowerCase("ru").includes(normalized))
  }, [medium, query, report, source])
  const sourceOptions = useMemo(() => uniqueOptions(report?.campaigns.map(row => row.source) ?? [], "Все источники"), [report])
  const mediumOptions = useMemo(() => uniqueOptions(report?.campaigns.map(row => row.medium) ?? [], "Все каналы"), [report])

  return <PageFrame className="min-w-0 space-y-3" width="full">
    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
      <PageNav ariaLabel="Разделы маркетинга" className="min-w-0 flex-1" items={[{ value: "promotions", label: "Промокоды" }, { value: "attribution", label: "Источники" }]} onValueChange={value => setParam("tab", value, "promotions")} value={tab} />
    </div>
    <SettingsBar
      actions={tab === "promotions"
        ? <StatusFilter onChange={value => setParam("status", value, "all")} value={status} />
        : <><FilterSelect className="w-36" label="Источник" onValueChange={value => setParam("source", value, "all")} options={sourceOptions} value={source} /><FilterSelect className="w-32" label="Канал" onValueChange={value => setParam("medium", value, "all")} options={mediumOptions} value={medium} /></>}
      mobileActions={tab === "promotions"
        ? <StatusFilter compact onChange={value => setParam("status", value, "all")} value={status} />
        : <FilterSelect className="w-32" label="Источник" onValueChange={value => setParam("source", value, "all")} options={sourceOptions.map((option, index) => index === 0 ? { ...option, label: "Все" } : option)} value={source} />}
      primary={<DateNavigator label="Период аналитики" mode="range" nextLabel="Следующий период" onNext={() => shiftRange(1)} onPrevious={() => shiftRange(-1)} onValueChange={setRange} previousLabel="Предыдущий период" value={{ from: fromIso(from), to: fromIso(to) }} />}
      filters={<SearchField label={tab === "promotions" ? "Поиск промокодов" : "Поиск источников"} onChange={value => setParam("q", value)} placeholder={tab === "promotions" ? "Код или название" : "Источник или кампания"} value={query} />}
      mobilePrimary={<SearchField label={tab === "promotions" ? "Поиск промокодов" : "Поиск источников"} onChange={value => setParam("q", value)} placeholder="Поиск" value={query} />}
    />
    {!validPeriod ? <p className="text-xs text-danger-foreground" role="alert">Укажите корректный период: начало не позже окончания.</p> : null}
    {report ? <MarketingSummary report={report} tab={tab} /> : reportLoading ? <Skeleton aria-label="Загрузка аналитики" className="h-24 w-full" /> : reportError ? <InlineError message={reportError} onRetry={() => setReportRetry(value => value + 1)} /> : null}
    {tab === "promotions" ? (
      registryLoading ? <Skeleton aria-label="Загрузка промокодов" className="h-56 w-full" />
        : registryError ? <PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={() => setRegistryRetry(value => value + 1)} title="Промокоды не загрузились">{registryError}</PageState>
          : <MarketingTable columns={promotionColumns} empty="Промокодов пока нет" rowHref={row => `/marketing/promotions/${row.id}`} rowLabel={row => `Открыть промокод ${row.terms.code}`} rows={rows} rowKey={row => row.id} title="Промокоды" />
    ) : (
      reportLoading ? <Skeleton aria-label="Загрузка источников" className="h-56 w-full" />
        : reportError ? <PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={() => setReportRetry(value => value + 1)} title="Аналитика источников недоступна">{reportError}</PageState>
          : <MarketingTable columns={campaignColumns} empty="За выбранный период данных нет" rows={campaigns} rowKey={row => JSON.stringify([row.source, row.medium, row.campaign, row.content, row.term])} title="Источники и кампании" />
    )}
  </PageFrame>
}

function SearchField({ label, onChange, placeholder, value }: { label: string; onChange: (value: string) => void; placeholder: string; value: string }) {
  return <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border bg-background px-2.5 md:max-w-80"><IconSearch aria-hidden="true" className="size-4 text-muted-foreground" /><Input aria-label={label} className="h-7 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" onChange={event => onChange(event.target.value)} placeholder={placeholder} value={value} /></label>
}

function StatusFilter({ compact = false, onChange, value }: { compact?: boolean; onChange: (value: string) => void; value: string }) {
  return <FilterSelect className={compact ? "w-32" : "w-36"} label="Статус" onValueChange={onChange} options={[{ value: "all", label: compact ? "Все" : "Все статусы" }, { value: "active", label: "Активные" }, { value: "inactive", label: "Выключенные" }]} value={value} />
}

function MarketingSummary({ report, tab }: { report: MarketingReport; tab: "attribution" | "promotions" }) {
  const campaign = report.campaigns.reduce((sum, row) => ({ leads: sum.leads + row.leads, bookings: sum.bookings + row.bookings, paid: sum.paid + row.paidAmountMinor }), { leads: 0, bookings: 0, paid: 0 })
  const promotion = report.promotions.reduce((sum, row) => ({ bookings: sum.bookings + row.bookings, discount: sum.discount + row.discountAmountMinor, paid: sum.paid + row.paidAmountMinor }), { bookings: 0, discount: 0, paid: 0 })
  const values = tab === "promotions"
    ? [{ icon: IconDiscount2, label: "Использований", value: promotion.bookings, detail: "Брони с промокодом" }, { icon: IconReceipt, label: "Скидок выдано", value: money(promotion.discount), detail: "По выбранным броням" }, { icon: IconChartBar, label: "Оплачено", value: money(promotion.paid), detail: "Оплаты минус возвраты" }]
    : [{ icon: IconUsers, label: "Заявки", value: campaign.leads, detail: "По сохранённым UTM" }, { icon: IconDiscount2, label: "Брони", value: campaign.bookings, detail: "Связаны с заявками" }, { icon: IconChartBar, label: "Оплачено", value: money(campaign.paid), detail: "По связанным броням" }]
  return <SummaryMetricStrip ariaLabel="Сводка маркетинга" className="[&>div>div]:lg:grid-cols-3">{values.map(item => <SummaryMetric icon={item.icon} key={item.label} label={item.label} value={item.value}>{item.detail}</SummaryMetric>)}</SummaryMetricStrip>
}

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-subtle px-3 py-2 text-xs"><IconAlertTriangle aria-hidden="true" className="size-4 shrink-0" /><span className="min-w-0 flex-1">Аналитика недоступна: {message}</span><Button onClick={onRetry} size="xs" variant="outline">Повторить</Button></div>
}

function MarketingTable<T>({ columns, empty, rowHref, rowKey, rowLabel, rows, title }: { columns: Column<T>[]; empty: string; rowHref?: (row: T) => string; rowKey: (row: T) => string; rowLabel?: (row: T) => string; rows: T[]; title: string }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const selected = columns.find(column => column.key === params.get("sort")) ?? columns[0]!
  const direction = params.get("order") === "desc" ? "desc" : "asc"
  const sort = (key: string) => setParams(current => { const next = new URLSearchParams(current); next.set("sort", key); next.set("order", selected.key === key && direction === "asc" ? "desc" : "asc"); return next })
  const sorted = [...rows].sort((a, b) => {
    const left = selected.value(a), right = selected.value(b)
    const result = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), "ru")
    return direction === "asc" ? result : -result
  })
  if (!rows.length) return <PageState icon={IconChartBar} title={empty}>Измените фильтры или период.</PageState>
  return <section aria-label={title} className="min-w-0 space-y-2">
    <div className="flex items-center gap-2 lg:hidden"><FormSelect id={`marketing-sort-${title}`} label="Сортировать по" onValueChange={sort} options={columns.map(column => ({ value: column.key, label: column.label }))} value={selected.key} /><Button aria-label="Изменить направление сортировки" onClick={() => sort(selected.key)} variant="outline">{direction === "asc" ? "↑" : "↓"}</Button></div>
    <div className="space-y-2 lg:hidden">{sorted.map(row => rowHref ? <Link aria-label={rowLabel?.(row)} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" key={rowKey(row)} to={rowHref(row)}><article className="min-w-0 rounded-xl border bg-surface-raised p-3 shadow-xs transition-colors hover:bg-muted/30"><PromotionMobileCard row={row as RegistryRow} /></article></Link> : <article className="min-w-0 rounded-xl border bg-surface-raised p-3 shadow-xs" key={rowKey(row)}><CampaignMobileCard row={row as Campaign} /></article>)}</div>
    <DataTableShell className="hidden lg:block"><thead className="border-b bg-muted/40"><tr>{columns.map(column => <SortableHeader active={selected.key === column.key} className="whitespace-nowrap" direction={direction} key={column.key} onSort={() => sort(column.key)}>{column.label}</SortableHeader>)}</tr></thead><tbody className="divide-y">{sorted.map(row => <tr aria-label={rowLabel?.(row)} className={rowHref ? "cursor-pointer hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" : "hover:bg-muted/30"} key={rowKey(row)} onClick={rowHref ? () => navigate(rowHref(row)) : undefined} onKeyDown={rowHref ? event => { if (event.key === "Enter") navigate(rowHref(row)) } : undefined} tabIndex={rowHref ? 0 : undefined}>{columns.map(column => <Fragment key={column.key}>{column.render(row)}</Fragment>)}</tr>)}</tbody></DataTableShell>
  </section>
}

function PromotionMobileCard({ row }: { row: RegistryRow }) {
  return <div className="space-y-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-medium">{row.terms.code}</p><p className="truncate text-xs text-muted-foreground">{row.terms.name}</p></div><StatusBadge tone={row.terms.active ? "success" : "neutral"}>{row.terms.active ? "Активен" : "Выключен"}</StatusBadge></div><div className="grid grid-cols-3 gap-2 border-t pt-2 text-xs"><Metric label="Скидка" value={row.terms.discountType === "percent" ? `${row.terms.value}%` : money(row.terms.value)} /><Metric label="Брони" value={row.stat ? row.stat.bookings : "—"} /><Metric label="Оплачено" value={row.stat ? compactNumber.format(row.stat.paidAmountMinor / 100) + " ₽" : "—"} /></div></div>
}

function CampaignMobileCard({ row }: { row: Campaign }) {
  return <div className="space-y-3"><div><p className="font-medium">{row.source || "Источник не указан"}</p><p className="truncate text-xs text-muted-foreground">{[row.medium, row.campaign].filter(Boolean).join(" · ") || "Без кампании"}</p></div><div className="grid grid-cols-3 gap-2 border-t pt-2 text-xs"><Metric label="Заявки" value={row.leads} /><Metric label="Брони" value={row.bookings} /><Metric label="Оплачено" value={compactNumber.format(row.paidAmountMinor / 100) + " ₽"} /></div></div>
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return <div className="min-w-0"><p className="text-[11px] text-muted-foreground">{label}</p><p className="truncate tabular-nums">{value}</p></div>
}

function zeroStat(promotionId: string): PromotionStat {
  return { promotionId, bookings: 0, confirmedBookings: 0, discountAmountMinor: 0, bookingAmountMinor: 0, paidAmountMinor: 0 }
}

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback
}

function uniqueOptions(values: string[], allLabel: string) {
  return [{ value: "all", label: allLabel }, ...[...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, "ru")).map(value => ({ value, label: value }))]
}
