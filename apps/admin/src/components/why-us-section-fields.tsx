import { CmsWhyUsSectionConfigSchema, type CmsWhyUsSectionDraft } from "@crm/contracts"
import { Alert, AlertDescription, AlertTitle, Button, FormField, Input, Textarea } from "@crm/ui"

export function WhyUsSectionFields({ id, value, editable, onChange }: {
  id: string; value: CmsWhyUsSectionDraft; editable: boolean; onChange: (value: CmsWhyUsSectionDraft) => void
}) {
  const validation = CmsWhyUsSectionConfigSchema.safeParse(value)
  const move = (index: number, offset: number) => {
    const facts = [...value.facts]
    const target = index + offset
    if (target < 0 || target >= facts.length) return
    ;[facts[index], facts[target]] = [facts[target]!, facts[index]!]
    onChange({ ...value, facts })
  }
  return <fieldset className="mt-3 space-y-3 rounded-lg border bg-background p-3" disabled={!editable}>
    <legend className="px-1 text-xs font-medium">Содержимое секции «Why us»</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField htmlFor={`${id}-eyebrow`} label="Надзаголовок"><Input id={`${id}-eyebrow`} maxLength={160} value={value.eyebrow} onChange={(event) => onChange({ ...value, eyebrow: event.target.value })} /></FormField>
      <FormField htmlFor={`${id}-title`} label="Заголовок секции"><Input id={`${id}-title`} maxLength={160} value={value.title} onChange={(event) => onChange({ ...value, title: event.target.value })} /></FormField>
    </div>
    <FormField htmlFor={`${id}-description`} label="Описание секции"><Textarea id={`${id}-description`} maxLength={500} value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })} /></FormField>
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-xs font-medium">Командный блок</p>
      <div className="mt-3 grid gap-3">
        <FormField htmlFor={`${id}-team-label`} label="Подпись"><Input id={`${id}-team-label`} maxLength={160} value={value.team.label} onChange={(event) => onChange({ ...value, team: { ...value.team, label: event.target.value } })} /></FormField>
        <FormField htmlFor={`${id}-team-title`} label="Заголовок"><Input id={`${id}-team-title`} maxLength={240} value={value.team.title} onChange={(event) => onChange({ ...value, team: { ...value.team, title: event.target.value } })} /></FormField>
        <FormField htmlFor={`${id}-team-description`} label="Описание"><Textarea id={`${id}-team-description`} maxLength={500} value={value.team.description} onChange={(event) => onChange({ ...value, team: { ...value.team, description: event.target.value } })} /></FormField>
      </div>
    </div>
    <ol className="space-y-3">{value.facts.map((fact, index) => <li className="rounded-md border p-3" key={fact.id}>
      <div className="grid gap-2 sm:grid-cols-2">
        <FormField htmlFor={`${id}-${fact.id}-number`} label={`Акцент факта ${index + 1}`}><Input id={`${id}-${fact.id}-number`} maxLength={40} value={fact.number} onChange={(event) => onChange({ ...value, facts: value.facts.map((current) => current.id === fact.id ? { ...current, number: event.target.value } : current) })} /></FormField>
        <FormField htmlFor={`${id}-${fact.id}-title`} label="Название"><Input id={`${id}-${fact.id}-title`} maxLength={160} value={fact.title} onChange={(event) => onChange({ ...value, facts: value.facts.map((current) => current.id === fact.id ? { ...current, title: event.target.value } : current) })} /></FormField>
        <FormField className="sm:col-span-2" htmlFor={`${id}-${fact.id}-description`} label="Описание"><Textarea id={`${id}-${fact.id}-description`} maxLength={600} value={fact.description} onChange={(event) => onChange({ ...value, facts: value.facts.map((current) => current.id === fact.id ? { ...current, description: event.target.value } : current) })} /></FormField>
      </div>
      <div className="mt-2 flex gap-1"><Button type="button" aria-label={`Поднять факт ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)} size="sm" variant="outline">↑</Button><Button type="button" aria-label={`Опустить факт ${index + 1}`} disabled={index === value.facts.length - 1} onClick={() => move(index, 1)} size="sm" variant="outline">↓</Button><Button type="button" aria-label={`Удалить факт ${index + 1}`} onClick={() => onChange({ ...value, facts: value.facts.filter((current) => current.id !== fact.id) })} size="sm" variant="outline">Удалить</Button></div>
    </li>)}</ol>
    <Button type="button" disabled={value.facts.length >= 8} onClick={() => onChange({ ...value, facts: [...value.facts, { id: `fact-${crypto.randomUUID()}`, number: "", title: "", description: "" }] })} size="sm" variant="outline">Добавить факт</Button>
    {!validation.success && <Alert><AlertTitle>Перед публикацией</AlertTitle><AlertDescription>{validation.error.issues[0]?.message}. Черновик можно сохранить.</AlertDescription></Alert>}
  </fieldset>
}
