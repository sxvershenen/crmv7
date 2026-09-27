import { useCallback, useEffect, useMemo, useState } from "react"
import { IconAlertTriangle, IconArrowDown, IconArrowUp, IconChevronRight, IconDeviceMobile, IconDeviceDesktop, IconLink, IconPlus, IconRocket, IconTrash } from "@tabler/icons-react"
import { useSearchParams } from "react-router-dom"

import { Alert, AlertDescription, AlertTitle, Button, EditorFrame, EditorSection, FormField, FormSelect, Input, ListRow, ListSection, LoadingRows, PageNav, PageState, Switch, type EditorSaveState } from "@crm/ui"

import { ContentStatusBadge } from "@admin/components/cms-ui"
import { cmsRepository } from "@admin/data/cms-repository"
import { CmsConflictError, type PublicNavigation, type PublicNavigationItem } from "@admin/entities/cms"
import { useRepository } from "@admin/features/use-repository"
import { UnsavedChangesGuard } from "@admin/features/unsaved-changes-guard"

const tabs = [
  { value: "header", label: "Шапка сайта", compactLabel: "Шапка", icon: IconDeviceDesktop },
  { value: "mobile", label: "Меню телефона", compactLabel: "Телефон", icon: IconDeviceMobile },
  { value: "footer", label: "Нижнее меню", compactLabel: "Footer", icon: IconDeviceMobile },
]

const iconOptions = [
  { value: "link", label: "Ссылка" }, { value: "home", label: "Дом" }, { value: "building-cottage", label: "Домик" },
  { value: "sparkles", label: "Программа / событие" }, { value: "map-pin", label: "Место" },
  { value: "calendar", label: "Календарь" }, { value: "photo", label: "Галерея" }, { value: "shield", label: "Документ" },
]

