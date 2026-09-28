import { useCallback, useEffect, useState } from "react"
import { IconAlertTriangle, IconRocket, IconSettings } from "@tabler/icons-react"
import { Link } from "react-router-dom"
import { CmsFooterDetailsSchema, CmsSiteSettingsValueSchema, DEFAULT_CMS_FOOTER_DETAILS, type CmsFooterDetails, type CmsSiteSettingsDetail, type CmsSiteSettingsValue } from "@crm/contracts"
import { Alert, AlertDescription, AlertTitle, Button, EditorFrame, EditorSection, FormField, Input, ListRow, ListSection, LoadingRows, PageState, Textarea, type EditorSaveState } from "@crm/ui"

import { ContentStatusBadge } from "@admin/components/cms-ui"
import { cmsRepository } from "@admin/data/cms-repository"
import { siteSettingsChanges } from "@admin/data/site-settings"
import { CmsConflictError } from "@admin/entities/cms"
import { useRepository } from "@admin/features/use-repository"
import { UnsavedChangesGuard } from "@admin/features/unsaved-changes-guard"

function currentValue(detail: CmsSiteSettingsDetail): CmsSiteSettingsValue | null {
  return detail.draft?.value ?? detail.published?.value ?? null
}

const footerFieldLabels: Record<keyof CmsFooterDetails, string> = {
  subtitle: "Подзаголовок", description: "Описание", bookingPhone: "Телефон для бронирования", eventsPhone: "Телефон для мероприятий",
  email: "Почта", address: "Адрес", socialLabel: "Название соцсети", socialUrl: "Ссылка на соцсеть",
  legalName: "Название организации или ИП", inn: "ИНН",
}

