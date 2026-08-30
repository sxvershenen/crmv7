import { MessageComposer } from "./message-composer"

export type CommentThreadItem = {
  author: string
  createdLabel: string
  id: string
  text: string
}

export function CommentThread({ comments, draft, emptyLabel = "Комментариев пока нет", onAdd, onDraftChange }: { comments: CommentThreadItem[]; draft: string; emptyLabel?: string; onAdd: () => void; onDraftChange: (value: string) => void }) {
  return <div className="space-y-3" data-slot="comment-thread"><MessageComposer ariaLabel="Новый комментарий" onSend={onAdd} onValueChange={onDraftChange} placeholder="Добавить комментарий" sendLabel="Отправить комментарий" value={draft} />{comments.length ? <div className="divide-y rounded-lg border">{comments.map((comment) => <article className="p-3 text-xs" key={comment.id}><div className="flex items-center justify-between gap-3"><span>{comment.author}</span><span className="text-[10px] text-muted-foreground">{comment.createdLabel}</span></div><p className="mt-1.5 text-muted-foreground">{comment.text}</p></article>)}</div> : <p className="rounded-lg border border-dashed p-4 text-center text-[11px] text-muted-foreground">{emptyLabel}</p>}</div>
}