export function NavigationPage() {
  const loader = useCallback(() => cmsRepository.getNavigation(), [])
  const accessLoader = useCallback(() => cmsRepository.getAccess(), [])
  const state = useRepository(loader); const access = useRepository(accessLoader)
  const [draft, setDraft] = useState<PublicNavigation>(); const [persistedDraft, setPersistedDraft] = useState<PublicNavigation>(); const [saveState, setSaveState] = useState<EditorSaveState>("saved"); const [error, setError] = useState<string>(); const [publishing, setPublishing] = useState(false)
  const [params, setParams] = useSearchParams(); const requestedTab = params.get("tab"); const tab: "header" | "mobile" | "footer" = requestedTab === "footer" || requestedTab === "mobile" ? requestedTab : "header"
  useEffect(() => { if (state.data) { setDraft(state.data); setPersistedDraft(state.data); setSaveState("saved") } }, [state.data])
  const editable = access.data?.canEditContent === true
  const items = draft?.[tab] ?? []
  const updateItems = (next: PublicNavigationItem[]) => { if (!draft || !editable) return; setDraft({ ...draft, [tab]: next }); setSaveState("dirty"); setError(undefined) }
  const save = async () => { if (!draft || !editable || saveState === "saved") return draft; setSaveState("saving"); setError(undefined); try { const saved = await cmsRepository.saveNavigation(draft, draft.version); setDraft(saved); setPersistedDraft(saved); setSaveState("saved"); return saved } catch (cause) { setSaveState(cause instanceof CmsConflictError ? "conflict" : "dirty"); setError(message(cause, "Не удалось сохранить меню")); return undefined } }
  const publish = async () => { if (!draft || !access.data?.canPublishContent) return; const hadLocalChanges = saveState === "dirty"; let saveCompleted = !hadLocalChanges; let current = draft; setPublishing(true); setSaveState("saving"); setError(undefined); try { if (hadLocalChanges) { current = await cmsRepository.saveNavigation(current, current.version); saveCompleted = true; setDraft(current); setPersistedDraft(current); setSaveState("saved") } const published = await cmsRepository.publishNavigation(current.version); setDraft(published); setPersistedDraft(published); setSaveState("saved") } catch (cause) { setDraft(current); setSaveState(cause instanceof CmsConflictError ? "conflict" : saveCompleted ? "saved" : "dirty"); setError(message(cause, "Не удалось опубликовать меню")) } finally { setPublishing(false) } }
  const recoverConflict = async () => { if (!draft) return; setError(undefined); try { const server = await cmsRepository.getNavigation(); const recovered = mergeNavigationChanges(persistedDraft ?? draft, draft, server); setPersistedDraft(server); setDraft(recovered); setSaveState("dirty"); setError(`Загружена серверная версия ${server.version}. Локальные изменения сохранены в форме.`) } catch (cause) { setError(message(cause, "Не удалось загрузить серверное меню")) } }
  const navigation = <><UnsavedChangesGuard when={saveState === "dirty" || saveState === "saving" || saveState === "conflict"} /><PageNav items={tabs} onValueChange={(value) => { const next = new URLSearchParams(params); next.set("tab", value); setParams(next, { replace: true }) }} value={tab} /></>

  if (state.error) return <PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={state.reload} title="Не удалось загрузить меню">{state.error}</PageState>
  if (state.loading || access.loading || !draft) return <div className="p-4"><LoadingRows count={7} /></div>

  return <EditorFrame actions={<ContentStatusBadge status={draft.status} />} footerActions={<><Button disabled={!editable || saveState === "saved" || saveState === "saving"} onClick={() => void save()} size="sm" variant="outline">Сохранить</Button><Button disabled={!access.data?.canPublishContent || publishing || saveState === "conflict"} onClick={() => void publish()} size="sm"><IconRocket />{publishing ? "Публикуем…" : saveState === "dirty" ? "Сохранить и опубликовать" : "Опубликовать"}</Button></>} mobileActions={<ContentStatusBadge status={draft.status} />} navigation={navigation} {...(saveState === "conflict" ? { saveDetail: "Меню изменено в другой вкладке" } : {})} saveState={saveState} sidebar={<NavigationSidebar draft={draft} />}>
    <div className="space-y-3">
      {draft.otherDraftChanges?.length ? <Alert className="border-warning/30 bg-warning-subtle"><IconAlertTriangle /><AlertTitle>Публикация затронет и настройки сайта</AlertTitle><AlertDescription>Вместе с меню будут опубликованы: {draft.otherDraftChanges.join(", ")}. Проверьте их перед публикацией.</AlertDescription></Alert> : null}
      <EditorSection actions={<Button disabled={!editable} onClick={() => updateItems([...items, newItem()])} size="xs" variant="outline"><IconPlus />Добавить пункт</Button>} subtitle={tab === "header" ? "Основное меню на компьютере. Вложенность — до трёх уровней." : tab === "mobile" ? "Отдельный порядок и состав меню на телефоне." : "Ссылки, контакты и документы внизу каждой страницы."} title={tab === "header" ? "Навигация сайта" : tab === "mobile" ? "Меню телефона" : "Нижнее меню"}>
        {error ? <Alert className="mb-3" variant="destructive"><IconAlertTriangle /><AlertTitle>{saveState === "conflict" ? "Меню изменено в другой вкладке" : "Операция не выполнена"}</AlertTitle><AlertDescription><p>{error}</p>{saveState === "conflict" ? <div className="mt-2 flex flex-wrap gap-2"><Button onClick={() => void recoverConflict()} size="xs" variant="outline">Сверить с сервером</Button><Button onClick={state.reload} size="xs" variant="outline">Загрузить серверное меню</Button></div> : null}</AlertDescription></Alert> : null}
        {items.length ? <NavigationList items={items} onChange={updateItems} readonly={!editable} /> : <PageState actionLabel="Добавить первый пункт" icon={IconLink} onAction={() => updateItems([newItem()])} title="Меню пока пустое">Добавьте ссылку на страницу или раздел сайта.</PageState>}
      </EditorSection>
      <NavigationPreview items={items} tab={tab} />
    </div>
  </EditorFrame>
}

