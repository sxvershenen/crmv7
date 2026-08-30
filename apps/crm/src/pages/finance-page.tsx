import { useMemo, useState } from "react"
import {
  IconAlertTriangle,
  IconArrowDown,
  IconCalendarDollar,
  IconCalendarEvent,
  IconCash,
  IconChartAreaLine,
  IconChartBar,
  IconClockDollar,
  IconCreditCard,
  IconCurrencyRuble,
  IconDotsVertical,
  IconExternalLink,
  IconFilter,
  IconLink,
  IconReceiptRefund,
  IconRotateClockwise,
  IconTrendingUp,
  IconWallet,
} from "@tabler/icons-react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"

import {
  Assignees,
  Badge,
  Button,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Checkbox,
  ClickableCard,
  ConfirmationDialog,
  DataTableShell,
  DateNavigator,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EntityCardAssignees,
  EntityCardDetails,
  EntityCardInfoRow,
  EntityCardLayout,
  EntityCardRail,
  FilterSelect,
  ListRow,
  ListSection,
  MainSecondaryCell,
  PageFrame,
  PageNav,
  PageState,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaymentProgress,
  RowActions,
  SettingsBar,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  SortableHeader,
  StatusBadge,
  SummaryMetric,
  SummaryMetricStrip,
  cn,
  type ChartConfig,
  type DateRange,
} from "@crm/ui"

import { financeRepository, type FinanceRepository } from "@app/data/finance-repository"
import type { FinanceDataset, FinanceOperation, FinancePeriod, FinanceQuery, FinanceSection, FinanceSortKey } from "@app/entities/finance"
import { financeMethodLabels, financeMethods, financeOperationTypeLabels, financeOperationTypes, financePeriodLabels, financePeriods, financeSectionLabels, financeSections, financeSortKeys } from "@app/entities/finance"
import { useFinance } from "@app/features/use-finance"

const money = new Intl.NumberFormat("ru-RU", { currency: "RUB", maximumFractionDigits: 0, style: "currency" })
const navItems = financeSections.map((value) => ({ value, label: financeSectionLabels[value] }))
const periodRanges: Record<FinancePeriod, [string, string]> = { today: ["2026-08-24", "2026-08-24"], week: ["2026-08-18", "2026-08-24"], month: ["2026-08-01", "2026-08-24"], quarter: ["2026-06-01", "2026-08-31"] }
const pageSize = 5
const moneyChartConfig = {
  accrued: { label: "Начислено", color: "var(--chart-2)" },
  paid: { label: "Оплачено", color: "var(--chart-5)" },
  debt: { label: "Долг", color: "var(--chart-3)" },
  refunds: { label: "Возвраты", color: "var(--chart-1)" },
  ratio: { label: "Собираемость", color: "var(--chart-5)" },
  paymentCount: { label: "Оплаты", color: "var(--chart-4)" },
} satisfies ChartConfig

