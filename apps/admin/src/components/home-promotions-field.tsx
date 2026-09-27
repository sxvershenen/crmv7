import { useCallback } from "react"
import { IconArrowDown, IconArrowUp, IconExternalLink, IconPlus, IconX } from "@tabler/icons-react"
import type { Promotion } from "@crm/contracts"
import { Button, StatusBadge } from "@crm/ui"

import { cmsRepository } from "@admin/data/cms-repository"
import { useRepository } from "@admin/features/use-repository"

const crmBase = (import.meta.env.VITE_CRM_URL || (import.meta.env.DEV ? "http://localhost:5173" : "/crm")).replace(/\/$/, "")

function availability(promotion: Promotion, now: Date) {
  const { active, startsAt, endsAt } = promotion.terms
  if (!active) return "Выключен в CRM"
  if (startsAt && new Date(startsAt) > now) return "Начнётся позже"
  if (endsAt && new Date(endsAt) <= now) return "Завершён"
  return "Действует"
}

function discount(promotion: Promotion) {
  return promotion.terms.discountType === "percent" ? `${promotion.terms.value}%` : new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(promotion.terms.value / 100)
}

function conditions(promotion: Promotion) {
  const minimum = promotion.terms.minimumAmountMinor
    ? `Заказ от ${new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(promotion.terms.minimumAmountMinor / 100)}`
    : null
  return [promotion.terms.name, minimum, promotion.terms.scope === "selected" ? "На выбранные предложения" : null].filter(Boolean).join(" · ")
}

export function HomePromotionsField({ editable, ids, onChange }: { editable: boolean; ids: string[]; onChange: (ids: string[]) => void }) {
  const loader = useCallback(() => cmsRepository.getPromotions(), [])
  const state = useRepository(loader)
  const promotions = state.data ?? []
  const byId = new Map(promotions.map((promotion) => [promotion.id, promotion]))
  const now = new Date()
  const move = (index: number, offset: number) => {
    const next = [...ids]
    const [id] = next.splice(index, 1)
    if (id) { next.splice(index + offset, 0, id); onChange(next) }
  }

  return <section className="rounded-lg border bg-background p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="text-sm font-semibold">Промокоды на главной</h4><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Выберите до трёх промокодов и их порядок. Условия скидки меняются в CRM; выключенные и завершённые промокоды автоматически скрываются на сайте.</p></div><a className="inline-flex items-center gap-1 text-xs text-primary hover:underline" href={`${crmBase}/marketing?tab=promotions`}><IconExternalLink className="size-4" />Промокоды в CRM</a></div>
    {ids.length ? <div className="mt-4 space-y-2" aria-label="Выбранные промокоды">{ids.map((id, index) => {
      const promotion = byId.get(id)
      const status = promotion ? availability(promotion, now) : state.data ? "Не найден в CRM" : "Нет данных CRM"
      return <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2" key={id}><div className="min-w-0 basis-full sm:basis-auto sm:flex-1"><p className="break-words text-xs font-medium">{promotion?.terms.code ?? id} {promotion ? `· ${discount(promotion)}` : null}</p><p className="text-xs text-muted-foreground">{promotion ? conditions(promotion) : "Проверьте доступ к CRM, прежде чем удалять выбор"}</p></div><StatusBadge tone={status === "Действует" ? "success" : "warning"}>{status}</StatusBadge><Button aria-label={`Поднять промокод ${promotion?.terms.code ?? id}`} disabled={!editable || index === 0} onClick={() => move(index, -1)} size="icon-xs" variant="ghost"><IconArrowUp /></Button><Button aria-label={`Опустить промокод ${promotion?.terms.code ?? id}`} disabled={!editable || index === ids.length - 1} onClick={() => move(index, 1)} size="icon-xs" variant="ghost"><IconArrowDown /></Button><Button aria-label={`Убрать промокод ${promotion?.terms.code ?? id}`} disabled={!editable} onClick={() => onChange(ids.filter((value) => value !== id))} size="icon-xs" variant="ghost"><IconX /></Button></div>
    })}</div> : <p className="mt-4 text-xs text-muted-foreground">На главной пока нет промокодов.</p>}
    {state.loading ? <p className="mt-3 text-xs text-muted-foreground">Загружаем промокоды CRM…</p> : state.error ? <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-danger"><span>Не удалось загрузить промокоды: {state.error}</span><Button onClick={state.reload} size="xs" variant="outline">Повторить</Button></div> : promotions.filter((promotion) => !ids.includes(promotion.id)).length ? <div className="mt-4 space-y-2"><h5 className="text-xs font-semibold">Доступны для выбора</h5>{promotions.filter((promotion) => !ids.includes(promotion.id)).map((promotion) => <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2" key={promotion.id}><div className="min-w-0 basis-full sm:basis-auto sm:flex-1"><p className="break-words text-xs font-medium">{promotion.terms.code} · {discount(promotion)}</p><p className="text-xs text-muted-foreground">{conditions(promotion)}</p></div><StatusBadge tone={availability(promotion, now) === "Действует" ? "success" : "neutral"}>{availability(promotion, now)}</StatusBadge><Button aria-label={`Выбрать промокод ${promotion.terms.code}`} disabled={!editable || ids.length >= 3} onClick={() => onChange([...ids, promotion.id])} size="xs" variant="outline"><IconPlus />Добавить</Button></div>)}</div> : <p className="mt-3 text-xs text-muted-foreground">Других промокодов в CRM нет.</p>}
  </section>
}
