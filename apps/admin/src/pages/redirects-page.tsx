import { useCallback, useMemo, useState } from "react"
import { IconAlertTriangle, IconRoute } from "@tabler/icons-react"
import { Link } from "react-router-dom"

import { Button, Input, LoadingRows, PageFrame, PageState, StatusBadge } from "@crm/ui"

import { PageHeading } from "@admin/components/cms-ui"
import { cmsRepository } from "@admin/data/cms-repository"
import { useRepository } from "@admin/features/use-repository"

const PAGE_SIZE = 100

export function RedirectsPage() {
  const loader = useCallback(() => cmsRepository.getPublishedRedirects(), [])
  const state = useRepository(loader)
  const [query, setQuery] = useState("")
  const [limit, setLimit] = useState(PAGE_SIZE)
  const redirects = state.data?.redirects
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru-RU")
    return (redirects ?? []).filter(({ sourcePath, destinationPath }) => !needle || `${sourcePath} ${destinationPath}`.toLocaleLowerCase("ru-RU").includes(needle))
  }, [query, redirects])

  return <PageFrame>
    <PageHeading description="Переходы 301, которые сейчас выдаёт опубликованная версия сайта." title="Редиректы" />
    {state.loading ? <LoadingRows count={5} /> : state.error ? <PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={state.reload} title="Не удалось загрузить редиректы">{state.error}</PageState> : !state.data ? <PageState icon={IconRoute} title="Сайт ещё не опубликован">После первой публикации здесь появятся действующие редиректы.</PageState> : <>
      <div className="mb-4 rounded-xl border bg-background p-4 text-xs leading-5 text-muted-foreground">
        <p>Список формируется из активной публикации для старых адресов разделов. Перенос уже опубликованной страницы и ручное создание редиректа пока недоступны.</p>
        <Link className="mt-2 inline-block font-medium text-primary hover:underline" to={`/releases/${state.data.releaseId}`}>Открыть публикацию</Link>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input aria-label="Найти редирект по адресу" className="min-w-0 flex-1 sm:max-w-sm" onChange={(event) => { setQuery(event.target.value); setLimit(PAGE_SIZE) }} placeholder="Найти исходный или конечный адрес" value={query} />
        <StatusBadge tone="neutral">{filtered.length} из {redirects?.length ?? 0}</StatusBadge>
      </div>
      {filtered.length ? <div className="space-y-2">{filtered.slice(0, limit).map(({ sourcePath, destinationPath, statusCode }) => <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-background px-4 py-3 text-xs" key={sourcePath}>
        <code className="min-w-0 break-all font-medium">{sourcePath}</code>
        <span aria-hidden="true" className="text-muted-foreground">→</span>
        <code className="min-w-0 flex-1 break-all text-muted-foreground">{destinationPath}</code>
        <StatusBadge tone="success">{statusCode}</StatusBadge>
      </div>)}</div> : <PageState icon={IconRoute} title={redirects?.length ? "Редиректы не найдены" : "Редиректов пока нет"}>{redirects?.length ? "Попробуйте другой адрес." : "В активной публикации нет адресов для перенаправления."}</PageState>}
      {filtered.length > limit ? <Button className="mt-4" onClick={() => setLimit((value) => value + PAGE_SIZE)} size="sm" variant="outline">Показать ещё</Button> : null}
    </>}
  </PageFrame>
}