function oneOf<T extends string>(value: string | null, options: readonly T[], fallback: T): T { return value && options.includes(value as T) ? value as T : fallback }
function fromIso(value: string) { return new Date(`${value}T12:00:00`) }
function toIso(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}` }
function shiftIso(value: string, days: number) { const date = fromIso(value); date.setDate(date.getDate() + days); return toIso(date) }
function positiveInteger(value: string | null, fallback: number) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback }

export function FinancePage({ repository = financeRepository }: { repository?: FinanceRepository }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const section = oneOf(params.get("section"), financeSections, "summary")
  const period = oneOf(params.get("period"), financePeriods, "week")
  const defaults = periodRanges[period]
  const date = params.get("date") ?? defaults[0]
  const rangeEnd = params.get("to") ?? defaults[1]
  const type = oneOf(params.get("type"), ["all", ...financeOperationTypes] as const, "all")
  const method = oneOf(params.get("method"), ["all", ...financeMethods] as const, "all")
  const refundsOnly = params.get("refunds") === "1"
  const sortKey = oneOf(params.get("sort"), financeSortKeys, "date")
  const sortDirection = oneOf(params.get("order"), ["asc", "desc"] as const, "desc")
  const page = positiveInteger(params.get("page"), 1)
  const query = useMemo<FinanceQuery>(() => ({ section, date, rangeEnd, type, method, refundsOnly, page, pageSize, sort: { key: sortKey, direction: sortDirection } }), [date, method, page, rangeEnd, refundsOnly, section, sortDirection, sortKey, type])
  const { mutationError, refund, retry, state } = useFinance(query, repository)
  const setParam = (name: string, value: string, fallback = "all", resetPage = true) => setParams((current) => { const next = new URLSearchParams(current); if (value === fallback) next.delete(name); else next.set(name, value); if (resetPage) next.delete("page"); return next })
  const setRange = (from: string, to: string) => setParams((current) => { const next = new URLSearchParams(current); next.set("date", from); next.set("to", to); next.delete("page"); return next })
  const setPeriod = (nextPeriod: FinancePeriod) => setParams((current) => { const next = new URLSearchParams(current); next.set("period", nextPeriod); next.delete("date"); next.delete("to"); next.delete("page"); return next })
  const resetFilters = () => setParams((current) => { const next = new URLSearchParams(current); for (const key of ["type", "method", "refunds", "page"]) next.delete(key); return next })
  const sort = (key: FinanceSortKey) => setParams((current) => { const next = new URLSearchParams(current); next.set("sort", key); next.set("order", sortKey === key && sortDirection === "asc" ? "desc" : "asc"); next.delete("page"); return next })
  const setPage = (nextPage: number) => setParam("page", String(nextPage), "1", false)
  const duration = Math.max(1, Math.round((fromIso(rangeEnd).getTime() - fromIso(date).getTime()) / 86_400_000) + 1)
  const activeFilters = Number(type !== "all") + Number(method !== "all") + Number(refundsOnly)
  const range: DateRange = { from: fromIso(date), to: fromIso(rangeEnd) }

  return <PageFrame className="space-y-3" width="full">
    <PageNav ariaLabel="Разделы финансов" items={navItems} onValueChange={(value) => setParam("section", value, "summary")} value={section} />
    <SettingsBar
      filters={<><FilterSelect label="Быстрый период" onValueChange={(value) => setPeriod(value as FinancePeriod)} options={financePeriods.map((value) => ({ value, label: financePeriodLabels[value] }))} value={period} /><FilterSelect label="Тип операции" onValueChange={(value) => setParam("type", value)} options={[{ value: "all", label: "Все операции" }, ...financeOperationTypes.map((value) => ({ value, label: financeOperationTypeLabels[value] }))]} value={type} /><FilterSelect label="Способ оплаты" onValueChange={(value) => setParam("method", value)} options={[{ value: "all", label: "Все способы" }, ...financeMethods.map((value) => ({ value, label: financeMethodLabels[value] }))]} value={method} /><label className="flex min-h-8 items-center gap-2 px-1 text-xs"><Checkbox checked={refundsOnly} onCheckedChange={(checked) => setParam("refunds", checked ? "1" : "0", "0")} />Только возвраты</label>{activeFilters ? <Button onClick={resetFilters} size="xs" variant="ghost">Сбросить · {activeFilters}</Button> : null}</>}
      mobileActions={<FinanceMobileFilters activeFilters={activeFilters} method={method} onMethodChange={(value) => setParam("method", value)} onPeriodChange={setPeriod} onRefundsChange={(checked) => setParam("refunds", checked ? "1" : "0", "0")} onReset={resetFilters} onTypeChange={(value) => setParam("type", value)} period={period} refundsOnly={refundsOnly} type={type} />}
      primary={<DateNavigator label="Финансовый период" mode="range" onNext={() => setRange(shiftIso(date, duration), shiftIso(rangeEnd, duration))} onPrevious={() => setRange(shiftIso(date, -duration), shiftIso(rangeEnd, -duration))} onValueChange={(next) => next?.from && setRange(toIso(next.from), toIso(next.to ?? next.from))} value={range} />}
    />
    {state.status === "loading" ? <FinanceLoading /> : null}
    {state.status === "error" ? <div className="rounded-xl border bg-surface-raised"><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={retry} title="Финансы не загрузились" tone="danger">{state.message}</PageState></div> : null}
    {mutationError ? <p aria-live="polite" className="rounded-lg border border-danger/25 bg-danger-subtle px-3 py-2 text-xs text-danger-foreground">{mutationError}</p> : null}
    {state.status === "ready" ? <FinanceContent data={state.data} onOpen={(href) => navigate(href)} onPage={setPage} onRefund={refund} onSort={sort} section={section} sortDirection={sortDirection} sortKey={sortKey} /> : null}
  </PageFrame>
}

function FinanceMobileFilters({ activeFilters, method, onMethodChange, onPeriodChange, onRefundsChange, onReset, onTypeChange, period, refundsOnly, type }: { activeFilters: number; method: FinanceQuery["method"]; onMethodChange: (value: string) => void; onPeriodChange: (value: FinancePeriod) => void; onRefundsChange: (checked: boolean) => void; onReset: () => void; onTypeChange: (value: string) => void; period: FinancePeriod; refundsOnly: boolean; type: FinanceQuery["type"] }) {
  return <Sheet><SheetTrigger render={<Button aria-label="Фильтры финансов" size="sm" variant="outline" />}><IconFilter aria-hidden="true" />{activeFilters > 0 ? <Badge className="min-w-5 justify-center" variant="secondary">{activeFilters}</Badge> : null}</SheetTrigger><SheetContent className="w-full" side="bottom"><SheetHeader><SheetTitle>Фильтры финансов</SheetTitle><SheetDescription>Период, тип операции и способ оплаты.</SheetDescription></SheetHeader><div className="grid gap-3 px-4 pb-4 sm:grid-cols-2"><FilterSelect className="max-w-none" label="Быстрый период" onValueChange={(value) => onPeriodChange(value as FinancePeriod)} options={financePeriods.map((value) => ({ value, label: financePeriodLabels[value] }))} value={period} /><FilterSelect className="max-w-none" label="Тип операции" onValueChange={onTypeChange} options={[{ value: "all", label: "Все операции" }, ...financeOperationTypes.map((value) => ({ value, label: financeOperationTypeLabels[value] }))]} value={type} /><FilterSelect className="max-w-none" label="Способ оплаты" onValueChange={onMethodChange} options={[{ value: "all", label: "Все способы" }, ...financeMethods.map((value) => ({ value, label: financeMethodLabels[value] }))]} value={method} /><label className="flex min-h-8 items-center gap-2 rounded-lg border px-3 text-xs"><Checkbox checked={refundsOnly} onCheckedChange={(checked) => onRefundsChange(checked === true)} />Только возвраты</label>{activeFilters > 0 ? <Button className="sm:col-span-2" onClick={onReset} size="sm" variant="outline">Сбросить фильтры</Button> : null}</div></SheetContent></Sheet>
}

function FinanceContent({ data, onOpen, onPage, onRefund, onSort, section, sortDirection, sortKey }: { data: FinanceDataset; onOpen: (href: string) => void; onPage: (page: number) => void; onRefund: (operationId: string) => Promise<void>; onSort: (key: FinanceSortKey) => void; section: FinanceSection; sortDirection: "asc" | "desc"; sortKey: FinanceSortKey }) {
  return <div className="space-y-3" data-testid="finance-content">
    <FinanceMetrics data={data} />
    {section === "dynamics" ? <FinanceDynamics data={data} /> : <><FinanceTrendChart data={data} /><div className="grid items-start gap-3 lg:grid-cols-2"><ExpectedPayments data={data} /><FinanceBreakdown data={data} section={section} /></div></>}
    <FinanceOperations data={data} onOpen={onOpen} onPage={onPage} onRefund={onRefund} onSort={onSort} sortDirection={sortDirection} sortKey={sortKey} />
  </div>
}

function FinanceMetrics({ data }: { data: FinanceDataset }) {
  const s = data.summary
  const metrics = [
    { label: "Начислено", value: money.format(s.accrued), icon: IconCurrencyRuble, tone: "neutral" as const, detail: `Операций · ${data.pagination.total}` },
    { label: "Оплачено", value: money.format(s.paid), icon: IconWallet, tone: "success" as const, detail: `Доля · ${s.accrued ? Math.round(s.paid / s.accrued * 100) : 0}%` },
    { label: "Долг", value: money.format(s.debt), icon: IconArrowDown, tone: "warning" as const, detail: `Ожидается · ${money.format(s.expected)}` },
    { label: "Возвраты", value: money.format(s.refunds), icon: IconReceiptRefund, tone: "danger" as const, detail: "За выбранный период" },
    { label: "Средний чек", value: money.format(s.average), icon: IconCash, tone: "info" as const, detail: "По принятым оплатам" },
    { label: "Ожидается", value: money.format(s.expected), icon: IconCalendarDollar, tone: "task" as const, detail: `Платежей · ${data.expected.length}` },
    { label: "Просрочено", value: money.format(s.overdue), icon: IconClockDollar, tone: "warning" as const, detail: `Платежей · ${data.expected.filter((item) => item.overdue).length}` },
  ]
  return <SummaryMetricStrip ariaLabel="Финансовые показатели">{metrics.map((item) => <SummaryMetric icon={item.icon} key={item.label} label={item.label} tone={item.tone} value={item.value}>{item.detail}</SummaryMetric>)}</SummaryMetricStrip>
}

function ChartPanel({ children, count, icon, testId, title, tone = "info" }: { children: React.ReactNode; count: number; icon: React.ElementType; testId?: string; title: string; tone?: "danger" | "info" | "neutral" | "success" | "task" | "warning" }) {
  return <div className="overflow-hidden rounded-xl border bg-surface-raised shadow-[0_1px_2px_rgb(0_0_0/0.02)]" data-testid={testId}><ListSection count={count} icon={icon} title={title} tone={tone}><ListRow className="p-3 sm:p-4">{children}</ListRow></ListSection></div>
}

function FinanceTrendChart({ data }: { data: FinanceDataset }) {
  return <ChartPanel count={data.points.length} icon={IconChartAreaLine} testId="finance-chart" title="Динамика начислений и оплат"><ChartContainer className="h-[240px] w-full sm:h-[280px]" config={moneyChartConfig}><AreaChart accessibilityLayer data={data.points} margin={{ left: 4, right: 4, top: 8 }}><defs><linearGradient id="fillAccrued" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="var(--color-accrued)" stopOpacity={0.28} /><stop offset="95%" stopColor="var(--color-accrued)" stopOpacity={0.02} /></linearGradient><linearGradient id="fillPaid" x1="0" x2="0" y1="0" y2="1"><stop offset="5%" stopColor="var(--color-paid)" stopOpacity={0.24} /><stop offset="95%" stopColor="var(--color-paid)" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} /><XAxis axisLine={false} dataKey="label" minTickGap={18} tickLine={false} tickMargin={10} /><YAxis hide /><ChartTooltip content={<ChartTooltipContent indicator="line" />} /><Area dataKey="accrued" fill="url(#fillAccrued)" stroke="var(--color-accrued)" strokeWidth={2} type="monotone" /><Area dataKey="paid" fill="url(#fillPaid)" stroke="var(--color-paid)" strokeWidth={2} type="monotone" /></AreaChart></ChartContainer></ChartPanel>
}

function FinanceDynamics({ data }: { data: FinanceDataset }) {
  const points = data.points.map((point) => ({ ...point, ratio: point.accrued ? Math.round(point.paid / point.accrued * 100) : 0 }))
  return <section aria-label="Подробная динамика" className="space-y-3" data-testid="finance-dynamics"><FinanceTrendChart data={data} /><div className="grid gap-3 lg:grid-cols-3"><ChartPanel count={points.length} icon={IconArrowDown} title="Долг и возвраты" tone="warning"><ChartContainer className="h-[190px] w-full" config={moneyChartConfig}><AreaChart accessibilityLayer data={points} margin={{ left: 4, right: 4, top: 8 }}><CartesianGrid vertical={false} /><XAxis axisLine={false} dataKey="label" minTickGap={24} tickLine={false} tickMargin={8} /><YAxis hide /><ChartTooltip content={<ChartTooltipContent indicator="line" />} /><Area dataKey="debt" fill="var(--color-debt)" fillOpacity={0.12} stroke="var(--color-debt)" strokeWidth={2} type="monotone" /><Line dataKey="refunds" dot={{ r: 3 }} stroke="var(--color-refunds)" strokeWidth={2} type="monotone" /></AreaChart></ChartContainer></ChartPanel><ChartPanel count={points.at(-1)?.ratio ?? 0} icon={IconTrendingUp} title="Собираемость, %" tone="success"><ChartContainer className="h-[190px] w-full" config={moneyChartConfig}><LineChart accessibilityLayer data={points} margin={{ left: 4, right: 4, top: 8 }}><CartesianGrid vertical={false} /><XAxis axisLine={false} dataKey="label" minTickGap={24} tickLine={false} tickMargin={8} /><YAxis domain={[0, 100]} hide /><ReferenceLine stroke="var(--border)" strokeDasharray="3 3" y={80} /><ChartTooltip content={<ChartTooltipContent indicator="line" />} /><Line dataKey="ratio" dot={{ r: 3 }} stroke="var(--color-ratio)" strokeWidth={2} type="monotone" /></LineChart></ChartContainer></ChartPanel><ChartPanel count={points.reduce((sum, point) => sum + point.paymentCount, 0)} icon={IconCreditCard} title="Количество оплат" tone="task"><ChartContainer className="h-[190px] w-full" config={moneyChartConfig}><LineChart accessibilityLayer data={points} margin={{ left: 4, right: 4, top: 8 }}><CartesianGrid vertical={false} /><XAxis axisLine={false} dataKey="label" minTickGap={24} tickLine={false} tickMargin={8} /><YAxis allowDecimals={false} hide /><ChartTooltip content={<ChartTooltipContent indicator="line" />} /><Line dataKey="paymentCount" dot={{ r: 3 }} stroke="var(--color-paymentCount)" strokeWidth={2} type="linear" /></LineChart></ChartContainer></ChartPanel></div></section>
}

function ExpectedPayments({ data }: { data: FinanceDataset }) {
  return <div className="overflow-hidden rounded-xl border bg-surface-raised"><ListSection count={data.expected.length} icon={IconClockDollar} title="Ближайшие ожидаемые оплаты" tone="warning">{data.expected.map((item) => <ListRow key={item.id}><div className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(160px,220px)] sm:items-center"><div className="min-w-0"><p className="truncate text-xs font-normal">{item.clientName}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{item.relationLabel} · {item.dueLabel}</p></div><PaymentProgress className="w-full min-w-0" paid={item.paid} total={item.total} /></div></ListRow>)}</ListSection></div>
}

function FinanceBreakdown({ data, section }: { data: FinanceDataset; section: FinanceSection }) {
  const resourceSection = ["houses", "bath", "venues", "camping"].includes(section)
  const categorySection = section === "programs" || section === "events"
  const items = section === "sources" ? data.sourceBreakdown : resourceSection || categorySection ? data.breakdownDetails.filter((item) => item.section === section) : data.breakdown
  const title = section === "sources" ? "По источникам" : resourceSection ? "По ресурсам" : categorySection ? "По категориям" : "По направлениям"
  return <div className="overflow-hidden rounded-xl border bg-surface-raised"><ListSection count={items.length} icon={IconChartBar} title={title} tone="info">{items.map((item) => <ListRow key={item.id}><div className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(160px,220px)] sm:items-center">{"href" in item ? <Link className="min-w-0 truncate text-xs font-normal underline-offset-2 hover:underline" to={String(item.href)}>{item.label}</Link> : <p className="truncate text-xs font-normal">{item.label}</p>}<PaymentProgress className="w-full min-w-0" paid={item.paid} total={item.accrued} /></div></ListRow>)}</ListSection></div>
}

function FinanceOperations({ data, onOpen, onPage, onRefund, onSort, sortDirection, sortKey }: { data: FinanceDataset; onOpen: (href: string) => void; onPage: (page: number) => void; onRefund: (operationId: string) => Promise<void>; onSort: (key: FinanceSortKey) => void; sortDirection: "asc" | "desc"; sortKey: FinanceSortKey }) {
  const header = (key: FinanceSortKey, label: string, className?: string) => <SortableHeader active={sortKey === key} className={className} direction={sortDirection} onSort={() => onSort(key)}>{label}</SortableHeader>
  const refundedPaymentIds = new Set(data.operations.filter((item) => item.type === "refund").map((item) => item.sourcePaymentId).filter(Boolean))
  return <section aria-label="Реестр операций"><div className="mb-2 flex items-center justify-between px-1"><h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">Реестр операций</h2><span className="text-[10px] text-muted-foreground">{data.pagination.from}–{data.pagination.to} из {data.pagination.total}</span></div><div className="space-y-2 lg:hidden" data-testid="mobile-finance-operations">{data.operations.map((item) => <FinanceOperationCard item={item} key={item.id} onOpen={onOpen} onRefund={onRefund} refunded={refundedPaymentIds.has(item.id)} />)}</div><DataTableShell className="hidden lg:block" data-testid="finance-table" tableClassName="min-w-[1120px] table-fixed"><thead className="border-b bg-muted/45"><tr>{header("date", "Дата", "w-[135px]")}{header("type", "Тип", "w-[125px]")}{header("amount", "Сумма", "w-[115px]")}{header("client", "Клиент", "w-[165px]")}{header("relation", "Связь", "w-[190px]")}{header("method", "Способ", "w-[100px]")}{header("source", "Источник", "w-[95px]")}{header("assignee", "Ответственный", "w-[110px]")}<th className="w-12"><span className="sr-only">Действия</span></th></tr></thead><tbody className="divide-y">{data.operations.map((item) => <tr className="hover:bg-muted/35" key={item.id}><MainSecondaryCell main={item.dateLabel} secondary={`#${item.id}`} /><MainSecondaryCell><OperationType item={item} /></MainSecondaryCell><MainSecondaryCell className="whitespace-nowrap tabular-nums">{money.format(item.amount)}</MainSecondaryCell><MainSecondaryCell>{item.clientName}</MainSecondaryCell><MainSecondaryCell><Link className="underline-offset-2 hover:underline" to={item.relationHref}>{item.relationLabel}</Link></MainSecondaryCell><MainSecondaryCell>{financeMethodLabels[item.method]}</MainSecondaryCell><MainSecondaryCell>{item.source}</MainSecondaryCell><MainSecondaryCell><Assignees people={item.assignees} size="compact" /></MainSecondaryCell><RowActions><OperationMenu item={item} onRefund={onRefund} refunded={refundedPaymentIds.has(item.id)} /></RowActions></tr>)}</tbody></DataTableShell>{data.operations.length === 0 ? <div className="rounded-xl border bg-surface-raised"><PageState icon={IconCash} title="Операций нет">Измените период или фильтры.</PageState></div> : null}<FinanceRegistryPagination data={data} onPage={onPage} /></section>
}

