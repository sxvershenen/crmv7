import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { IconAlertTriangle, IconCalendarEvent, IconRefresh } from "@tabler/icons-react"
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"

import { Button, PageState } from "@crm/ui"
import { EventServiceOfferingWorkspace, type EventServiceOfferingWorkspaceTab } from "@crm/offering-editor"

import { useEditorLayoutChrome } from "@app/app/editor-layout-context"
import { eventServiceRepository, type EventServiceRepository, type EventServiceTemplateResolution } from "@app/data/event-services-repository"

function isTab(value: string | null): value is EventServiceOfferingWorkspaceTab { return value === "terms" || value === "pricing" || value === "preview" }
const adminAppBaseUrl = (import.meta.env.VITE_ADMIN_APP_URL ?? (import.meta.env.DEV ? "http://localhost:5174" : "/cms")).replace(/\/$/, "")

export function EventServiceOfferingEditorPage({ repository = eventServiceRepository }: { repository?: EventServiceRepository }) {
  const { offeringId = "" } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [resolution, setResolution] = useState<EventServiceTemplateResolution | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigationGuard = useRef<(() => boolean) | null>(null)
  const loadSequence = useRef(0)
  const templateId = typeof location.state === "object" && location.state && "templateId" in location.state && typeof location.state.templateId === "string" ? location.state.templateId : location.pathname.startsWith("/offers/event-services/templates/") ? offeringId : null
  const tab = isTab(params.get("tab")) ? params.get("tab") as EventServiceOfferingWorkspaceTab : "terms"
  const from = typeof location.state === "object" && location.state && "from" in location.state && typeof location.state.from === "string" ? location.state.from : "/events/categories"

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current
    setLoading(true); setError(null)
    try {
      if (templateId) {
        const result = await repository.getByTemplateId(templateId)
        if (sequence === loadSequence.current) setResolution(result)
      } else {
        const data = await repository.getByOfferingId(offeringId)
        if (sequence === loadSequence.current) setResolution(data ? { resolution: "linked", data } : null)
      }
    } catch (reason) { if (sequence === loadSequence.current) setError(reason instanceof Error ? reason.message : "Не удалось открыть категорию мероприятия") } finally { if (sequence === loadSequence.current) setLoading(false) }
  }, [offeringId, repository, templateId])
  useEffect(() => { void load() }, [load])
  const close = useCallback(() => { if (navigationGuard.current?.() ?? true) navigate(from) }, [from, navigate])
  const linked = resolution?.resolution === "linked" ? resolution.data : null
  useEditorLayoutChrome(useMemo(() => ({ idLabel: linked ? `#${linked.dossier.offering.code}` : "#event-category", onBack: close, title: linked?.dossier.offering.operationalName ?? "Категория мероприятия" }), [close, linked]))
  const setGuard = useCallback((guard: (() => boolean) | null) => { navigationGuard.current = guard }, [])
  const reload = useCallback(async () => { await load() }, [load])
  const createTemplateCommandMeta = useCallback(() => ({ operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), expectedSubjectVersion: linked?.dossier.template.version ?? 1 }), [linked?.dossier.template.version])
  const createPricingCommandMeta = useCallback(() => ({ operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), expectedPricingVersion: linked?.editor.ownerVersions.pricing ?? 1 }), [linked?.editor.ownerVersions.pricing])
  const createPreviewCommandMeta = useCallback(() => ({ operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() }), [])
  const editorialHref = useCallback((nodeId: string) => linked ? `${adminAppBaseUrl}/offers/event-services/${encodeURIComponent(linked.dossier.offering.id)}?tab=content&node=${encodeURIComponent(nodeId)}` : null, [linked])

  if (loading && !resolution) return <div aria-label="Загрузка категории мероприятия" className="mx-auto max-w-[1480px] space-y-4 p-5" role="status"><div className="h-8 w-64 animate-pulse rounded bg-muted" /><div className="h-72 animate-pulse rounded-xl border bg-muted/20" /></div>
  if (error && !resolution) return <div className="mx-auto max-w-[960px] p-5"><div className="rounded-xl border bg-background"><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={() => void load()} title="Категория не открылась" tone="danger">{error}</PageState></div></div>
  if (!resolution) return <div className="mx-auto max-w-[960px] p-5"><div className="rounded-xl border bg-background"><PageState icon={IconCalendarEvent} title="Категория не найдена">Возможно, она была удалена или у вас нет доступа.</PageState></div></div>
  if (resolution.resolution === "ambiguous") return <div className="mx-auto max-w-[960px] p-5"><div className="rounded-xl border bg-background"><PageState icon={IconAlertTriangle} title="Нужна ручная сверка" tone="danger">Для категории найдено несколько коммерческих записей. Цены и CMS заблокированы.</PageState></div></div>
  if (resolution.resolution === "unprepared") return <UnpreparedState busy={false} onBack={close} onPrepare={async () => { await repository.prepare(resolution.eventServiceTemplateId, { operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), expectedEventServiceTemplateVersion: resolution.eventServiceTemplateVersion }); await load() }} />
  return <><>{error ? <div className="mx-auto max-w-[1480px] px-5 pt-3" role="alert"><div className="flex flex-wrap items-start gap-2 rounded-lg border border-danger/25 bg-danger-subtle/20 p-3 text-xs text-danger-foreground"><IconAlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><div className="min-w-0 flex-1"><p className="font-semibold">Не удалось обновить категорию</p><p className="mt-1">{error}</p></div><Button onClick={() => void load()} size="sm" variant="outline">Повторить</Button></div></div> : null}</><EventServiceOfferingWorkspace key={resolution.data.dossier.offering.id} data={resolution.data} createPreviewCommandMeta={createPreviewCommandMeta} createPricingCommandMeta={createPricingCommandMeta} createTemplateCommandMeta={createTemplateCommandMeta} editorialHref={editorialHref} gateway={repository} initialTab={tab} onBack={close} onNavigationGuardChange={setGuard} onReload={reload} onTabChange={(nextTab) => setParams((current) => { const next = new URLSearchParams(current); if (nextTab === "terms") next.delete("tab"); else next.set("tab", nextTab); return next }, { replace: true })} /></>
}

function UnpreparedState({ busy, onBack, onPrepare }: { busy: boolean; onBack: () => void; onPrepare: () => Promise<void> }) {
  const [pending, setPending] = useState(busy)
  const [error, setError] = useState<string | null>(null)
  const prepare = async () => { setPending(true); setError(null); try { await onPrepare() } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось подготовить категорию") } finally { setPending(false) } }
  return <div className="mx-auto max-w-[960px] p-5"><div className="rounded-xl border bg-background p-5"><h1 className="text-base font-semibold">Категория ещё не подготовлена</h1><p className="mt-2 text-xs text-muted-foreground">Подготовка создаст коммерческую запись и canonical CMS-черновик в одной операции.</p>{error ? <p className="mt-3 text-xs text-danger-foreground" role="alert">{error}</p> : null}<div className="mt-4 flex flex-wrap gap-2"><Button disabled={pending} onClick={() => void prepare()}>{pending ? "Подготавливаем…" : "Подготовить продажи и CMS"}</Button><Button onClick={onBack} size="sm" variant="outline"><IconRefresh aria-hidden="true" />Закрыть</Button></div></div></div>
}
