import type { ElementType, ReactNode } from "react"
import {
  IconAlertTriangle,
  IconBuildingCottage,
  IconCalendar,
  IconCurrencyRuble,
  IconExternalLink,
  IconFileText,
  IconHome,
  IconLink,
  IconLock,
  IconTag,
  IconTent,
} from "@tabler/icons-react"

import type { InternalOfferingEditor, PriceBook } from "@crm/contracts"
import {
  Button,
  EditorSection,
  IconBox,
  LoadingRows,
  PageState,
  StatusBadge,
  SummaryMetric,
  SummaryMetricStrip,
} from "@crm/ui"

import {
  bindingTargetLabel,
  compactDate,
  compactDateTime,
  minorMoney,
  priceBookLabel,
  priceBookTone,
  priceDisplayLabel,
  salesModeLabel,
  taxModeLabel,
} from "./house-offering-workspace-model.js"

export function WorkspaceLoading() {
  return <div aria-label="Загрузка редактора домика" className="space-y-3" role="status"><div className="overflow-hidden rounded-xl border bg-background"><LoadingRows count={4} /></div><div className="h-48 animate-pulse rounded-xl border bg-muted/30" /></div>
}

export function WorkspaceState({ actionLabel, children, icon, onAction, title, tone = "neutral" }: { actionLabel?: string; children?: ReactNode; icon: ElementType; onAction?: () => void; title: string; tone?: "neutral" | "danger" }) {
  return <div className="rounded-xl border bg-background"><PageState {...(actionLabel ? { actionLabel } : {})} icon={icon} {...(onAction ? { onAction } : {})} title={title} tone={tone}>{children}</PageState></div>
}

export function ResourceSaleHeader({ editor }: { editor: InternalOfferingEditor }) {
  const active = editor.priceBooks.find((book) => book.state === "active") ?? null
  const draft = editor.priceBooks.find((book) => book.state === "draft") ?? null
  const scheduled = editor.priceBooks.find((book) => book.state === "scheduled") ?? null
  const plan = (draft ?? active)?.ratePlans.find((item) => item.isDefault) ?? (draft ?? active)?.ratePlans[0] ?? null
  const quantity = plan?.includedQuantity ?? null
  const summary = plan
    ? `${minorMoney(plan.baseAmount, editor.offering.currency)} / ночь${quantity !== null ? ` · до ${quantity} гостей` : ""}${plan.baseExtraUnitAmount !== null ? ` · +${minorMoney(plan.baseExtraUnitAmount, editor.offering.currency)} за следующего` : ""}`
    : "Стоимость ещё не задана"
  const state = draft ? "Есть новые цены" : scheduled?.scheduledActivationAt ? `Изменятся ${compactDateTime(scheduled.scheduledActivationAt, scheduled.timezone)}` : active ? "Цены действуют" : "Не настроено"
  return <div className="flex flex-col gap-3 rounded-xl border bg-background px-4 py-3 sm:flex-row sm:items-center">
    <IconBox icon={IconCurrencyRuble} size="sm" variant={active ? "success" : "warning"} />
    <div className="min-w-0 flex-1"><p className="text-[13px] font-semibold">{summary}</p><p className="mt-0.5 text-[10px] text-muted-foreground">Для каждой ночи применяется самая точная подходящая цена.</p></div>
    <StatusBadge tone={draft || scheduled ? "warning" : active ? "success" : "neutral"}>{state}</StatusBadge>
  </div>
}