function FinanceOperationCard({ item, onOpen, onRefund, refunded }: { item: FinanceOperation; onOpen: (href: string) => void; onRefund: (operationId: string) => Promise<void>; refunded: boolean }) {
  const rail = <EntityCardRail><div className="pointer-events-auto"><OperationMenu item={item} onRefund={onRefund} refunded={refunded} /></div><EntityCardAssignees people={item.assignees} /></EntityCardRail>
  return <div className="relative"><ClickableCard aria-label={`Открыть связь операции ${item.id}`} className="absolute inset-0 h-full min-h-0 p-0" onClick={() => onOpen(item.relationHref)} /><div className="pointer-events-none relative p-3"><EntityCardLayout rail={rail}><div className="min-w-0"><p className="truncate leading-4" title={item.clientName}>{item.clientName}</p><div className="mt-0.5 flex items-center gap-2 text-[11px] leading-4 text-muted-foreground"><span className="tabular-nums">#{item.id}</span><OperationType item={item} /></div></div><EntityCardDetails><EntityCardInfoRow icon={IconCurrencyRuble}><span className="truncate tabular-nums text-foreground">{money.format(item.amount)}</span></EntityCardInfoRow><EntityCardInfoRow icon={IconLink}><span className="line-clamp-2">{item.relationLabel}</span></EntityCardInfoRow><EntityCardInfoRow icon={IconCalendarEvent}><span className="truncate tabular-nums">{item.dateLabel}</span></EntityCardInfoRow><EntityCardInfoRow icon={IconCreditCard}><span className="truncate">{financeMethodLabels[item.method]} · {item.source}</span></EntityCardInfoRow></EntityCardDetails></EntityCardLayout></div></div>
}

