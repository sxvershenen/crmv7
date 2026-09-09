import { useMemo, useState } from "react"
import { IconPlus, IconPuzzle, IconSearch } from "@tabler/icons-react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"

import type { AddOnApplicableOfferingKind, BusinessCalendarListResponse } from "@crm/contracts"
import type { AddOnOfferingListFilters, OfferingEditorGateway } from "@crm/offering-editor"
import { AddOnOfferingList, offeringEditorErrorMessage } from "@crm/offering-editor"
import { Button, EditorSection, FormField, FormSelect, Input, PageFrame, Switch } from "@crm/ui"

import { houseOfferingGateway } from "@app/data/house-offerings-repository"

type AddOnRegistryGateway = OfferingEditorGateway & { listActiveBusinessCalendars?: () => Promise<BusinessCalendarListResponse> }
type CreateServiceType = "quantity_service" | "person_service"

const stateOptions = [{ value: "all", label: "Все состояния" }, { value: "active", label: "Активные" }, { value: "draft", label: "Черновики" }, { value: "paused", label: "Приостановленные" }, { value: "archived", label: "В архиве" }]
const serviceOptions = [{ value: "all", label: "Все типы" }, { value: "quantity_service", label: "По количеству" }, { value: "person_service", label: "На участника" }]
const createServiceOptions = serviceOptions.slice(1)

export function AddOnOfferingsPage({ gateway = houseOfferingGateway }: { gateway?: AddOnRegistryGateway }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const filters = useMemo<AddOnOfferingListFilters>(() => ({
    ...(params.get("q")?.trim() ? { q: params.get("q")!.trim() } : {}),
    ...(params.get("state") && params.get("state") !== "all" ? { state: params.get("state") as NonNullable<AddOnOfferingListFilters["state"]> } : {}),
    ...(params.get("service") && params.get("service") !== "all" ? { serviceType: params.get("service") as NonNullable<AddOnOfferingListFilters["serviceType"]> } : {}),
  }), [params])
  const setParam = (key: string, value: string) => setParams((current) => { const next = new URLSearchParams(current); if (!value || value === "all") next.delete(key); else next.set(key, value); return next }, { replace: true })
  const creating = params.get("create") === "1"

  return <PageFrame className="space-y-3" width="wide">
    <section className="rounded-xl border bg-background p-4">
      <div className="flex flex-wrap items-start gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-info-subtle text-info-foreground"><IconPuzzle aria-hidden="true" className="size-5" /></span><div className="min-w-0 flex-1"><h1 className="text-base font-semibold">Допы и услуги</h1><p className="mt-1 text-xs text-muted-foreground">Единая библиотека услуг, которые можно добавлять в заказы.</p></div><Button onClick={() => setParam("create", "1")} size="sm"><IconPlus aria-hidden="true" />Новая услуга</Button></div>
      <div className="mt-4 grid items-end gap-3 sm:grid-cols-[minmax(260px,1fr)_180px_180px]">
        <FormField htmlFor="addon-search" label="Поиск"><div className="relative"><IconSearch aria-hidden="true" className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input className="pl-8" id="addon-search" onChange={(event) => setParam("q", event.target.value)} placeholder="Название или группа" value={params.get("q") ?? ""} /></div></FormField>
        <FormSelect id="addon-service" label="Тип услуги" onValueChange={(value) => setParam("service", value)} options={serviceOptions} value={params.get("service") ?? "all"} />
        <FormSelect id="addon-state" label="Состояние" onValueChange={(value) => setParam("state", value)} options={stateOptions} value={params.get("state") ?? "all"} />
      </div>
    </section>
    {creating ? <CreateAddOnCard gateway={gateway} onCancel={() => setParam("create", "")} onCreated={(id) => navigate(`/offers/addons/${id}`, { replace: true, state: { from: "/offers/addons" } })} /> : null}
    <AddOnOfferingList filters={filters} gateway={gateway} onOpenOffering={(item) => navigate(`/offers/addons/${item.offering.id}`, { state: { from: `${location.pathname}${location.search}` } })} />
  </PageFrame>
}

function CreateAddOnCard({ gateway, onCancel, onCreated }: { gateway: AddOnRegistryGateway; onCancel: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("")
  const [category, setCategory] = useState("comfort")
  const [serviceType, setServiceType] = useState<CreateServiceType>("quantity_service")
  const [standalone, setStandalone] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const create = async () => {
    if (!name.trim() || !category.match(/^[a-z][a-z0-9_]*$/)) return
    setPending(true)
    setError(null)
    try {
      if (!gateway.listActiveBusinessCalendars) throw new Error("Загрузка производственного календаря недоступна.")
      const calendars = await gateway.listActiveBusinessCalendars()
      const calendar = calendars.items[0]
      if (!calendar) throw new Error("Не найден активный производственный календарь. Откройте настройки CRM.")
      const operationId = crypto.randomUUID()
      const applicableOfferingKinds: AddOnApplicableOfferingKind[] = ["house", "campground", "venue", "event_service", "program"]
      const commonTerms = { categoryKey: category, applicableOfferingKinds }
      const terms = serviceType === "person_service"
        ? { ...commonTerms, serviceType, quantity: { metric: "participants" as const, min: 1, max: null, default: 1, step: 1 as const } }
        : { ...commonTerms, serviceType, quantity: { metric: "units" as const, min: 1, max: null, default: 1, step: 1 } }
      const result = await gateway.createAddOn({
        operationId,
        idempotencyKey: operationId,
        operationalName: name.trim(),
        businessCalendarId: calendar.id,
        internalComment: "",
        scope: "reusable",
        ownerOfferingId: null,
        standalone,
        salesMode: "selectable",
        priceDisplayMode: "from",
        currency: "RUB",
        timezone: "Europe/Moscow",
        taxMode: "tax_included",
        terms,
      })
      onCreated(result.offering.id)
    } catch (reason) {
      setError(offeringEditorErrorMessage(reason, "Не удалось создать услугу."))
    } finally {
      setPending(false)
    }
  }
  return <EditorSection actions={<Button onClick={onCancel} size="sm" variant="ghost">Отмена</Button>} subtitle="Страница сайта создастся черновиком автоматически. Цена задаётся после создания." title="Новая услуга">
    <div className="grid items-end gap-3 sm:grid-cols-6"><FormField className="sm:col-span-3" htmlFor="new-addon-name" label="Название"><Input autoFocus id="new-addon-name" onChange={(event) => setName(event.target.value)} placeholder="Например, Банный чан" value={name} /></FormField><FormSelect className="sm:col-span-2" id="new-addon-type" label="Как считать" onValueChange={(value) => setServiceType(value as CreateServiceType)} options={createServiceOptions} value={serviceType} /><FormField className="sm:col-span-1" htmlFor="new-addon-category" label="Группа"><Input id="new-addon-category" onChange={(event) => setCategory(event.target.value)} value={category} /></FormField><label className="flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium sm:col-span-3"><Switch checked={standalone} onCheckedChange={(value) => setStandalone(Boolean(value))} size="sm" />Можно продавать отдельно</label><div className="flex justify-end sm:col-span-3"><Button disabled={pending || !name.trim() || !category.match(/^[a-z][a-z0-9_]*$/)} onClick={() => void create()} size="sm">{pending ? "Создаём…" : "Создать услугу"}</Button></div></div>
    {error ? <p className="mt-3 text-xs text-danger" role="alert">{error}</p> : null}
  </EditorSection>
}
