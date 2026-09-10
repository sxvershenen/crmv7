import { CmsPartnersSectionConfigSchema, type CmsPartnersSectionDraft } from "@crm/contracts"
import { Alert, AlertDescription, AlertTitle, Button, FormField, Input, Textarea } from "@crm/ui"

export function PartnersSectionFields({ id, value, editable, onChange }: {
  id: string; value: CmsPartnersSectionDraft; editable: boolean; onChange: (value: CmsPartnersSectionDraft) => void
}) {
  const validation = CmsPartnersSectionConfigSchema.safeParse(value)
  const move = (index: number, offset: number) => {
    const items = [...value.items]
    const target = index + offset
    if (target < 0 || target >= items.length) return
    ;[items[index], items[target]] = [items[target]!, items[index]!]
    onChange({ ...value, items })
  }
  return <fieldset className="mt-3 space-y-3 rounded-lg border bg-background p-3" disabled={!editable}>
    <legend className="px-1 text-xs font-medium">Содержимое секции «Партнёры»</legend>
    <FormField htmlFor={`${id}-title`} label="Заголовок секции"><Input id={`${id}-title`} maxLength={160} value={value.title} onChange={(event) => onChange({ ...value, title: event.target.value })} /></FormField>
    <FormField htmlFor={`${id}-description`} label="Описание секции"><Textarea id={`${id}-description`} maxLength={320} value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })} /></FormField>
    <ol className="space-y-2">{value.items.map((item, index) => <li className="flex flex-wrap items-end gap-2" key={item.id}>
      <FormField className="min-w-0 flex-1 basis-48" htmlFor={`${id}-${item.id}`} label={`Название партнёра ${index + 1}`}><Input id={`${id}-${item.id}`} maxLength={160} value={item.label} onChange={(event) => onChange({ ...value, items: value.items.map((current) => current.id === item.id ? { ...current, label: event.target.value } : current) })} /></FormField>
      <div className="flex gap-1"><Button type="button" aria-label={`Поднять партнёра ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)} size="sm" variant="outline">↑</Button><Button type="button" aria-label={`Опустить партнёра ${index + 1}`} disabled={index === value.items.length - 1} onClick={() => move(index, 1)} size="sm" variant="outline">↓</Button><Button type="button" aria-label={`Удалить партнёра ${index + 1}`} onClick={() => onChange({ ...value, items: value.items.filter((current) => current.id !== item.id) })} size="sm" variant="outline">Удалить</Button></div>
    </li>)}</ol>
    <Button type="button" disabled={value.items.length >= 40} onClick={() => onChange({ ...value, items: [...value.items, { id: crypto.randomUUID(), label: "" }] })} size="sm" variant="outline">Добавить партнёра</Button>
    {!validation.success && <Alert><AlertTitle>Перед публикацией</AlertTitle><AlertDescription>{validation.error.issues[0]?.message}. Черновик можно сохранить.</AlertDescription></Alert>}
  </fieldset>
}