function FinanceRegistryPagination({ data, onPage }: { data: FinanceDataset; onPage: (page: number) => void }) {
  const { page, totalPages } = data.pagination
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)
  const navigate = (event: React.MouseEvent<HTMLAnchorElement>, nextPage: number) => { event.preventDefault(); if (nextPage >= 1 && nextPage <= totalPages) onPage(nextPage) }
  return <Pagination className="mt-3 justify-end" data-testid="finance-pagination"><PaginationContent><PaginationItem><PaginationPrevious aria-disabled={page === 1} className={cn("text-xs font-normal", page === 1 && "pointer-events-none opacity-50")} href={`?page=${Math.max(1, page - 1)}`} onClick={(event) => navigate(event, page - 1)} text="Назад" /></PaginationItem>{pages.map((value) => <PaginationItem key={value}><PaginationLink href={`?page=${value}`} isActive={page === value} onClick={(event) => navigate(event, value)} size="icon-sm">{value}</PaginationLink></PaginationItem>)}<PaginationItem><PaginationNext aria-disabled={page === totalPages} className={cn("text-xs font-normal", page === totalPages && "pointer-events-none opacity-50")} href={`?page=${Math.min(totalPages, page + 1)}`} onClick={(event) => navigate(event, page + 1)} text="Дальше" /></PaginationItem></PaginationContent></Pagination>
}

