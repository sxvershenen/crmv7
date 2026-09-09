import { useMemo, useState } from "react"
import {
  IconAlertTriangle,
  IconArrowDownRight,
  IconCalendarCancel,
  IconCalendarEvent,
  IconCash,
  IconCircleCheck,
  IconClockExclamation,
  IconDoorEnter,
  IconDoorExit,
  IconHistoryToggle,
  IconSettings,
  IconSparkles,
  IconTargetArrow,
  IconUser,
} from "@tabler/icons-react"
import { Link, useSearchParams } from "react-router-dom"

import {
  Assignees,
  Checkbox,
  FilterSelect,
  IconButton,
  ListRow,
  ListSection,
  LoadingRows,
  PageState,
  PaymentSummary,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  StatusBadge,
  cn,
} from "@crm/ui"

import { dashboardRepository, type DashboardRepository } from "@app/data/dashboard-repository"
import type { DashboardItem, DashboardScope, DashboardSection } from "@app/entities/dashboard"
import { useDashboard } from "@app/features/use-dashboard"

const sectionIcons = {
  alert: IconAlertTriangle,
  arrival: IconDoorEnter,
  cancel: IconCalendarCancel,
  conflict: IconClockExclamation,
  event: IconCalendarEvent,
  exit: IconDoorExit,
  lead: IconArrowDownRight,
  payment: IconCash,
  program: IconSparkles,
  task: IconTargetArrow,
  update: IconHistoryToggle,
}

