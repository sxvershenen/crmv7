import { useCallback, useEffect, useState } from "react"
import { IconAlertTriangle, IconRocket, IconSettings } from "@tabler/icons-react"
import { Link } from "react-router-dom"
import type { CmsSiteSettingsDetail, CmsSiteSettingsValue } from "@crm/contracts"
import { Alert, AlertDescription, AlertTitle, Button, EditorFrame, EditorSection, FormField, Input, ListRow, ListSection, LoadingRows, PageState, type EditorSaveState } from "@crm/ui"

import { ContentStatusBadge } from "@admin/components/cms-ui"
import { cmsRepository } from "@admin/data/cms-repository"
import { siteSettingsChanges } from "@admin/data/site-settings"
import { CmsConflictError } from "@admin/entities/cms"
import { useRepository } from "@admin/features/use-repository"
import { UnsavedChangesGuard } from "@admin/features/unsaved-changes-guard"

function currentValue(detail: CmsSiteSettingsDetail): CmsSiteSettingsValue | null {
  return detail.draft?.value ?? detail.published?.value ?? null
}

export function SiteSettingsPage() {
  const loader = useCallback(() => cmsRepository.getSiteSettings(), [])
  const accessLoader = useCallback(() => cmsRepository.getAccess(), [])
  const state = useRepository(loader)
  const access = useRepository(accessLoader)
  const [detail, setDetail] = useState<CmsSiteSettingsDetail>()
  const [siteName, setSiteName] = useState("")
  const [saveState, setSaveState] = useState<EditorSaveState>("saved")
  const [error, setError] = useState<string>()
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    if (!state.data) return
    setDetail(state.data)
    setSiteName(currentValue(state.data)?.siteName ?? "")
    setSaveState("saved")
    setError(undefined)
  }, [state.data])

  const editable = access.data?.canEditContent === true
  const canPublish = access.data?.canPublishContent === true
  const updateName = (value: string) => {
    if (!editable || !detail) return
    setSiteName(value)
    setSaveState(value === (currentValue(detail)?.siteName ?? "") ? "saved" : "dirty")
    setError(undefined)
  }
  const save = async () => {
    if (!detail || !editable || saveState !== "dirty") return detail
    const normalized = siteName.trim()
    if (!normalized) { setError("Укажите название сайта."); return undefined }
    setSaveState("saving")
    setError(undefined)
    try {
      const saved = await cmsRepository.saveSiteName(normalized, detail.version)
      setDetail(saved)
      setSiteName(currentValue(saved)?.siteName ?? normalized)
      setSaveState("saved")
      return saved
    } catch (cause) {
      setSaveState(cause instanceof CmsConflictError ? "conflict" : "dirty")
      setError(message(cause, "Не удалось сохранить настройки"))
      return undefined
    }
  }
  const publish = async () => {
    if (!detail || !canPublish || publishing || saveState === "conflict" || (saveState !== "dirty" && !detail.draft)) return
    let current = detail
    let saveCompleted = saveState !== "dirty"
    setPublishing(true)
    setSaveState("saving")
    setError(undefined)
    try {
      if (!saveCompleted) {
        const normalized = siteName.trim()
        if (!normalized) { setSaveState("dirty"); setError("Укажите название сайта."); return }
        current = await cmsRepository.saveSiteName(normalized, current.version)
        saveCompleted = true
        setDetail(current)
        setSiteName(currentValue(current)?.siteName ?? normalized)
        setSaveState("saved")
      }
      if (!current.draft) return
      const published = await cmsRepository.publishSiteSettings(current.version)
      setDetail(published)
      setSiteName(currentValue(published)?.siteName ?? "")
      setSaveState("saved")
    } catch (cause) {
      setDetail(current)
      setSaveState(cause instanceof CmsConflictError ? "conflict" : saveCompleted ? "saved" : "dirty")
      setError(message(cause, "Не удалось опубликовать настройки"))
    } finally { setPublishing(false) }
  }
  const recoverConflict = async () => {
    if (!detail) return
    try {
      const server = await cmsRepository.getSiteSettings()
      const editedName = siteName !== (currentValue(detail)?.siteName ?? "")
      setDetail(server)
      setSiteName(editedName ? siteName : (currentValue(server)?.siteName ?? ""))
      setSaveState(editedName ? "dirty" : "saved")
      setError(`Загружена серверная версия ${server.version}. ${editedName ? "Ваше название осталось в форме." : "Изменений названия нет."}`)
    } catch (cause) { setError(message(cause, "Не удалось загрузить настройки")) }
  }

  if (state.error) return <PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={state.reload} title="Не удалось загрузить настройки сайта">{state.error}</PageState>
  if (state.loading || access.loading || !detail) return <div className="p-4"><LoadingRows count={5} /></div>

  const value = currentValue(detail)
  const changes = siteSettingsChanges(detail)
  return <EditorFrame
    actions={<ContentStatusBadge status={detail.draft ? "draft" : detail.published ? "published" : "draft"} />}
    footerActions={<><Button disabled={!editable || saveState !== "dirty"} onClick={() => void save()} size="sm" variant="outline">Сохранить</Button><Button disabled={!canPublish || publishing || saveState === "conflict" || (saveState !== "dirty" && !detail.draft)} onClick={() => void publish()} size="sm"><IconRocket />{publishing ? "Публикуем…" : saveState === "dirty" ? "Сохранить и опубликовать" : "Опубликовать"}</Button></>}
    mobileActions={<ContentStatusBadge status={detail.draft ? "draft" : detail.published ? "published" : "draft"} />}
    navigation={<UnsavedChangesGuard when={saveState === "dirty" || saveState === "saving" || saveState === "conflict"} />}
    saveState={saveState}
    {...(saveState === "conflict" ? { saveDetail: "Настройки изменились в другой вкладке" } : {})}
    sidebar={<section className="overflow-hidden rounded-xl border bg-background"><ListSection count={3} icon={IconSettings} title="Состояние"><ListRow><Summary label="Опубликованное название" value={detail.published?.value.siteName ?? "Не опубликовано"} /></ListRow><ListRow><Summary label="Черновик" value={detail.draft ? `Редакция ${detail.draft.revision}` : "Нет"} /></ListRow><ListRow><Summary label="Пункты меню" value={String((value?.headerNavigation.length ?? 0) + (value?.mobileNavigation.length ?? 0) + (value?.footerNavigation.length ?? 0))} /></ListRow></ListSection></section>}
  >
    <div className="space-y-3">
      {error && <Alert variant={saveState === "conflict" ? "default" : "destructive"}><IconAlertTriangle /><AlertTitle>{saveState === "conflict" ? "Конфликт версий" : "Настройки не сохранены"}</AlertTitle><AlertDescription><p>{error}</p>{saveState === "conflict" && <Button className="mt-2" onClick={() => void recoverConflict()} size="xs" variant="outline">Сверить с сервером</Button>}</AlertDescription></Alert>}
      {detail.draft && <Alert className="border-warning/30"><IconAlertTriangle /><AlertTitle>Что выйдет на сайт вместе с настройками</AlertTitle><AlertDescription>{changes.length ? changes.join(", ") : "Черновик настроек без видимых отличий."} Публикация затрагивает общее меню и настройки сайта целиком.</AlertDescription></Alert>}
      <EditorSection subtitle="Название используется в шапке опубликованного сайта. Изменение появится после публикации и доставки." title="Название сайта"><FormField htmlFor="site-name" label="Название"><Input id="site-name" maxLength={160} onChange={(event) => updateName(event.target.value)} readOnly={!editable} value={siteName} /></FormField>{!editable && <p className="mt-2 text-xs text-muted-foreground">У вашей роли нет права менять содержимое сайта.</p>}</EditorSection>
      <EditorSection subtitle="Эти данные хранятся в общем черновике настроек. Редактируйте пункты меню в профильном разделе." title="Общие настройки"><div className="grid gap-3 text-xs sm:grid-cols-2"><Summary label="Кнопка в шапке" value={value?.headerCta?.enabled ? "Сохранена, пока не подключена к сайту" : "Не включена"} /><Summary label="Общий первый экран" value={value?.heroDefault ? "Задан" : "Не задан"} /><Summary label="Секции по умолчанию" value={String(value?.sectionDefaults.length ?? 0)} /><Summary label="Меню" value={<Link className="text-primary underline underline-offset-2" to="/globals/navigation">Открыть меню и подвал</Link>} /></div></EditorSection>
      <Alert><AlertTitle>Домен и контакты</AlertTitle><AlertDescription>Пока не управляются этим экраном. Настройки сервера и контакты в шаблоне сайта требуют отдельного подключения.</AlertDescription></Alert>
    </div>
  </EditorFrame>
}

function Summary({ label, value }: { label: string; value: React.ReactNode }) { return <div className="flex items-center justify-between gap-3 px-4 py-2"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div> }
function message(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback }
