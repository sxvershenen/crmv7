import { PublicEditorialContentConfigSchema, type PublicEditorialContentConfig } from "@crm/contracts"
import { Alert, AlertDescription, AlertTitle, Button, FormField, Input, Textarea } from "@crm/ui"

type Block = PublicEditorialContentConfig["blocks"][number]

export function EditorialSectionFields({ id, value, editable, showAuthor = false, onChange }: { id: string; value: PublicEditorialContentConfig; editable: boolean; showAuthor?: boolean; onChange: (value: PublicEditorialContentConfig) => void }) {
  const validation = PublicEditorialContentConfigSchema.safeParse(value)
  const replaceBlock = (index: number, block: Block) => onChange({ ...value, blocks: value.blocks.map((current, at) => at === index ? block : current) })
  const moveBlock = (index: number, direction: -1 | 1) => {
    const blocks = [...value.blocks]
    const next = index + direction
    if (next < 0 || next >= blocks.length) return
    ;[blocks[index], blocks[next]] = [blocks[next]!, blocks[index]!]
    onChange({ ...value, blocks })
  }
  return <fieldset className="mt-3 space-y-4 rounded-lg border bg-background p-3" disabled={!editable}>
    <legend className="px-1 text-xs font-medium">Текст страницы</legend>
    <div className="grid gap-3">
      <FormField htmlFor={`${id}-heading`} label="Заголовок блока"><Input id={`${id}-heading`} maxLength={240} onChange={(event) => onChange({ ...value, heading: event.target.value || null })} value={value.heading ?? ""} /></FormField>
      <FormField htmlFor={`${id}-lead`} label="Вводный текст"><Textarea id={`${id}-lead`} maxLength={1000} onChange={(event) => onChange({ ...value, lead: event.target.value || null })} value={value.lead ?? ""} /></FormField>
      {showAuthor ? <FormField htmlFor={`${id}-author`} label="Автор статьи"><Input id={`${id}-author`} maxLength={160} onChange={(event) => onChange({ ...value, authorName: event.target.value || null })} placeholder="Имя, которое увидят читатели" value={value.authorName ?? ""} /></FormField> : null}
    </div>
    <div className="space-y-3">
      <p className="text-xs font-medium">Основной текст</p>
      {value.blocks.map((block, index) => <div className="space-y-2 rounded-lg border p-3" key={`${id}-block-${index}`}>
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-medium">{block.type === "paragraph" ? "Абзац" : block.type === "heading" ? "Подзаголовок" : "Список"} {index + 1}</span><div className="flex flex-wrap gap-1"><Button aria-label={`Поднять блок ${index + 1}`} disabled={index === 0} onClick={() => moveBlock(index, -1)} size="sm" type="button" variant="outline">↑</Button><Button aria-label={`Опустить блок ${index + 1}`} disabled={index === value.blocks.length - 1} onClick={() => moveBlock(index, 1)} size="sm" type="button" variant="outline">↓</Button><Button aria-label={`Удалить блок ${index + 1}`} onClick={() => onChange({ ...value, blocks: value.blocks.filter((_, at) => at !== index) })} size="sm" type="button" variant="outline">Удалить</Button></div></div>
        {block.type === "paragraph" ? <FormField htmlFor={`${id}-block-${index}-text`} label="Текст абзаца"><Textarea id={`${id}-block-${index}-text`} maxLength={5000} onChange={(event) => replaceBlock(index, { ...block, text: event.target.value })} value={block.text} /></FormField> : null}
        {block.type === "heading" ? <div className="grid gap-2 sm:grid-cols-[8rem_1fr]"><FormField htmlFor={`${id}-block-${index}-level`} label="Уровень"><select className="h-9 w-full rounded-md border bg-background px-3 text-xs" id={`${id}-block-${index}-level`} onChange={(event) => replaceBlock(index, { ...block, level: event.target.value as "h2" | "h3" })} value={block.level}><option value="h2">H2</option><option value="h3">H3</option></select></FormField><FormField htmlFor={`${id}-block-${index}-text`} label="Текст подзаголовка"><Input id={`${id}-block-${index}-text`} maxLength={240} onChange={(event) => replaceBlock(index, { ...block, text: event.target.value })} value={block.text} /></FormField></div> : null}
        {block.type === "list" ? <FormField htmlFor={`${id}-block-${index}-items`} label="Пункты списка · каждый с новой строки"><Textarea id={`${id}-block-${index}-items`} onChange={(event) => replaceBlock(index, { ...block, items: event.target.value ? event.target.value.split("\n") : [] })} value={block.items.join("\n")} /></FormField> : null}
      </div>)}
      <div className="flex flex-wrap gap-2"><Button disabled={value.blocks.length >= 200} onClick={() => onChange({ ...value, blocks: [...value.blocks, { type: "paragraph", text: "" }] })} size="sm" type="button" variant="outline">Добавить абзац</Button><Button disabled={value.blocks.length >= 200} onClick={() => onChange({ ...value, blocks: [...value.blocks, { type: "heading", level: "h2", text: "" }] })} size="sm" type="button" variant="outline">Добавить подзаголовок</Button><Button disabled={value.blocks.length >= 200} onClick={() => onChange({ ...value, blocks: [...value.blocks, { type: "list", items: [] }] })} size="sm" type="button" variant="outline">Добавить список</Button></div>
    </div>
    <div className="space-y-2"><p className="text-xs font-medium">Связанные страницы</p>{value.links.map((link, index) => <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" key={`${id}-link-${index}`}><FormField htmlFor={`${id}-link-${index}-label`} label={`Подпись ссылки ${index + 1}`}><Input id={`${id}-link-${index}-label`} maxLength={160} onChange={(event) => onChange({ ...value, links: value.links.map((current, at) => at === index ? { ...current, label: event.target.value } : current) })} value={link.label} /></FormField><FormField htmlFor={`${id}-link-${index}-href`} label="Адрес внутри сайта"><Input id={`${id}-link-${index}-href`} maxLength={2048} onChange={(event) => onChange({ ...value, links: value.links.map((current, at) => at === index ? { ...current, href: event.target.value } : current) })} placeholder="/domiki" value={link.href} /></FormField><Button aria-label={`Удалить ссылку ${index + 1}`} className="self-end" onClick={() => onChange({ ...value, links: value.links.filter((_, at) => at !== index) })} size="sm" type="button" variant="outline">Удалить</Button></div>)}<Button disabled={value.links.length >= 30} onClick={() => onChange({ ...value, links: [...value.links, { label: "", href: "" }] })} size="sm" type="button" variant="outline">Добавить ссылку</Button></div>
    {!validation.success && <Alert><AlertTitle>Перед публикацией</AlertTitle><AlertDescription>Заполните хотя бы один текстовый блок, затем проверьте подзаголовки, списки и ссылки. Черновик можно сохранить.</AlertDescription></Alert>}
  </fieldset>
}