function OperationType({ item }: { item: FinanceOperation }) { const tone = item.type === "payment" ? "success" : item.type === "refund" ? "danger" : item.type === "adjustment" ? "warning" : "neutral"; return <StatusBadge tone={tone}>{financeOperationTypeLabels[item.type]}</StatusBadge> }
function OperationMenu({ item, onRefund, refunded }: { item: FinanceOperation; onRefund: (operationId: string) => Promise<void>; refunded: boolean }) { const [confirmOpen, setConfirmOpen] = useState(false); const [submitting, setSubmitting] = useState(false); const submit = async () => { setSubmitting(true); try { await onRefund(item.id); setConfirmOpen(false) } finally { setSubmitting(false) } }; return <><DropdownMenu><DropdownMenuTrigger render={<Button aria-label={`Действия операции ${item.id}`} size="icon-sm" variant="ghost" />}><IconDotsVertical aria-hidden="true" className="size-[18px]" /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem render={<Link to={item.relationHref} />}><IconExternalLink aria-hidden="true" />Открыть запись</DropdownMenuItem>{item.type === "payment" ? <DropdownMenuItem disabled={refunded || submitting} onClick={() => setConfirmOpen(true)}><IconRotateClockwise aria-hidden="true" />{refunded ? "Возврат оформлен" : submitting ? "Оформляем…" : "Оформить возврат"}</DropdownMenuItem> : null}</DropdownMenuContent></DropdownMenu><ConfirmationDialog confirmLabel={submitting ? "Оформляем…" : "Оформить возврат"} description={`Оформить возврат ${money.format(item.amount)} по операции #${item.id}? Исходная запись: ${item.relationLabel}.`} destructive onConfirm={() => { void submit() }} onOpenChange={setConfirmOpen} open={confirmOpen} title="Подтвердить возврат" /></> }
function FinanceLoading() { return <div aria-label="Загрузка финансов" role="status"><div className="flex gap-2 overflow-hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">{Array.from({ length: 7 }, (_, index) => <Skeleton className="h-24 w-[calc(100%-2rem)] shrink-0 rounded-xl sm:w-auto" key={index} />)}</div><Skeleton className="mt-3 h-72 rounded-xl" /></div> }