export function ResourceSiteCard({ editor, editorialHref, onOpenEditorial }: { editor: InternalOfferingEditor; editorialHref?: (nodeId: string) => string | null; onOpenEditorial?: (nodeId: string) => void }) {
  const locator = editor.editorial
  const href = locator ? editorialHref?.(locator.node.id) ?? null : null
  const revision = locator?.currentRevision ?? null
  const blockerCount = locator?.publication.blockers.length ?? 0
  const status = locator?.latestPublished ? "Опубликовано" : locator?.publication.eligible ? "Готово к публикации" : locator ? "Нужно дозаполнить" : "Не подготовлена"
  const tone = locator?.latestPublished ? "success" : locator?.publication.eligible ? "info" : "warning"
  return <section className="flex min-w-0 flex-col gap-3 rounded-xl border bg-background px-4 py-3 sm:flex-row sm:items-center" data-slot="resource-site-card">
    <IconBox icon={IconFileText} size="sm" variant={locator?.node.status === "archived" ? "neutral" : "info"} />
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 flex-wrap items-center gap-2"><h2 className="text-xs font-semibold">Страница на сайте</h2><StatusBadge tone={tone}>{status}</StatusBadge></div>
      <p className="mt-1 truncate text-xs font-medium">{revision?.title ?? "Страница появится автоматически"}</p>
      <p className="mt-0.5 break-words text-[10px] text-muted-foreground sm:truncate">{revision?.path ?? "Тексты, фотографии и публикация настраиваются в CMS."}{blockerCount ? ` · Осталось задач: ${blockerCount}` : ""}</p>
    </div>
    {locator && onOpenEditorial ? <Button className="shrink-0" onClick={() => onOpenEditorial(locator.node.id)} size="sm" variant="outline"><IconExternalLink aria-hidden="true" />Редактировать страницу</Button> : locator && href ? <Button className="shrink-0" nativeButton={false} render={<a href={href} />} size="sm" variant="outline"><IconExternalLink aria-hidden="true" />Редактировать страницу</Button> : null}
  </section>
}

