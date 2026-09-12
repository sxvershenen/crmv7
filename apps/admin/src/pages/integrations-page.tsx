import { useCallback, useEffect, useState } from "react"
import { IconAlertTriangle, IconCheck, IconExternalLink, IconInfoCircle, IconRocket, IconWorldCog } from "@tabler/icons-react"

import { Alert, AlertDescription, AlertTitle, Button, EditorFrame, EditorSection, FormField, Input, ListRow, ListSection, LoadingRows, PageState, StatusBadge, Switch, type EditorSaveState } from "@crm/ui"

import { ContentStatusBadge } from "@admin/components/cms-ui"
import { cmsRepository } from "@admin/data/cms-repository"
import { CmsConflictError, type MetrikaSettings, type MetrikaSettingsRecord } from "@admin/entities/cms"
import { useRepository } from "@admin/features/use-repository"
import { UnsavedChangesGuard } from "@admin/features/unsaved-changes-guard"
import { extractMetrikaCounterId, isMetrikaCounterId } from "@admin/lib/metrika-settings"

export function IntegrationsPage() {
  const loader = useCallback(() => cmsRepository.getMetrikaSettings(), [])
  const state = useRepository(loader)
  const [draft, setDraft] = useState<MetrikaSettingsRecord>()
  const [persistedDraft, setPersistedDraft] = useState<MetrikaSettingsRecord>()
  const [snippet, setSnippet] = useState("")
  const [snippetError, setSnippetError] = useState<string>()
  const [saveState, setSaveState] = useState<EditorSaveState>("saved")
  const [error, setError] = useState<string>()
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    if (state.data) {
      setDraft(state.data)
      setPersistedDraft(state.data)
      setSaveState("saved")
      setSnippet("")
      setSnippetError(undefined)
    }
  }, [state.data])

  const update = (value: Partial<MetrikaSettings>) => {
    if (!draft) return
    setDraft({ ...draft, metrika: { ...draft.metrika, ...value } })
    setSaveState("dirty")
    setError(undefined)
  }

  const save = async () => {
    if (!draft || saveState === "saved" || saveState === "saving") return draft
    if (draft.metrika.enabled && !draft.metrika.counterId) {
      setSaveState("dirty")
      setError("Для включения Метрики укажите ID счётчика или извлеките его из кода.")
      return undefined
    }
    setSaveState("saving")
    setError(undefined)
    try {
      const saved = await cmsRepository.saveMetrikaSettings(draft.metrika, draft.version)
      setDraft(saved)
      setPersistedDraft(saved)
      setSaveState("saved")
      return saved
    } catch (cause) {
      setSaveState(cause instanceof CmsConflictError ? "conflict" : "dirty")
      setError(message(cause, "Не удалось сохранить настройки Метрики"))
      return undefined
    }
  }

  const publish = async () => {
    if (!draft || publishing) return
    const hadLocalChanges = saveState === "dirty"
    let saveCompleted = !hadLocalChanges
    let current = draft
    setPublishing(true)
    setSaveState("saving")
    setError(undefined)
    try {
      if (hadLocalChanges) {
        if (current.metrika.enabled && !current.metrika.counterId) {
          setSaveState("dirty")
          setError("Для включения Метрики укажите ID счётчика или извлеките его из кода.")
          return
        }
        current = await cmsRepository.saveMetrikaSettings(current.metrika, current.version)
        saveCompleted = true
        setDraft(current)
        setPersistedDraft(current)
        setSaveState("saved")
      }
      const published = await cmsRepository.publishMetrikaSettings(current.version)
      setDraft(published)
      setPersistedDraft(published)
      setSaveState("saved")
    } catch (cause) {
      setDraft(current)
      setSaveState(cause instanceof CmsConflictError ? "conflict" : saveCompleted ? "saved" : "dirty")
      setError(message(cause, "Не удалось опубликовать настройки Метрики"))
    } finally {
      setPublishing(false)
    }
  }

  const recoverConflict = async () => {
    if (!draft) return
    setError(undefined)
    try {
      const server = await cmsRepository.getMetrikaSettings()
      const baseline = persistedDraft?.metrika ?? draft.metrika
      const recovered = { ...server, metrika: {
        enabled: baseline.enabled !== draft.metrika.enabled ? draft.metrika.enabled : server.metrika.enabled,
        counterId: baseline.counterId !== draft.metrika.counterId ? draft.metrika.counterId : server.metrika.counterId,
      } }
      setPersistedDraft(server)
      setDraft(recovered)
      setSaveState("dirty")
      setError(`Загружена серверная версия ${server.version}. Локальные изменения сохранены в форме.`)
    } catch (cause) { setError(message(cause, "Не удалось загрузить серверные настройки")) }
  }

  const extract = () => {
    const counterId = extractMetrikaCounterId(snippet)
    if (!counterId) {
      setSnippetError("Не нашёл ровно один ID. Вставьте код из вкладки «Тег» или укажите ID вручную.")
      return
    }
    setSnippetError(undefined)
    update({ counterId })
  }

  if (state.error) return <PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={state.reload} title="Не удалось загрузить настройки интеграций">{state.error}</PageState>
  if (state.loading || !draft) return <div className="p-4"><LoadingRows count={7} /></div>

  return <EditorFrame
    actions={<ContentStatusBadge status={draft.status} />}
    footerActions={<><Button disabled={saveState === "saved" || saveState === "saving"} onClick={() => void save()} size="sm" variant="outline">Сохранить</Button><Button disabled={publishing || saveState === "conflict"} onClick={() => void publish()} size="sm"><IconRocket />{publishing ? "Публикуем…" : saveState === "dirty" ? "Сохранить и опубликовать" : "Опубликовать"}</Button></>}
    mobileActions={<ContentStatusBadge status={draft.status} />}
    {...(saveState === "conflict" ? { saveDetail: "Настройки изменены в другой вкладке" } : {})}
    navigation={<UnsavedChangesGuard when={saveState === "dirty" || saveState === "saving" || saveState === "conflict"} />}
    saveState={saveState}
    sidebar={<IntegrationSidebar draft={draft} />}
  >
    <div className="space-y-3">
      <Alert className="border-warning/30"><IconInfoCircle /><AlertTitle>Метрика подключается только после согласия посетителя</AlertTitle><AlertDescription>До разрешения аналитики тег не загружается. Отзыв согласия останавливает дальнейшую отправку данных. Публикуйте настройку только после проверки уведомления о приватности и прав доступа в Яндекс.Метрике.</AlertDescription></Alert>

      {error ? <Alert variant="destructive"><IconAlertTriangle /><AlertTitle>{saveState === "conflict" ? "Настройки изменены в другой вкладке" : "Операция не выполнена"}</AlertTitle><AlertDescription><p>{error}</p>{saveState === "conflict" ? <div className="mt-2 flex flex-wrap gap-2"><Button onClick={() => void recoverConflict()} size="xs" variant="outline">Сверить с сервером</Button><Button onClick={state.reload} size="xs" variant="outline">Загрузить серверные настройки</Button></div> : null}</AlertDescription></Alert> : null}

      <EditorSection subtitle="Хранится только числовой ID. Произвольный JavaScript из поля ниже не сохраняется и не исполняется на сайте." title="Яндекс.Метрика">
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/15 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div><p className="text-xs font-medium">Вариант 1 — ID счётчика</p><p className="mt-1 text-[11px] text-muted-foreground">Откройте Метрика → Настройки → Тег и скопируйте число из кода или настроек счётчика.</p></div>
              <StatusBadge tone={draft.metrika.counterId ? "success" : "neutral"}>{draft.metrika.counterId ? "Указан" : "Не указан"}</StatusBadge>
            </div>
            <FormField htmlFor="metrika-counter-id" label="ID счётчика"><Input aria-describedby="metrika-counter-id-help" id="metrika-counter-id" inputMode="numeric" maxLength={20} onChange={(event) => { const value = event.target.value.trim(); update({ counterId: value || null }); setSnippetError(value && !isMetrikaCounterId(value) ? "ID должен содержать только цифры (до 20 знаков)." : undefined) }} placeholder="Например, 12345678" value={draft.metrika.counterId ?? ""} /></FormField>
            <p className="mt-1 text-[11px] text-muted-foreground" id="metrika-counter-id-help">Это не токен API и не пароль. Для установки счётчика на сайт нужен именно ID тега.</p>
          </div>

          <div className="rounded-lg border bg-muted/15 p-4">
            <p className="text-xs font-medium">Вариант 2 — полный код счётчика</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Вставьте скопированный snippet целиком. Поле используется только для извлечения ID в браузере и никуда не отправляется.</p>
            <textarea aria-describedby="metrika-snippet-help" aria-label="Полный код счётчика Метрики" className="mt-3 min-h-32 w-full resize-y rounded-md border bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" onChange={(event) => { setSnippet(event.target.value); setSnippetError(undefined) }} placeholder={'<script>… ym(12345678, "init", { … }) …</script>'} spellCheck={false} value={snippet} />
            <div className="mt-2 flex flex-wrap items-center gap-3"><Button disabled={!snippet.trim()} onClick={extract} size="sm" variant="outline">Извлечь ID</Button>{snippetError ? <span className="text-[11px] text-danger-foreground" id="metrika-snippet-help">{snippetError}</span> : <span className="text-[11px] text-muted-foreground" id="metrika-snippet-help">Поддерживается стандартный код из вкладки «Тег».</span>}</div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-medium">Включить на опубликованном сайте</p><p className="mt-1 text-[11px] text-muted-foreground">Сначала сохраните и опубликуйте настройку. Без ID переключатель не включится на сервере.</p></div><label className="flex shrink-0 items-center gap-2 text-xs"><Switch checked={draft.metrika.enabled} onCheckedChange={(checked) => update({ enabled: checked })} size="sm" />{draft.metrika.enabled ? <><IconCheck className="size-4 text-success-foreground" />Включена</> : "Выключена"}</label></div>

          <a className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2" href="https://yandex.com/support/metrica/en/quick-start" rel="noreferrer" target="_blank">Официальная инструкция Яндекс.Метрики <IconExternalLink className="size-3" /></a>
        </div>
      </EditorSection>
    </div>
  </EditorFrame>
}

function IntegrationSidebar({ draft }: { draft: MetrikaSettingsRecord }) {
  return <section className="overflow-hidden rounded-xl border bg-background"><ListSection count={3} icon={IconWorldCog} title="Сводка"><ListRow><div className="flex items-center justify-between gap-3 px-4 py-2"><span className="text-[10px] text-muted-foreground">Статус</span><ContentStatusBadge status={draft.status} /></div></ListRow><ListRow><div className="flex items-center justify-between gap-3 px-4 py-2"><span className="text-[10px] text-muted-foreground">Счётчик</span><span className="text-right text-xs font-medium">{draft.metrika.counterId ?? "Не указан"}</span></div></ListRow><ListRow><div className="flex items-center justify-between gap-3 px-4 py-2"><span className="text-[10px] text-muted-foreground">Последнее изменение</span><span className="text-right text-xs font-medium">{draft.updatedLabel}</span></div></ListRow></ListSection></section>
}

function message(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback }

export default IntegrationsPage
