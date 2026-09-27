import { useCallback } from "react"
import { IconAlertTriangle, IconArrowRight, IconFilePlus, IconHome, IconPhotoPlus, IconRoute } from "@tabler/icons-react"
import { Link, useNavigate } from "react-router-dom"

import { Button, ClickableCard, LoadingRows, PageFrame, PageState, StatusBadge } from "@crm/ui"
import { PageHeading } from "@admin/components/cms-ui"
import { cmsRepository } from "@admin/data/cms-repository"
import { useAdminAuthSession } from "@admin/features/auth-session-context"
import { useRepository } from "@admin/features/use-repository"

export function DashboardPage() {
  const loader = useCallback(() => cmsRepository.getDashboard(), [])
  const state = useRepository(loader)
  const navigate = useNavigate()
  const { user } = useAdminAuthSession()
  if (state.error) return <PageFrame><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={state.reload} title="Не удалось загрузить обзор">Попробуйте ещё раз.</PageState></PageFrame>
  if (state.loading || !state.data) return <PageFrame><PageHeading title="Обзор сайта" /><LoadingRows count={5} /></PageFrame>
  const data = state.data
  const attention = data.attention.filter((item) => item.id !== "production-release")
  const deliveryFailed = attention.some((item) => item.id === "delivery-failures")
  const deliveryPending = attention.some((item) => item.id === "delivery-pending")
  const actions = [
    { label: "Главная страница", href: "/content/home", icon: IconHome, allowed: true },
    { label: "Новая страница", href: "/content/pages/new", icon: IconFilePlus, allowed: user.capabilities.canEditContent },
    { label: "Загрузить фото", href: "/media?upload=1", icon: IconPhotoPlus, allowed: user.capabilities.canManageMedia },
    { label: "Меню и подвал", href: "/globals/navigation", icon: IconRoute, allowed: true },
  ].filter((action) => action.allowed)
  return <PageFrame>
    <PageHeading title="Обзор сайта" description="Редактируйте страницы, добавляйте фотографии и публикуйте готовые изменения." />
    <section aria-label="Быстрые действия" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map((action) => <Button className="h-auto min-h-20 justify-start gap-3 whitespace-normal p-4" key={action.href} onClick={() => navigate(action.href)} variant="outline"><action.icon /><span>{action.label}</span></Button>)}
    </section>
    <section aria-label="Содержимое сайта" className="mt-4 grid gap-3 sm:grid-cols-3">
      {data.metrics.filter((metric) => metric.id !== "seo").map((metric) => <ClickableCard className="p-4" key={metric.id} onClick={() => navigate(metric.id === "media" ? "/media" : "/content/tree")}>
        <p className="text-xs text-muted-foreground">{metric.label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{metric.value}</p><p className="mt-2 text-xs text-muted-foreground">{metric.detail}</p>
      </ClickableCard>)}
    </section>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border bg-background p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold">Публикация сайта</h3><StatusBadge tone={deliveryFailed ? "warning" : deliveryPending ? "info" : "neutral"}>{!data.hasPublication ? "Пока не опубликован" : deliveryFailed ? "Проверить доставку" : deliveryPending ? "Доставка выполняется" : "Активная версия сайта"}</StatusBadge></div>
        <p className="mt-3 text-sm text-muted-foreground">{data.hasPublication ? `Последняя публикация: ${data.publishedAt}.` : "Откройте страницу, заполните её и нажмите «Опубликовать». Черновики видны только сотрудникам."}</p>
        <Button className="mt-4" onClick={() => navigate("/content/tree")} variant="outline">Открыть страницы<IconArrowRight /></Button>
        {data.hasPublication && <Link className="ml-4 text-xs underline underline-offset-4" to="/releases">История публикаций</Link>}
      </section>
      <section className="rounded-xl border bg-background p-5">
        <h3 className="text-sm font-semibold">Как работать со страницами</h3>
        <p className="mt-3 text-sm text-muted-foreground">Новые ресурсы из CRM появляются здесь как черновики. Отредактируйте описание и фотографии, проверьте страницу и опубликуйте её.</p>
        <p className="mt-3 text-sm text-muted-foreground">Цены и доступность задаются в CRM. В CMS вы управляете содержимым и оформлением сайта.</p>
        {user.capabilities.canViewAnalytics && <Link className="mt-4 inline-flex text-xs underline underline-offset-4" to="/analytics">Статистика сайта</Link>}
      </section>
    </div>
    <section className="mt-4 rounded-xl border bg-background p-5">
      <h3 className="text-sm font-semibold">Требует внимания</h3>
      {attention.length ? <div className="mt-3 divide-y">{attention.map((item) => <Link className="flex min-h-12 items-center gap-3 py-3 text-sm" key={item.id} to={item.href}><IconAlertTriangle className="size-4 shrink-0" /><span className="min-w-0 flex-1">{item.title}</span><IconArrowRight className="size-4" /></Link>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Дополнительных уведомлений пока нет.</p>}
    </section>
  </PageFrame>
}