function NavigationList({ items, onChange, readonly, depth = 0 }: { items: PublicNavigationItem[]; onChange: (value: PublicNavigationItem[]) => void; readonly: boolean; depth?: number }) {
  const update = (index: number, item: PublicNavigationItem) => onChange(items.map((current, currentIndex) => currentIndex === index ? item : current))
  const remove = (index: number) => onChange(items.filter((_, currentIndex) => currentIndex !== index))
  const move = (index: number, offset: -1 | 1) => { const target = index + offset; if (target < 0 || target >= items.length) return; const next = [...items]; const [item] = next.splice(index, 1); if (item) next.splice(target, 0, item); onChange(next) }
  return <div className={depth ? "ml-4 border-l pl-3 sm:ml-8" : "space-y-2"}>{items.map((item, index) => <div className="mb-2 rounded-lg border bg-background" key={item.id}>
    <div className="grid gap-3 p-3 lg:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_160px_110px_auto] lg:items-end">
      <FormField htmlFor={`${item.id}-label`} label="Название"><Input id={`${item.id}-label`} onChange={(event) => update(index, { ...item, label: event.target.value })} readOnly={readonly} value={item.label} /></FormField>
      <FormField htmlFor={`${item.id}-href`} label="Ссылка"><Input id={`${item.id}-href`} onChange={(event) => update(index, { ...item, href: event.target.value })} placeholder="/houses или #booking" readOnly={readonly} value={item.href} /></FormField>
      <FormSelect disabled={readonly} id={`${item.id}-icon`} label="Иконка" onValueChange={(value) => update(index, { ...item, icon: value })} options={iconOptions} value={item.icon} />
      <FormField htmlFor={`${item.id}-color`} label="Цвет"><div className="flex gap-2"><Input aria-label={`Цвет: ${item.label}`} className="w-12 px-1" id={`${item.id}-color`} onChange={(event) => update(index, { ...item, color: event.target.value })} readOnly={readonly} type="color" value={item.color} /><Input aria-label={`Код цвета: ${item.label}`} className="min-w-0" onChange={(event) => update(index, { ...item, color: event.target.value })} readOnly={readonly} value={item.color} /></div></FormField>
      <div className="flex items-center justify-end gap-1"><label className="mr-2 flex items-center gap-2 text-[11px]"><Switch checked={item.visible} disabled={readonly} onCheckedChange={(checked) => update(index, { ...item, visible: checked })} size="sm" />Видим</label><Button aria-label="Выше" disabled={readonly || index === 0} onClick={() => move(index, -1)} size="icon-xs" variant="ghost"><IconArrowUp /></Button><Button aria-label="Ниже" disabled={readonly || index === items.length - 1} onClick={() => move(index, 1)} size="icon-xs" variant="ghost"><IconArrowDown /></Button><Button aria-label="Удалить" disabled={readonly} onClick={() => remove(index)} size="icon-xs" variant="ghost"><IconTrash /></Button></div>
    </div>
    {depth < 2 ? <div className="border-t px-3 py-2"><Button disabled={readonly} onClick={() => update(index, { ...item, children: [...item.children, newItem()] })} size="xs" variant="ghost"><IconPlus />Добавить подпункт</Button></div> : null}
    {item.children.length ? <div className="border-t bg-muted/15 p-2"><NavigationList depth={depth + 1} items={item.children} onChange={(children) => update(index, { ...item, children })} readonly={readonly} /></div> : null}
  </div>)}</div>
}

function NavigationPreview({ items, tab }: { items: PublicNavigationItem[]; tab: "header" | "mobile" | "footer" }) {
  const visible = items.filter((item) => item.visible)
  return <EditorSection subtitle="Обновляется сразу; на сайте изменения появятся после публикации и доставки." title="Предварительный вид"><div className={tab === "footer" ? "rounded-lg bg-neutral-900 p-4 text-white" : "rounded-lg border bg-background p-3"}><div className={`flex flex-wrap items-center gap-2 ${tab === "mobile" ? "mx-auto max-w-sm flex-col items-stretch" : ""}`}>{visible.map((item) => <div className="group relative" key={item.id}><span className="inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-medium" style={{ color: item.color }}><span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />{item.label}{item.children.some((child) => child.visible) ? <IconChevronRight className="size-3 rotate-90" /> : null}</span>{item.children.some((child) => child.visible) ? <div className="mt-1 min-w-44 rounded-lg border bg-background p-1 text-foreground shadow-sm">{item.children.filter((child) => child.visible).map((child) => <div className="rounded-md px-3 py-2 text-xs" key={child.id}>{child.label}</div>)}</div> : null}</div>)}</div></div></EditorSection>
}

