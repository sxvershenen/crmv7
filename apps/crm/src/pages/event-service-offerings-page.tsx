import { useEffect, useMemo, useState } from "react"
import { IconAlertTriangle, IconCalendarEvent, IconPlus, IconSearch } from "@tabler/icons-react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"

import type { EventServiceTemplate, EventServiceTemplateCreateBody } from "@crm/contracts"
import { Button, EditorSection, FormField, FormSelect, Input, PageFrame, PageState, StatusBadge } from "@crm/ui"

import { eventServiceRepository, type EventServiceRepository } from "@app/data/event-services-repository"

type EventServiceFormat = EventServiceTemplate["format"]
const formatOptions: Array<{ value: EventServiceFormat; label: string }> = [{ value: "wedding", label: "Свадьба" }, { value: "corporate", label: "Корпоратив" }, { value: "birthday", label: "День рождения" }, { value: "other", label: "Другое" }]
const stateOptions: Array<{ value: string; label: string }> = [{ value: "all", label: "Все состояния" }, { value: "active", label: "Активные" }, { value: "draft", label: "Черновики" }, { value: "paused", label: "Приостановленные" }, { value: "archived", label: "В архиве" }]

export function EventServiceOfferingsPage({ repository = eventServiceRepository }: { repository?: EventServiceRepository }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [items, setItems] = useState<Awaited<ReturnType<EventServiceRepository["list"]>>["items"] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const q = params.get("q") ?? ""
  const format = params.get("format") ?? ""
  const state = params.get("state") ?? "all"
  const query = useMemo(() => ({ ...(q.trim() ? { q: q.trim() } : {}), ...(format ? { format: format as EventServiceFormat } : {}), ...(state !== "all" ? { state: state as NonNullable<Awaited<ReturnType<EventServiceRepository["list"]>>["items"][number]["offering"]>["state"] } : {}) }), [format, q, state])

  useEffect(() => {
    let active = true
    setItems(null); setError(null)
    repository.list(query).then((result) => { if (active) setItems(result.items) }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Не удалось загрузить категории мероприятий") })
    return () => { active = false }
  }, [query, reloadKey, repository])

  const setParam = (key: string, value: string) => setParams((current) => { const next = new URLSearchParams(current); if (!value || value === "all") next.delete(key); else next.set(key, value); return next }, { replace: true })
  return <PageFrame className="space-y-3" width="wide">
    <section className="rounded-xl border bg-background p-4">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-info-subtle text-info-foreground"><IconCalendarEvent aria-hidden="true" className="size-5" /></span>
        <div className="min-w-0 flex-1"><h1 className="text-base font-semibold">Категории мероприятий</h1><p className="mt-1 text-xs text-muted-foreground">Условия категорий и их коммерческие пакеты.</p></div>
        <Button onClick={() => navigate("/events/categories/new", { state: { from: `${location.pathname}${location.search}` } })} size="sm"><IconPlus aria-hidden="true" />Новая категория</Button>
      </div>
      <div className="mt-4 grid items-end gap-3 sm:grid-cols-[minmax(260px,1fr)_180px_180px]">
        <FormField htmlFor="event-service-search" label="Поиск"><div className="relative"><IconSearch aria-hidden="true" className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input className="pl-8" id="event-service-search" onChange={(event) => setParam("q", event.target.value)} placeholder="Код или название" value={q} /></div></FormField>
        <FormSelect id="event-service-format-filter" label="Формат" onValueChange={(value) => setParam("format", value)} options={[{ value: "", label: "Все форматы" }, ...formatOptions]} value={format} />
        <FormSelect id="event-service-state-filter" label="Состояние" onValueChange={(value) => setParam("state", value)} options={stateOptions} value={state} />
      </div>
    </section>
    {items === null && !error ? <div aria-label="Загрузка категорий мероприятий" className="h-48 animate-pulse rounded-xl border bg-muted/20" role="status" /> : null}
    {error ? <div className="rounded-xl border bg-background"><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={() => setReloadKey((current) => current + 1)} title="Категории не загрузились" tone="danger">{error}</PageState></div> : null}
    {!error && items?.length === 0 ? <div className="rounded-xl border bg-background"><PageState icon={IconCalendarEvent} title={q || format || state !== "all" ? "Категории не найдены" : "Категорий пока нет"}>{q || format || state !== "all" ? "Измените фильтры." : "Создайте первую категорию мероприятия."}</PageState></div> : null}
    {!error && items?.length ? <div className="divide-y overflow-hidden rounded-xl border bg-background" data-slot="event-service-registry">{items.map((item) => {
      const label = item.offering ? "Категория мероприятия" : "Категория не подготовлена"
      const href = item.offering ? `/events/categories/${item.offering.offeringId}` : `/events/categories/${item.template.id}`
      return <div className="flex flex-wrap items-center gap-3 p-3" key={item.template.id}><IconCalendarEvent aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{label}</p><p className="truncate text-xs text-muted-foreground">{formatOptions.find((option) => option.value === item.template.format)?.label} · {item.template.defaultDurationMinutes} мин</p></div><StatusBadge tone={item.offering?.state === "active" ? "success" : item.offering?.state === "archived" ? "neutral" : "warning"}>{item.offering?.state === "active" ? "Активно" : item.offering?.state === "archived" ? "В архиве" : item.offering ? "Черновик" : "Нужна настройка"}</StatusBadge><Button aria-label={`Открыть ${label}`} onClick={() => navigate(href, { state: { from: `${location.pathname}${location.search}`, templateId: item.template.id } })} size="sm" variant="outline">Открыть</Button></div>
    })}</div> : null}
  </PageFrame>
}

export function EventServiceCreatePage({ repository = eventServiceRepository }: { repository?: EventServiceRepository }) {
  const navigate = useNavigate()
  const location = useLocation()
  const from = typeof location.state === "object" && location.state && "from" in location.state && typeof location.state.from === "string" ? location.state.from : "/events/categories"
  const [calendars, setCalendars] = useState<Awaited<ReturnType<EventServiceRepository["listActiveBusinessCalendars"]>>["items"] | null>(null)
  const [form, setForm] = useState({ operationalName: "", offeringCode: "event_service_new", format: "wedding" as EventServiceFormat, defaultDurationMinutes: 240, minimumGuests: "10", maximumGuests: "80", preparationBeforeMinutes: 60, preparationAfterMinutes: 30, timezone: "Europe/Moscow" })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  useEffect(() => { repository.listActiveBusinessCalendars().then((result) => setCalendars(result.items)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Не удалось загрузить производственный календарь")) }, [repository])
  const update = (patch: Partial<typeof form>) => { setForm((current) => ({ ...current, ...patch })); setDirty(true) }
  const canLeave = () => !dirty || typeof window === "undefined" || window.confirm("Есть несохранённые изменения. Закрыть редактор?")
  useEffect(() => {
    if (!dirty || typeof window === "undefined") return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", beforeUnload)
    return () => window.removeEventListener("beforeunload", beforeUnload)
  }, [dirty])
  const create = async () => {
    const calendar = calendars?.[0]
    if (!calendar || !form.operationalName.trim() || !form.offeringCode.trim() || pending) return
    setPending(true); setError(null)
    try {
      const code = form.offeringCode.trim()
      const body: EventServiceTemplateCreateBody = { operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), operationalName: form.operationalName.trim(), offeringCode: code, templateCode: code, internalComment: "", salesMode: "quoted", priceDisplayMode: "from", currency: "RUB", timezone: form.timezone, taxMode: "tax_included", businessCalendarId: calendar.id, format: form.format, defaultDurationMinutes: form.defaultDurationMinutes, minimumGuests: form.minimumGuests.trim() ? Number(form.minimumGuests) : null, maximumGuests: form.maximumGuests.trim() ? Number(form.maximumGuests) : null, preparationBeforeMinutes: form.preparationBeforeMinutes, preparationAfterMinutes: form.preparationAfterMinutes }
      const result = await repository.create(body)
      setDirty(false)
      navigate(`/events/categories/${result.offering.id}`, { replace: true, state: { from, templateId: result.template.id } })
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось создать категорию мероприятия") } finally { setPending(false) }
  }
  return <PageFrame width="wide"><EditorSection actions={<Button onClick={() => { if (canLeave()) navigate(from) }} size="sm" variant="ghost">Отмена</Button>} subtitle="Условия, продажи и CMS-черновик создаются одной командой." title="Новая категория мероприятия">
    <div className="grid items-end gap-4 sm:grid-cols-6">
      <FormField className="sm:col-span-3" htmlFor="event-service-create-name" label="Название"><Input autoFocus id="event-service-create-name" onChange={(event) => update({ operationalName: event.target.value })} placeholder="Например, Свадебное мероприятие" value={form.operationalName} /></FormField>
      <FormField className="sm:col-span-3" htmlFor="event-service-create-offering-code" label="Код"><Input id="event-service-create-offering-code" onChange={(event) => update({ offeringCode: event.target.value })} value={form.offeringCode} /></FormField>
      <FormSelect className="sm:col-span-3" id="event-service-create-format" label="Формат" onValueChange={(value) => update({ format: value as EventServiceFormat })} options={formatOptions} value={form.format} />
      <FormField className="sm:col-span-3" htmlFor="event-service-create-duration" label="Длительность, минут"><Input id="event-service-create-duration" min="1" onChange={(event) => update({ defaultDurationMinutes: Math.max(1, Number(event.target.value) || 1) })} type="number" value={form.defaultDurationMinutes} /></FormField>
      <FormField className="sm:col-span-3" htmlFor="event-service-create-min" label="Минимум гостей"><Input id="event-service-create-min" min="0" onChange={(event) => update({ minimumGuests: event.target.value })} value={form.minimumGuests} /></FormField>
      <FormField className="sm:col-span-3" htmlFor="event-service-create-max" label="Максимум гостей"><Input id="event-service-create-max" min="0" onChange={(event) => update({ maximumGuests: event.target.value })} value={form.maximumGuests} /></FormField>
      <FormField className="sm:col-span-3" htmlFor="event-service-create-before" label="Подготовка до, минут"><Input id="event-service-create-before" min="0" onChange={(event) => update({ preparationBeforeMinutes: Math.max(0, Number(event.target.value) || 0) })} type="number" value={form.preparationBeforeMinutes} /></FormField>
      <FormField className="sm:col-span-3" htmlFor="event-service-create-after" label="Подготовка после, минут"><Input id="event-service-create-after" min="0" onChange={(event) => update({ preparationAfterMinutes: Math.max(0, Number(event.target.value) || 0) })} type="number" value={form.preparationAfterMinutes} /></FormField>
    </div>
    {error ? <p className="mt-3 text-xs text-danger-foreground" role="alert">{error}</p> : null}
    {!calendars && !error ? <p className="mt-3 text-xs text-muted-foreground">Загружаем производственный календарь…</p> : null}
    <div className="mt-4 flex justify-end"><Button disabled={pending || !calendars?.length || !form.operationalName.trim() || !form.offeringCode.trim()} onClick={() => void create()}>{pending ? "Создаём…" : "Создать категорию"}</Button></div>
  </EditorSection></PageFrame>
}