export function DashboardPage({ repository = dashboardRepository }: { repository?: DashboardRepository }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const scope: DashboardScope = searchParams.get("scope") === "mine" ? "mine" : "all"
  const { assign, assignmentError, assignmentPending, retry, state } = useDashboard(scope, repository)
  const [hiddenSections, setHiddenSections] = useState<string[]>([])
  const [announcement, setAnnouncement] = useState("")

  const setScope = (nextScope: DashboardScope) => {
    setSearchParams(nextScope === "mine" ? { scope: "mine" } : {}, { replace: true })
  }

  const allSections = state.status === "ready" ? [...state.data.today, ...state.data.attention] : []
  const visibleData = useMemo(() => {
    if (state.status !== "ready") return null
    return {
      attention: state.data.attention.filter((section) => !hiddenSections.includes(section.id)),
      today: state.data.today.filter((section) => !hiddenSections.includes(section.id)),
    }
  }, [hiddenSections, state])

  const toggleSection = (id: string, visible: boolean) => {
    setHiddenSections((current) => (visible ? current.filter((sectionId) => sectionId !== id) : [...current, id]))
  }

  const assignItem = async (item: DashboardItem) => {
    if (item.assignment?.kind === "unsupported") {
      setAnnouncement(item.assignment.reason)
      return
    }
    try {
      await assign(item)
      setAnnouncement(`Вы назначены ответственным за ${item.title}`)
    } catch (error) {
      setAnnouncement(error instanceof Error ? error.message : "Не удалось назначить ответственного")
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1480px] p-3 sm:p-5 xl:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Операционная сводка на сегодня</p>
          <h2 className="mt-0.5 text-xl font-semibold tracking-tight">Добрый вечер, Марина</h2>
        </div>
        <div className="flex items-center gap-2">
          <FilterSelect
            className="w-28 bg-background"
            label="Область обзора"
            onValueChange={(value) => setScope(value === "mine" ? "mine" : "all")}
            options={[
              { label: "Все", value: "all" },
              { label: "Мои", value: "mine" },
            ]}
            value={scope}
          />

          <Popover>
            <PopoverTrigger
              render={
                <IconButton label="Настроить блоки обзора" variant="outline">
                  <IconSettings aria-hidden="true" className="size-4" />
                </IconButton>
              }
            />
            <PopoverContent align="end" className="max-h-96 w-72 overflow-y-auto gap-3">
              <PopoverHeader>
                <PopoverTitle>Блоки обзора</PopoverTitle>
                <PopoverDescription>Изменение применяется только к текущей demo-сессии.</PopoverDescription>
              </PopoverHeader>
              <div className="space-y-3">
                {allSections.map((section) => {
                  const visible = !hiddenSections.includes(section.id)
                  return (
                    <label className="flex min-h-8 cursor-pointer items-center gap-3 text-xs" key={section.id}>
                      <Checkbox checked={visible} onCheckedChange={(checked) => toggleSection(section.id, checked)} />
                      <span className="min-w-0 flex-1 truncate">{section.title}</span>
                    </label>
                  )
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {state.status === "loading" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="overflow-hidden rounded-xl border bg-surface-raised lg:col-span-2">
            <LoadingRows count={6} />
          </div>
          <div className="overflow-hidden rounded-xl border bg-surface-raised">
            <LoadingRows count={4} />
          </div>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="rounded-xl border bg-surface-raised">
          <PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={retry} title="Обзор не загрузился" tone="danger">
            {state.message}
          </PageState>
        </div>
      ) : null}

      {visibleData ? (
        visibleData.attention.length + visibleData.today.length === 0 && allSections.length > 0 ? (
          <div className="rounded-xl border bg-surface-raised">
            <PageState actionLabel="Показать все блоки" icon={IconCircleCheck} onAction={() => setHiddenSections([])} title="Все блоки скрыты" tone="success">
              Верните блоки в настройках обзора.
            </PageState>
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-3">
            <DashboardColumn
              className="order-1 lg:order-2"
              emptyLabel="На сегодня записей нет"
              onAssign={assignItem}
              assignmentPending={assignmentPending}
              sections={visibleData.today}
              title="Сегодня"
            />
            <DashboardColumn
              className="order-2 lg:order-1 lg:col-span-2"
              emptyLabel="Внимания не требуется"
              onAssign={assignItem}
              assignmentPending={assignmentPending}
              sections={visibleData.attention}
              title="Внимание"
            />
          </div>
        )
      ) : null}

      <p aria-live="polite" className="sr-only">
        {announcement || assignmentError || ""}
      </p>
    </div>
  )
}

function DashboardColumn({
  className,
  emptyLabel,
  onAssign,
  assignmentPending,
  sections,
  title,
}: {
  className?: string
  emptyLabel: string
  onAssign: (item: DashboardItem) => void
  assignmentPending: boolean
  sections: DashboardSection[]
  title: string
}) {
  return (
    <section className={cn("min-w-0", className)}>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">{title}</h2>
        <span className="text-[10px] text-muted-foreground">{sections.reduce((total, section) => total + section.items.length, 0)} зап.</span>
      </div>
      <div className="space-y-3">
        {sections.length > 0 ? (
          sections.map((section) => (
            <div className="overflow-hidden rounded-xl border bg-surface-raised shadow-[0_1px_2px_rgb(0_0_0/0.02)]" key={section.id}>
              <ListSection count={section.items.length} icon={sectionIcons[section.iconKey]} title={section.title} tone={section.tone}>
                {section.items.map((item) => (
                  <DashboardRow
                    item={item}
                    key={item.id}
                    onAssign={() => onAssign(item)}
                    assignmentPending={assignmentPending}
                  />
                ))}
              </ListSection>
            </div>
          ))
        ) : (
          <div className="rounded-xl border bg-surface-raised">
            <PageState icon={IconCircleCheck} title={emptyLabel} tone="success" />
          </div>
        )}
      </div>
    </section>
  )
}

function DashboardRow({ item, onAssign, assignmentPending }: { item: DashboardItem; onAssign: () => void; assignmentPending: boolean }) {
  const people = item.assignees

  return (
    <ListRow className="group relative min-h-20 transition-colors hover:bg-muted/55 focus-within:bg-muted/55">
      <Link aria-label={`Открыть: ${item.title}`} className="absolute inset-0 z-0 rounded-sm focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" to={item.href} />
      <div className="pointer-events-none relative z-[1] grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 sm:px-5">
        <div className="min-w-0 space-y-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="min-w-0 text-xs font-normal leading-4">{item.title}</p>
            {item.badge ? <StatusBadge tone={item.badge.tone}>{item.badge.label}</StatusBadge> : null}
          </div>
          <p className="truncate text-xs font-normal leading-4 text-muted-foreground">{item.subtitle}</p>
          {item.detail ? <p className="line-clamp-2 text-[10px] font-normal leading-[14px] text-muted-foreground">{item.detail}</p> : null}
          {item.contentSummary ? (
            <div className="flex flex-wrap items-center gap-x-1.5 text-xs font-normal leading-4">
              {item.contentSummary.label ? <span className="text-muted-foreground">{item.contentSummary.label}:</span> : null}
              <span className="text-foreground">{item.contentSummary.value}</span>
              {item.contentSummary.peopleCount !== undefined ? (
                <>
                  <span aria-hidden="true" className="text-muted-foreground">·</span>
                  <span aria-label={`${item.contentSummary.peopleCount} человек`} className="inline-flex items-center gap-1 text-muted-foreground">
                    <IconUser aria-hidden="true" className="size-3.5" />
                    <span className="tabular-nums">{item.contentSummary.peopleCount}</span>
                  </span>
                </>
              ) : null}
            </div>
          ) : null}
          {item.payment ? <PaymentSummary className="max-w-72" paid={item.payment.paid} total={item.payment.total} /> : null}
        </div>
        <div className="flex min-w-20 flex-col items-end justify-between gap-1.5 text-right">
          {item.primaryMeta ? (
            <div className="space-y-1.5">
              <p className="whitespace-nowrap text-xs font-normal leading-4 tabular-nums">{item.primaryMeta}</p>
              {item.secondaryMeta ? <p className="text-[11px] font-normal leading-4 text-muted-foreground">{item.secondaryMeta}</p> : null}
            </div>
          ) : <span />}
          <div className="pointer-events-auto relative z-10">
            {item.assignment?.kind === "unsupported" ? (
              people.length > 0 ? <span title={item.assignment.reason}><Assignees people={people} /></span> : <span className="whitespace-nowrap text-[11px] text-muted-foreground" title={item.assignment.reason}>Назначение недоступно</span>
            ) : (
              <span className={assignmentPending ? "pointer-events-none opacity-60" : undefined}><Assignees {...(assignmentPending ? {} : { onAssign })} people={people} /></span>
            )}
          </div>
        </div>
      </div>
    </ListRow>
  )
}