function NavigationSidebar({ draft }: { draft: PublicNavigation }) {
  const count = useMemo(() => countItems(draft.header) + countItems(draft.mobile) + countItems(draft.footer), [draft.footer, draft.header, draft.mobile])
  return <section className="overflow-hidden rounded-xl border bg-background"><ListSection count={4} icon={IconLink} title="Сводка"><ListRow><Summary label="Редакция" value={<ContentStatusBadge status={draft.status} />} /></ListRow><ListRow><Summary label="Всего пунктов" value={String(count)} /></ListRow><ListRow><Summary label="Обновлено" value={draft.updatedLabel} /></ListRow><ListRow><Summary label="История" value={draft.hasPublishedRevision ? "Меню публиковалось" : "Ещё не публиковалось"} /></ListRow></ListSection><p className="border-t px-4 py-2 text-[10px] text-muted-foreground">Шапка, мобильное меню и подвал публикуются вместе. Формат ссылок проверяется при сохранении; доступность страниц проверяйте вручную.</p></section>
}

function Summary({ label, value }: { label: string; value: React.ReactNode }) { return <div className="flex min-h-11 items-center justify-between gap-3 px-4 py-2"><span className="text-[10px] text-muted-foreground">{label}</span><span className="text-right text-xs font-medium">{value}</span></div> }
function newItem(): PublicNavigationItem { const id = globalThis.crypto?.randomUUID?.() ?? `menu-${Date.now()}-${Math.random().toString(36).slice(2)}`; return { id, label: "Новый пункт", href: "/", icon: "link", color: "#5f6368", visible: true, children: [] } }
function countItems(items: PublicNavigationItem[]): number { return items.reduce((sum, item) => sum + 1 + countItems(item.children), 0) }
function message(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback }

function mergeNavigationChanges(persisted: PublicNavigation, local: PublicNavigation, server: PublicNavigation): PublicNavigation {
  return {
    ...server,
    header: mergeNavigationItems(persisted.header, local.header, server.header),
    mobile: mergeNavigationItems(persisted.mobile, local.mobile, server.mobile),
    footer: mergeNavigationItems(persisted.footer, local.footer, server.footer),
  }
}

function mergeNavigationItems(persisted: PublicNavigationItem[], local: PublicNavigationItem[], server: PublicNavigationItem[]): PublicNavigationItem[] {
  const before = new Map(persisted.map((item) => [item.id, item]))
  const edited = new Map(local.map((item) => [item.id, item]))
  const removed = new Set(persisted.filter((item) => !edited.has(item.id)).map((item) => item.id))
  let merged = server.filter((item) => !removed.has(item.id)).map((item) => {
    const previous = before.get(item.id)
    const localItem = edited.get(item.id)
    if (!previous || !localItem) return item
    return {
      ...item,
      label: valueChanged(previous.label, localItem.label) ? localItem.label : item.label,
      href: valueChanged(previous.href, localItem.href) ? localItem.href : item.href,
      icon: valueChanged(previous.icon, localItem.icon) ? localItem.icon : item.icon,
      color: valueChanged(previous.color, localItem.color) ? localItem.color : item.color,
      visible: valueChanged(previous.visible, localItem.visible) ? localItem.visible : item.visible,
      ...(valueChanged(previous.target, localItem.target) && localItem.target !== undefined ? { target: localItem.target } : {}),
      ...(valueChanged(previous.visibleOn, localItem.visibleOn) && localItem.visibleOn !== undefined ? { visibleOn: localItem.visibleOn } : {}),
      children: mergeNavigationItems(previous.children, localItem.children, item.children),
    }
  })
  for (const item of local) if (!before.has(item.id) && !merged.some((current) => current.id === item.id)) merged.push(item)
  if (valueChanged(persisted.map((item) => item.id), local.filter((item) => before.has(item.id)).map((item) => item.id))) {
    const byId = new Map(merged.map((item) => [item.id, item]))
    merged = [...local.map((item) => byId.get(item.id)).filter((item): item is PublicNavigationItem => Boolean(item)), ...merged.filter((item) => !edited.has(item.id))]
  }
  return merged
}

function valueChanged(left: unknown, right: unknown) { return JSON.stringify(left) !== JSON.stringify(right) }