export function OfferingOverview({ editor, editorialHref, kind, onOpenEditorial }: { editor: InternalOfferingEditor; editorialHref?: (nodeId: string) => string | null; kind: "house" | "campground"; onOpenEditorial?: (nodeId: string) => void }) {
  const { offering } = editor
  const campground = kind === "campground" && offering.fulfillment.kind === "campground" ? offering.fulfillment : null
  const subtypeLabel = campground?.salesUnit === "owned_tent" ? "Наша палатка · отдельный объект" : campground ? "Гостевая палатка · общая зона" : null
  const capacityLabel = campground?.salesUnit === "own_tent_pitch" ? "Палаточных мест" : "Гостей"
  const OfferingIcon = kind === "campground" ? IconTent : IconBuildingCottage
  const primary = editor.bindings.find((binding) => binding.role === "primary")
  const primaryTarget = primary?.target.type === "resource" ? editor.bindingTargets.find((target) => target.id === primary.target.id) ?? null : null
  const activeBook = editor.priceBooks.find((book) => book.state === "active") ?? null
  const pricingReady = Boolean(primary && activeBook && editor.capabilities.canPreviewQuote)
  return <div className="space-y-3">
    <SummaryMetricStrip ariaLabel="Сводка предложения">
      <SummaryMetric icon={OfferingIcon} label="Состояние" tone={offering.state === "active" ? "success" : offering.state === "archived" ? "neutral" : "warning"} value={priceBookLabelForOffering(offering.state)}><span className="font-mono">{offering.code}</span></SummaryMetric>
      <SummaryMetric icon={IconTag} label="Продажа" tone="stay" value={salesModeLabel[offering.salesMode]}>{priceDisplayLabel[offering.priceDisplayMode]}</SummaryMetric>
      <SummaryMetric icon={IconCurrencyRuble} label="Готовность цены" tone={pricingReady ? "success" : "warning"} value={pricingReady ? "Готово" : "Настроить"}>{activeBook ? `${activeBook.name} · ред. ${activeBook.revision}` : "Нет активного прайс-листа"}</SummaryMetric>
      <SummaryMetric icon={IconLink} label="Исполнение" tone={primary ? "info" : "warning"} value={primary ? bindingTargetLabel[primary.target.type] : "Не связано"}>{primary ? `${capacityLabel} ${primaryTarget?.capacity.total ?? "—"} · связанных ресурсов ${editor.bindings.length}` : "Добавьте основной ресурс"}</SummaryMetric>
    </SummaryMetricStrip>
    <EditorSection title="Предложение">
      <div className="flex flex-wrap items-center gap-3 border-b pb-4">
        <IconBox icon={kind === "campground" ? IconTent : IconHome} size="lg" variant={kind === "campground" ? "info" : "resourceHouses"} />
        <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold">{offering.operationalName}</p><p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{offering.code}</p></div>
        {subtypeLabel ? <StatusBadge tone="info">{subtypeLabel}</StatusBadge> : null}<StatusBadge tone={offering.state === "active" ? "success" : offering.state === "archived" ? "neutral" : "warning"}>{priceBookLabelForOffering(offering.state)}</StatusBadge>
      </div>
      <dl className="grid gap-x-6 gap-y-4 pt-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <Detail label="Валюта" value={offering.currency} />
        <Detail label="Часовой пояс" value={offering.timezone} />
        <Detail label="Налоги" value={taxModeLabel[offering.taxMode]} />
        <Detail label="Расчёт проживания" value={offering.fulfillment.kind === "house" || offering.fulfillment.kind === "campground" ? "По каждой ночи" : "По условиям предложения"} />
      </dl>
    </EditorSection>
    <EditorSection subtitle="Ресурс и доступность принадлежат operational-контуру CRM." title="Исполнение">
      {primary ? <div className="flex flex-col gap-3 border-y py-3 sm:flex-row sm:items-center">
        <IconBox icon={IconLink} size="sm" variant="info" />
        <div className="min-w-0 flex-1"><p className="text-xs font-medium">{primaryTarget?.name ?? "Сводка ресурса недоступна"}</p><p className="truncate font-mono text-[10px] text-muted-foreground">{primaryTarget ? `${primaryTarget.code} · ${capacityLabel}: ${primaryTarget.capacity.total} · ${primaryTarget.capacity.mode === "shared" ? "общая" : "фиксированная"}` : "Обновите состав, чтобы получить безопасную сводку ресурса."}</p>{primaryTarget?.archived ? <StatusBadge tone="warning">Ресурс в архиве</StatusBadge> : null}</div>
        <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground"><span className="rounded-md bg-muted px-2 py-1">Количество: {primary.defaultQuantity}</span><span className="rounded-md bg-muted px-2 py-1">Влияние: {primary.defaultCapacityImpact}</span><span className="rounded-md bg-muted px-2 py-1">Подготовка: {primary.preparationBeforeMinutes + primary.preparationAfterMinutes} мин</span><span className="rounded-md bg-muted px-2 py-1">{primary.availabilityRequired ? "Проверка доступности" : "Без проверки доступности"}</span></div>
      </div> : <PageState icon={IconAlertTriangle} title="Основная привязка не задана" tone="warning">{kind === "campground" ? "Кемпинг нельзя безопасно рассчитывать без основного ресурса." : "Домик нельзя безопасно рассчитывать без основного ресурса."}</PageState>}
    </EditorSection>
    <OfferingEditorialSummary editor={editor} {...(editorialHref ? { editorialHref } : {})} {...(onOpenEditorial ? { onOpenEditorial } : {})} />
    <EditorSection title="Прайс-листы">
      {editor.priceBooks.length ? <div className="divide-y rounded-lg border">{editor.priceBooks.map((book) => <PriceBookSummary book={book} key={book.id} />)}</div> : <PageState icon={IconCalendar} title="Прайс-листов ещё нет">Создайте черновик на вкладке «Цены».</PageState>}
    </EditorSection>
  </div>
}

const editorialRevisionLabel = { approved: "Одобрено", draft: "Черновик", published: "Опубликовано", review: "На проверке", scheduled: "Запланировано" } as const
const editorialBlockerLabel = {
  cms_node_archived: "Страница в архиве",
  cms_node_kind_incompatible: "Тип страницы не подходит этому ресурсу",
  offering_not_active: "Ресурс не активен для продажи",
  public_profile_mismatch: "Настройки сайта связаны с другой записью",
  public_profile_missing: "Показ на сайте не настроен",
  revision_relation_mismatch: "Страница связана с другой версией данных",
  revision_relation_missing: "Страница ещё не связана с рабочей версией",
  safe_public_projection_missing: "Данные для сайта ещё не подготовлены",
} as const

