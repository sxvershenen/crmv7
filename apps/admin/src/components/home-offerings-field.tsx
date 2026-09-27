import { useCallback, useState } from "react"
import { IconArrowDown, IconArrowUp, IconPlus, IconX } from "@tabler/icons-react"
import type { CmsHomeOfferingKind } from "@crm/contracts"
import { Button, Input, StatusBadge } from "@crm/ui"

import { cmsRepository } from "@admin/data/cms-repository"
import { useRepository } from "@admin/features/use-repository"

const labels = { house: "домики", program: "программы", venue: "площадки" }
const stateLabels = { draft: "Черновик CRM", active: "Активен в CRM", paused: "Приостановлен в CRM" }

export function HomeOfferingsField({ kind, ids, editable, onChange }: { kind: CmsHomeOfferingKind; ids: string[] | undefined; editable: boolean; onChange: (ids: string[]) => void }) {
  const loader = useCallback(() => cmsRepository.getHomeOfferingChoices(kind), [kind])
  const state = useRepository(loader)
  const [query, setQuery] = useState("")
  const choices = state.data ?? []
  const byId = new Map(choices.map((item) => [item.offeringId, item]))
  const selected = ids ?? []
  const available = choices.filter((item) => !selected.includes(item.offeringId) && item.title.toLocaleLowerCase("ru-RU").includes(query.trim().toLocaleLowerCase("ru-RU")))
  const move = (index: number, offset: number) => {
    const next = [...selected]
    const [id] = next.splice(index, 1)
    if (id) { next.splice(index + offset, 0, id); onChange(next) }
  }

  return <div className="space-y-3 rounded-lg border p-3">
    <div><p className="text-xs font-semibold">Карточки: {labels[kind]}</p><p className="mt-1 text-xs text-muted-foreground">Выберите до 12 ресурсов и задайте порядок. На сайте появятся только карточки с опубликованной страницей; цену и доступность сайт берёт из CRM.</p></div>
    {ids === undefined ? <div className="flex flex-wrap items-center gap-2"><p className="text-xs text-muted-foreground">Старая настройка: показываются все опубликованные карточки.</p><Button disabled={!editable} onClick={() => onChange([])} size="xs" variant="outline">Включить ручной выбор</Button></div> : <>
      {selected.length ? <div aria-label={`Выбранные ${labels[kind]}`} className="space-y-2">{selected.map((id, index) => {
        const item = byId.get(id)
        return <div className="flex flex-wrap items-center gap-2 rounded-lg border px-2 py-2" key={id}><span className="min-w-0 flex-1 break-words text-xs font-medium">{item?.title ?? id}</span><StatusBadge tone={item?.state === "active" ? "success" : "warning"}>{item ? stateLabels[item.state] : state.data ? "Архивирован или удалён в CRM" : "Нет данных CRM"}</StatusBadge><Button aria-label={`Поднять ${item?.title ?? id}`} disabled={!editable || index === 0} onClick={() => move(index, -1)} size="icon-xs" variant="ghost"><IconArrowUp /></Button><Button aria-label={`Опустить ${item?.title ?? id}`} disabled={!editable || index === selected.length - 1} onClick={() => move(index, 1)} size="icon-xs" variant="ghost"><IconArrowDown /></Button><Button aria-label={`Убрать ${item?.title ?? id}`} disabled={!editable} onClick={() => onChange(selected.filter((value) => value !== id))} size="icon-xs" variant="ghost"><IconX /></Button></div>
      })}</div> : <p className="text-xs text-muted-foreground">Карточки не выбраны. Секция останется без карточек.</p>}
      <Input aria-label={`Найти ${labels[kind]} в CRM`} placeholder="Поиск по названию" value={query} onChange={(event) => setQuery(event.target.value)} />
      {state.loading ? <p className="text-xs text-muted-foreground">Загружаем ресурсы CRM…</p> : state.error ? <div className="flex flex-wrap items-center gap-2 text-xs text-danger"><span>Не удалось загрузить ресурсы CRM: {state.error}</span><Button onClick={state.reload} size="xs" variant="outline">Повторить</Button></div> : available.length ? <div className="max-h-72 space-y-1 overflow-y-auto">{available.map((item) => <div className="flex flex-wrap items-center gap-2 rounded-lg border px-2 py-2" key={item.offeringId}><span className="min-w-0 flex-1 break-words text-xs">{item.title}</span><StatusBadge tone={item.state === "active" ? "success" : "neutral"}>{stateLabels[item.state]}</StatusBadge><Button aria-label={`Добавить ${item.title}`} disabled={!editable || selected.length >= 12} onClick={() => onChange([...selected, item.offeringId])} size="xs" variant="outline"><IconPlus />Добавить</Button></div>)}</div> : <p className="text-xs text-muted-foreground">Подходящих ресурсов нет.</p>}
    </>}
  </div>
}
