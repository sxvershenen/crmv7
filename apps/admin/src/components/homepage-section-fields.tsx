import { CmsHomeSectionConfigSchema, type CmsHomeSectionDraft } from "@crm/contracts"
import { Alert, AlertDescription, AlertTitle, FormField, Input, Textarea } from "@crm/ui"

export function HomepageSectionFields({ id, value, editable, onChange }: { id: string; value: CmsHomeSectionDraft; editable: boolean; onChange: (value: CmsHomeSectionDraft) => void }) {
  const validation = CmsHomeSectionConfigSchema.safeParse(value)
  const updateAction = (patch: Partial<NonNullable<CmsHomeSectionDraft["action"]>>) => {
    const action = { label: value.action?.label ?? "", href: value.action?.href ?? "/", ...patch }
    onChange({ ...value, action: action.label || patch.href ? action : null })
  }
  return <fieldset className="mt-3 space-y-3 rounded-lg border bg-background p-3" disabled={!editable}>
    <legend className="px-1 text-xs font-medium">Редакционный текст секции</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField htmlFor={`${id}-eyebrow`} label="Надзаголовок"><Input id={`${id}-eyebrow`} maxLength={160} value={value.eyebrow ?? ""} onChange={(event) => onChange({ ...value, eyebrow: event.target.value || null })} /></FormField>
      <FormField htmlFor={`${id}-title`} label="Заголовок секции"><Input id={`${id}-title`} maxLength={240} value={value.title} onChange={(event) => onChange({ ...value, title: event.target.value })} /></FormField>
    </div>
    <FormField htmlFor={`${id}-description`} label="Описание секции"><Textarea id={`${id}-description`} maxLength={1000} value={value.description} onChange={(event) => onChange({ ...value, description: event.target.value })} /></FormField>
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField htmlFor={`${id}-action-label`} label="CTA · подпись"><Input id={`${id}-action-label`} maxLength={120} value={value.action?.label ?? ""} onChange={(event) => updateAction({ label: event.target.value })} /></FormField>
      <FormField htmlFor={`${id}-action-href`} label="CTA · путь"><Input id={`${id}-action-href`} maxLength={2048} placeholder="/blog" value={value.action?.href ?? ""} onChange={(event) => updateAction({ href: event.target.value })} /></FormField>
    </div>
    {!validation.success && <Alert><AlertTitle>Перед публикацией</AlertTitle><AlertDescription>{validation.error.issues[0]?.message}. Черновик можно сохранить.</AlertDescription></Alert>}
  </fieldset>
}