/** Locator summary only. Marketing fields remain in the canonical CMS editor. */
function OfferingEditorialSummary({ editor, editorialHref, onOpenEditorial }: { editor: InternalOfferingEditor; editorialHref?: (nodeId: string) => string | null; onOpenEditorial?: (nodeId: string) => void }) {
  const locator = editor.editorial
  if (!locator) return <EditorSection subtitle="Здесь будут тексты, фото, SEO и статус публикации." title="Страница на сайте">
    <PageState icon={IconFileText} title="Страница ещё не подготовлена">Сохраните ресурс или повторите подготовку выше. Система свяжет страницу автоматически.</PageState>
  </EditorSection>

  const revision = locator.currentRevision
  const href = editorialHref?.(locator.node.id) ?? null
  const archived = locator.node.status === "archived"
  return <EditorSection
    actions={<StatusBadge tone={locator.publication.eligible ? "success" : "warning"}>{locator.publication.eligible ? "Готово к публикации" : "Нужно дозаполнить"}</StatusBadge>}
    subtitle="Тексты, фото, SEO и публикация редактируются в одной связанной странице."
    title="Страница на сайте"
  >
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-center">
      <IconBox icon={IconFileText} size="sm" variant={archived ? "neutral" : "info"} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{revision?.title ?? "CMS-черновик без рабочей редакции"}</p>
        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{revision?.path ?? "Маршрут ещё не подготовлен"}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
          {revision ? <StatusBadge tone={revision.state === "published" ? "success" : revision.state === "draft" ? "warning" : "info"}>{editorialRevisionLabel[revision.state]}</StatusBadge> : <StatusBadge tone="warning">Нет редакции</StatusBadge>}
          <span className="rounded-md bg-muted px-2 py-1">CMS v{locator.node.version}</span>
          {locator.latestPublished ? <span className="rounded-md bg-muted px-2 py-1">На сайте: ред. {locator.latestPublished.revision}</span> : <span className="rounded-md bg-muted px-2 py-1">Ещё не публиковалось</span>}
        </div>
      </div>
      {onOpenEditorial ? <Button onClick={() => onOpenEditorial(locator.node.id)} size="sm" variant="outline"><IconExternalLink aria-hidden="true" />Редактировать страницу</Button> : href ? <Button nativeButton={false} render={<a href={href} />} size="sm" variant="outline"><IconExternalLink aria-hidden="true" />Редактировать страницу</Button> : null}
    </div>
    <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Блокировки публикации">{locator.publication.blockers.map((blocker) => <span className="rounded-md bg-warning-subtle px-2 py-1 text-[10px] text-warning-foreground" key={blocker}>{editorialBlockerLabel[blocker]}</span>)}</div>
  </EditorSection>
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] text-muted-foreground">{label}</dt><dd className="mt-1 text-xs font-medium">{value}</dd></div> }
function priceBookLabelForOffering(state: InternalOfferingEditor["offering"]["state"]) { return { active: "Активно", archived: "В архиве", draft: "Черновик", paused: "Приостановлено" }[state] }
function PriceBookSummary({ book }: { book: PriceBook }) { return <div className={book.state === "active" ? "flex items-center gap-3 border-l-2 border-l-success px-3 py-2.5" : "flex items-center gap-3 px-3 py-2.5"}><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{book.name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{compactDate(book.validFrom)} — {book.validToExclusive ? compactDate(book.validToExclusive) : "без срока"} · {book.ratePlans.length} тарифов · редакция {book.revision}</p></div><StatusBadge tone={priceBookTone[book.state]}>{priceBookLabel[book.state]}</StatusBadge></div> }

export function OfferingSidebar({ editor }: { editor: InternalOfferingEditor }) {
  const { capabilities, ownerVersions, offering } = editor
  return <div className="space-y-3">
    <EditorSection title="Доступ"><div className="space-y-2 text-xs"><p>{capabilities.pricing.canEditDraft ? "Можно редактировать черновик цен." : "Прайс-лист доступен только для просмотра."}</p><p>{capabilities.canPreviewQuote ? "Проверка стоимости доступна." : "Расчёт появится после настройки предложения."}</p>{offering.state === "archived" ? <p className="flex items-center gap-1 text-muted-foreground"><IconLock aria-hidden="true" className="size-3" />Архивная запись</p> : null}</div></EditorSection>
    <EditorSection title="Технические данные"><dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs"><Detail label="Каталог" value={String(ownerVersions.catalog)} /><Detail label="Источник" value={String(ownerVersions.subject.aggregateVersion)} /><Detail label="Цены" value={String(ownerVersions.pricing)} /><Detail label="Допы" value={String(ownerVersions.addOnAssignments)} /></dl></EditorSection>
  </div>
}