export function SiteSettingsPage() {
  const loader = useCallback(() => cmsRepository.getSiteSettings(), [])
  const accessLoader = useCallback(() => cmsRepository.getAccess(), [])
  const state = useRepository(loader)
  const access = useRepository(accessLoader)
  const [detail, setDetail] = useState<CmsSiteSettingsDetail>()
  const [siteName, setSiteName] = useState("")
  const [footerDetails, setFooterDetails] = useState<CmsFooterDetails>({ ...DEFAULT_CMS_FOOTER_DETAILS })
  const [saveState, setSaveState] = useState<EditorSaveState>("saved")
  const [error, setError] = useState<string>()
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    if (!state.data) return
    setDetail(state.data)
    setSiteName(currentValue(state.data)?.siteName ?? "")
    setFooterDetails(currentValue(state.data)?.footerDetails ?? { ...DEFAULT_CMS_FOOTER_DETAILS })
    setSaveState("saved")
    setError(undefined)
  }, [state.data])

  const editable = access.data?.canEditContent === true
  const canPublish = access.data?.canPublishContent === true
  const isEdited = (name: string, footer: CmsFooterDetails) => name !== (detail ? currentValue(detail)?.siteName ?? "" : "") || JSON.stringify(footer) !== JSON.stringify(detail ? currentValue(detail)?.footerDetails ?? DEFAULT_CMS_FOOTER_DETAILS : DEFAULT_CMS_FOOTER_DETAILS)
  const updateName = (value: string) => {
    if (!editable || !detail) return
    setSiteName(value)
    setSaveState(isEdited(value, footerDetails) ? "dirty" : "saved")
    setError(undefined)
  }
  const updateFooter = (field: keyof CmsFooterDetails, value: string) => {
    if (!editable || !detail) return
    const next = { ...footerDetails, [field]: value }
    setFooterDetails(next)
    setSaveState(isEdited(siteName, next) ? "dirty" : "saved")
    setError(undefined)
  }
  const editedValue = (current: CmsSiteSettingsDetail): CmsSiteSettingsValue | undefined => {
    const normalized = siteName.trim()
    if (!normalized) { setError("Укажите название сайта."); return undefined }
    const footer = CmsFooterDetailsSchema.safeParse(footerDetails)
    if (!footer.success) {
      const field = footer.error.issues[0]?.path[0]
      setError(`Проверьте поле «${footerFieldLabels[field as keyof CmsFooterDetails] ?? "Контакты и реквизиты"}».`)
      return undefined
    }
    return { ...(currentValue(current) ?? CmsSiteSettingsValueSchema.parse({ siteName: normalized })), siteName: normalized, footerDetails: footer.data }
  }
  const save = async () => {
    if (!detail || !editable || saveState !== "dirty") return detail
    const value = editedValue(detail)
    if (!value) return undefined
    setSaveState("saving")
    setError(undefined)
    try {
      const saved = await cmsRepository.saveSiteSettings(value, detail.version)
      setDetail(saved)
      setSiteName(currentValue(saved)?.siteName ?? value.siteName)
      setFooterDetails(currentValue(saved)?.footerDetails ?? { ...DEFAULT_CMS_FOOTER_DETAILS })
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
        const value = editedValue(current)
        if (!value) { setSaveState("dirty"); return }
        current = await cmsRepository.saveSiteSettings(value, current.version)
        saveCompleted = true
        setDetail(current)
        setSiteName(currentValue(current)?.siteName ?? value.siteName)
        setFooterDetails(currentValue(current)?.footerDetails ?? { ...DEFAULT_CMS_FOOTER_DETAILS })
        setSaveState("saved")
      }
      if (!current.draft) return
      const published = await cmsRepository.publishSiteSettings(current.version)
      setDetail(published)
      setSiteName(currentValue(published)?.siteName ?? "")
      setFooterDetails(currentValue(published)?.footerDetails ?? { ...DEFAULT_CMS_FOOTER_DETAILS })
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
      const previous = currentValue(detail)
      const latest = currentValue(server)
      const rebasedName = siteName !== (previous?.siteName ?? "") ? siteName : latest?.siteName ?? ""
      const previousFooter = previous?.footerDetails ?? DEFAULT_CMS_FOOTER_DETAILS
      const latestFooter = latest?.footerDetails ?? DEFAULT_CMS_FOOTER_DETAILS
      const rebasedFooter = Object.fromEntries(Object.keys(DEFAULT_CMS_FOOTER_DETAILS).map((field) => [field, footerDetails[field as keyof CmsFooterDetails] !== previousFooter[field as keyof CmsFooterDetails] ? footerDetails[field as keyof CmsFooterDetails] : latestFooter[field as keyof CmsFooterDetails]])) as CmsFooterDetails
      const edited = rebasedName !== (latest?.siteName ?? "") || JSON.stringify(rebasedFooter) !== JSON.stringify(latestFooter)
      setDetail(server)
      setSiteName(rebasedName)
      setFooterDetails(rebasedFooter)
      setSaveState(edited ? "dirty" : "saved")
      setError(`Загружена серверная версия ${server.version}. ${edited ? "Ваши правки остались в форме." : "Локальных изменений нет."}`)
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
      <EditorSection subtitle="Контакты и текст внизу всех опубликованных страниц. Пустое поле скрывает соответствующую строку." title="Подвал сайта">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField htmlFor="footer-subtitle" label={footerFieldLabels.subtitle}><Input id="footer-subtitle" maxLength={160} onChange={(event) => updateFooter("subtitle", event.target.value)} readOnly={!editable} value={footerDetails.subtitle} /></FormField>
          <FormField className="sm:col-span-2" htmlFor="footer-description" label={footerFieldLabels.description}><Textarea id="footer-description" maxLength={600} onChange={(event) => updateFooter("description", event.target.value)} readOnly={!editable} value={footerDetails.description} /></FormField>
          <FormField htmlFor="footer-booking-phone" label={footerFieldLabels.bookingPhone}><Input id="footer-booking-phone" maxLength={40} onChange={(event) => updateFooter("bookingPhone", event.target.value)} readOnly={!editable} type="tel" value={footerDetails.bookingPhone} /></FormField>
          <FormField htmlFor="footer-events-phone" label={footerFieldLabels.eventsPhone}><Input id="footer-events-phone" maxLength={40} onChange={(event) => updateFooter("eventsPhone", event.target.value)} readOnly={!editable} type="tel" value={footerDetails.eventsPhone} /></FormField>
          <FormField htmlFor="footer-email" label={footerFieldLabels.email}><Input id="footer-email" maxLength={254} onChange={(event) => updateFooter("email", event.target.value)} readOnly={!editable} type="email" value={footerDetails.email} /></FormField>
          <FormField htmlFor="footer-address" label={footerFieldLabels.address}><Input id="footer-address" maxLength={300} onChange={(event) => updateFooter("address", event.target.value)} readOnly={!editable} value={footerDetails.address} /></FormField>
          <FormField htmlFor="footer-social-label" label={footerFieldLabels.socialLabel}><Input id="footer-social-label" maxLength={120} onChange={(event) => updateFooter("socialLabel", event.target.value)} readOnly={!editable} value={footerDetails.socialLabel} /></FormField>
          <FormField htmlFor="footer-social-url" label={footerFieldLabels.socialUrl}><Input id="footer-social-url" maxLength={2048} onChange={(event) => updateFooter("socialUrl", event.target.value)} readOnly={!editable} type="url" value={footerDetails.socialUrl} /></FormField>
        </div>
      </EditorSection>
      <EditorSection subtitle="Проверьте реквизиты перед публичным запуском. Они появляются в нижней строке сайта." title="Реквизиты"><div className="grid gap-3 sm:grid-cols-2"><FormField htmlFor="footer-legal-name" label={footerFieldLabels.legalName}><Input id="footer-legal-name" maxLength={240} onChange={(event) => updateFooter("legalName", event.target.value)} readOnly={!editable} value={footerDetails.legalName} /></FormField><FormField htmlFor="footer-inn" label={footerFieldLabels.inn}><Input id="footer-inn" maxLength={12} onChange={(event) => updateFooter("inn", event.target.value)} readOnly={!editable} value={footerDetails.inn} /></FormField></div></EditorSection>
      <EditorSection subtitle="Эти данные хранятся в общем черновике настроек. Редактируйте пункты меню в профильном разделе." title="Общие настройки"><div className="grid gap-3 text-xs sm:grid-cols-2"><Summary label="Кнопка в шапке" value={value?.headerCta?.enabled ? "Сохранена, пока не подключена к сайту" : "Не включена"} /><Summary label="Общий первый экран" value={value?.heroDefault ? "Задан" : "Не задан"} /><Summary label="Секции по умолчанию" value={String(value?.sectionDefaults.length ?? 0)} /><Summary label="Меню" value={<Link className="text-primary underline underline-offset-2" to="/globals/navigation">Открыть меню и подвал</Link>} /></div></EditorSection>
      <Alert><AlertTitle>Домен сайта</AlertTitle><AlertDescription>Публичный адрес пока задаётся настройками сервера; на этом экране он не меняется.</AlertDescription></Alert>
    </div>
  </EditorFrame>
}

function Summary({ label, value }: { label: string; value: React.ReactNode }) { return <div className="flex items-center justify-between gap-3 px-4 py-2"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div> }
function message(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback }
