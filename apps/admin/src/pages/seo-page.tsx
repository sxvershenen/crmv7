import { useCallback, useMemo, useState } from "react"
import { IconAlertTriangle, IconArrowLeft, IconArrowRight, IconReportSearch } from "@tabler/icons-react"
import { Link, useParams } from "react-router-dom"

import type { CmsNodePublicationStatus } from "@crm/contracts"
import { Button, Input, LoadingRows, PageFrame, PageState, StatusBadge } from "@crm/ui"

import { PageHeading } from "@admin/components/cms-ui"
import { cmsRepository } from "@admin/data/cms-repository"
import type { ContentNode } from "@admin/entities/cms"
import { useRepository } from "@admin/features/use-repository"
import { seoIssues } from "@admin/pages/seo-issues"

function editorHref(node: ContentNode) {
  const base = node.type === "home" ? "/content/home" : node.type === "category" ? `/content/categories/${node.id}` : node.type === "profile" ? `/content/public-profiles/resource/${node.id}` : node.type === "article" ? `/content/articles/${node.id}` : `/content/pages/${node.id}`
  return `${base}?tab=seo`
}

export function SeoPage() {
  const { nodeId } = useParams()
  const loader = useCallback(() => cmsRepository.getNodes(), [])
  const state = useRepository(loader)
  const publicationLoader = useCallback(() => nodeId ? cmsRepository.getPublicationStatus(nodeId) : Promise.resolve(null), [nodeId])
  const publication = useRepository(publicationLoader)
  const [query, setQuery] = useState("")
  const [issuesOnly, setIssuesOnly] = useState(false)
  const active = useMemo(() => (state.data ?? []).filter((node) => node.status !== "archived"), [state.data])
  const rows = useMemo(() => active.filter((node) => {
    if (issuesOnly && seoIssues(node).length === 0) return false
    return `${node.title} ${node.path}`.toLocaleLowerCase("ru-RU").includes(query.trim().toLocaleLowerCase("ru-RU"))
  }), [active, issuesOnly, query])

  if (state.error) return <PageFrame><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={state.reload} title="Не удалось загрузить SEO-данные">{state.error}</PageState></PageFrame>
  if (state.loading || !state.data) return <PageFrame><PageHeading title="SEO" /><LoadingRows count={5} /></PageFrame>

  if (nodeId) {
    const node = state.data.find((item) => item.id === nodeId)
    if (!node) return <PageFrame><PageState icon={IconReportSearch} title="Страница не найдена"><Link className="text-primary underline" to="/seo">К списку SEO</Link></PageState></PageFrame>
    const issues = seoIssues(node)
    return <PageFrame>
      <Link className="mb-3 inline-flex items-center gap-1 text-xs text-primary hover:underline" to="/seo"><IconArrowLeft className="size-4" />Все страницы</Link>
      <PageHeading description={`${node.path} · проверка рабочей редакции`} title={`SEO: ${node.title}`} />
      <section className="mb-4 rounded-xl border bg-background p-4" aria-label="Публикация страницы">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-semibold">Публикация страницы</h3>{publication.error ? <Button onClick={publication.reload} size="xs" variant="outline">Повторить проверку</Button> : null}</div>
        <p className="mt-2 text-sm" role="status">{publicationLabel(publication)}</p>
        {publication.error ? <p className="mt-1 text-xs text-danger" role="alert">{publication.error}</p> : null}
        <p className="mt-2 text-xs text-muted-foreground">SEO-поля ниже относятся к рабочей редакции CMS. Опубликованная версия может отличаться; доставка сайта здесь не проверяется.</p>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-xl border bg-background p-4"><h3 className="text-xs font-semibold">Поисковый заголовок</h3><p className="mt-2 break-words text-sm">{node.seo?.title || "Не заполнен"}</p><p className="mt-2 text-xs text-muted-foreground">{node.seo?.title.length ?? 0} символов · ориентир до 60</p></section>
        <section className="rounded-xl border bg-background p-4"><h3 className="text-xs font-semibold">Описание</h3><p className="mt-2 break-words text-sm">{node.seo?.description || "Не заполнено"}</p><p className="mt-2 text-xs text-muted-foreground">{node.seo?.description.length ?? 0} символов · ориентир до 160</p></section>
        <section className="rounded-xl border bg-background p-4"><h3 className="text-xs font-semibold">Индексация</h3><p className="mt-2 text-sm">{node.seo?.indexPolicy === "index_follow" ? "Индексировать" : node.seo ? "Не индексировать" : "Нет данных"}</p></section>
        <section className="rounded-xl border bg-background p-4"><h3 className="text-xs font-semibold">Canonical</h3><p className="mt-2 break-all text-sm">{node.seo?.canonical.mode === "custom" ? node.seo.canonical.url : node.seo ? `Собственный адрес: ${node.path}` : "Нет данных"}</p></section>
      </div>
      <section className="mt-4 rounded-xl border bg-background p-4"><h3 className="text-sm font-semibold">Что проверить</h3>{issues.length ? <ul className="mt-3 space-y-2">{issues.map((issue) => <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 p-3 text-xs" key={`${issue.field}-${issue.message}`}><span><strong>{issue.field}:</strong> {issue.message}</span><Link className="inline-flex items-center gap-1 text-primary hover:underline" to={editorHref(node)}>Исправить<IconArrowRight className="size-4" /></Link></li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">По доступным проверкам замечаний нет.</p>}</section>
      <p className="mt-3 text-xs text-muted-foreground">Проверяются только длина и заполнение title/description. Ссылки, изображения, schema, sitemap и поисковые позиции пока не входят в этот отчёт.</p>
      <Link className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-2.5 text-[13px] hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2" to={editorHref(node)}>Открыть SEO в редакторе<IconArrowRight className="size-4" /></Link>
    </PageFrame>
  }

  const affected = active.filter((node) => seoIssues(node).length > 0).length
  return <PageFrame>
    <PageHeading description="Проверка SEO-полей рабочих редакций CMS. Публичный сайт и позиции в поиске здесь не измеряются." title="SEO" />
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="Неархивных страниц CMS" value={active.length} />
      <Metric label="С замечаниями" value={affected} />
      <Metric label="Без индексации" value={active.filter((node) => node.seo && node.seo.indexPolicy !== "index_follow").length} />
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-2"><Input aria-label="Найти страницу в SEO-отчёте" className="min-w-0 flex-1 sm:max-w-xs" onChange={(event) => setQuery(event.target.value)} placeholder="Название или URL" value={query} /><Button aria-pressed={issuesOnly} onClick={() => setIssuesOnly((value) => !value)} size="sm" variant={issuesOnly ? "default" : "outline"}>Только с замечаниями</Button></div>
    {rows.length ? <div className="mt-3 space-y-2">{rows.map((node) => {
      const count = seoIssues(node).length
      return <Link className="flex min-h-16 items-center gap-3 rounded-xl border bg-background p-3 hover:bg-muted/30" key={node.id} to={`/seo/pages/${node.id}`}><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{node.title}</p><p className="truncate text-xs text-muted-foreground">{node.path}</p></div><StatusBadge tone={count ? "warning" : "success"}>{count ? `${count} замеч.` : "Без замечаний"}</StatusBadge><IconArrowRight className="size-4 shrink-0" /></Link>
    })}</div> : <PageState icon={IconReportSearch} title={active.length ? "Страницы не найдены" : "Страниц пока нет"}>{active.length ? "Измените поиск или фильтр." : "Создайте первую страницу в разделе «Страницы сайта»."}</PageState>}
    <p className="mt-4 text-xs text-muted-foreground">Замечания касаются только title и description текущей редакции. Индексация показывает настройку CMS, а не факт нахождения страницы в поиске.</p>
  </PageFrame>
}

function Metric({ label, value }: { label: string; value: number }) { return <section className="rounded-xl border bg-background p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></section> }

function publicationLabel(state: { data?: CmsNodePublicationStatus | null; error?: string; loading: boolean }) {
  if (state.error) return "Не удалось проверить активную публикацию"
  if (state.loading || !state.data) return "Проверяем активную публикацию…"
  if (!state.data.active) return "Не входит в активную публикацию"
  return state.data.path ? `В активной публикации: ${state.data.path}` : "В активной публикации; адрес не получен"
}
