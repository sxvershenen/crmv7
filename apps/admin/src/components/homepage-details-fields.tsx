import type { CmsHomeSectionDraft } from "@crm/contracts"
import { Button, FormField, Input, Textarea } from "@crm/ui"

export function HomepageDetailsFields({ id, sectionKey, value, onChange }: {
  id: string; sectionKey?: string; value: CmsHomeSectionDraft; onChange: (value: CmsHomeSectionDraft) => void
}) {
  const key = sectionKey === "reviews" ? "reviews" : sectionKey === "faq" || sectionKey === "directions" ? "faq" : undefined
  if (!key) return null
  const items = value[key] ?? []
  const move = (index: number, offset: number) => {
    const target = index + offset
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    onChange({ ...value, [key]: next })
  }
  const updateItem = (index: number, patch: Record<string, string | number>) => onChange({ ...value, [key]: items.map((item, position) => position === index ? { ...item, ...patch } : item) })
  const noun = key === "reviews" ? "отзыв" : "вопрос"
  return <div className="space-y-3">
    <p className="text-sm font-medium">{key === "reviews" ? "Отзывы гостей" : "Вопросы и ответы"}</p>
    {!items.length && <p className="text-sm text-muted-foreground">Список пуст — секция будет скрыта на сайте.</p>}
    <ol className="space-y-3">{items.map((item, index) => <li key={item.id} className="space-y-2 rounded-lg border p-3">
      {"name" in item ? <>
        <FormField htmlFor={`${id}-${item.id}-name`} label={`Имя автора ${index + 1}`}><Input id={`${id}-${item.id}-name`} maxLength={160} value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} /></FormField>
        <FormField htmlFor={`${id}-${item.id}-text`} label={`Текст отзыва ${index + 1}`}><Textarea id={`${id}-${item.id}-text`} maxLength={4000} value={item.text} onChange={(event) => updateItem(index, { text: event.target.value })} /></FormField>
        <FormField htmlFor={`${id}-${item.id}-rating`} label={`Оценка отзыва ${index + 1}`}><select id={`${id}-${item.id}-rating`} className="h-9 rounded-md border bg-background px-3 text-sm" value={item.rating} onChange={(event) => updateItem(index, { rating: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating}</option>)}</select></FormField>
      </> : <>
        <FormField htmlFor={`${id}-${item.id}-question`} label={`Вопрос ${index + 1}`}><Input id={`${id}-${item.id}-question`} maxLength={320} value={item.question} onChange={(event) => updateItem(index, { question: event.target.value })} /></FormField>
        <FormField htmlFor={`${id}-${item.id}-answer`} label={`Ответ ${index + 1}`}><Textarea id={`${id}-${item.id}-answer`} maxLength={4000} value={item.answer} onChange={(event) => updateItem(index, { answer: event.target.value })} /></FormField>
      </>}
      <div className="flex flex-wrap gap-1">
        <Button type="button" size="sm" variant="outline" aria-label={`Поднять ${noun} ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}>↑</Button>
        <Button type="button" size="sm" variant="outline" aria-label={`Опустить ${noun} ${index + 1}`} disabled={index === items.length - 1} onClick={() => move(index, 1)}>↓</Button>
        <Button type="button" size="sm" variant="outline" aria-label={`Удалить ${noun} ${index + 1}`} onClick={() => onChange({ ...value, [key]: items.filter((_, position) => position !== index) })}>Удалить</Button>
      </div>
    </li>)}</ol>
    <Button type="button" size="sm" variant="outline" disabled={items.length >= 40} onClick={() => onChange({ ...value, [key]: [...items, key === "reviews" ? { id: crypto.randomUUID(), name: "", text: "", rating: 5 } : { id: crypto.randomUUID(), question: "", answer: "" }] })}>Добавить {noun}</Button>
  </div>
}
